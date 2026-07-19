import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gwankhxcbkrtgxopbxwd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Map database table columns from camelCase (React/Firestore) to snake_case (Supabase)
function mapToSnakeCase(table: string, data: any): any {
  if (!data) return data;
  const result: any = {};
  
  // Generic copy
  Object.keys(data).forEach(key => {
    let newKey = key;
    if (key === 'ownerId') newKey = 'owner_id';
    else if (key === 'parentId') newKey = 'parent_id';
    else if (key === 'adminToken') newKey = 'admin_token';
    else if (key === 'captureDate') newKey = 'capture_date';
    else if (key === 'uploadDate') newKey = 'upload_date';
    else if (key === 'folderId') newKey = 'folder_id';
    else if (key === 'driveId') newKey = 'drive_id';
    else if (key === 'thumbnailUrl') newKey = 'thumbnail_url';
    else if (key === 'displayName') newKey = 'display_name';
    else if (key === 'clientId') newKey = 'client_id';
    else if (key === 'clientEmail') newKey = 'client_email';
    else if (key === 'createdAt') newKey = 'created_at';

    // Handle firebase timestamps / javascript dates
    let val = data[key];
    if (val && typeof val.toDate === 'function') {
      val = val.toDate().toISOString();
    } else if (val instanceof Date) {
      val = val.toISOString();
    }
    
    result[newKey] = val;
  });

  // Strip columns that don't exist on specific tables to avoid schema cache errors
  if (table === 'user_profiles') {
    delete result.admin_token;
    delete result.capture_date;
    delete result.upload_date;
    delete result.folder_id;
    delete result.drive_id;
    delete result.thumbnail_url;
    delete result.owner_id;
    delete result.versions;
    delete result.trashed;
    delete result.starred;
    delete result.created_at;
    delete result.createdAt;
  }
  if (table === 'folders') {
    delete result.admin_token;
    delete result.capture_date;
    delete result.upload_date;
    delete result.drive_id;
    delete result.thumbnail_url;
    delete result.versions;
    delete result.client_id; // coluna não existe - usar client_email
  }

  return result;
}

// Convert Firestore fields to JS Dates if applicable
function toDateCompat(val: any) {
  if (!val) return val;
  // Shim as a Firestore timestamp object to support .toDate()
  const d = new Date(val);
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0
  };
}

// Compatibility Shims for Firestore API
export function collection(db: any, path: string) {
  return { path };
}

export function doc(db: any, path: string, id: string) {
  return { path, id };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return collectionRef;
}

export function where(field: string, op: string, value: any) {
  return { field, op, value };
}

export async function getDoc(docRef: any) {
  const table = docRef.path === 'users' ? 'user_profiles' : docRef.path;
  const { data, error } = await supabase.from(table).select('*').eq('id', docRef.id).single();
  
  return {
    exists: () => !error && data !== null,
    data: () => {
      if (!data) return null;
      // Map to camelCase for compatibility
      const mapped: any = {};
      Object.keys(data).forEach(key => {
        let newKey = key;
        if (key === 'owner_id') newKey = 'ownerId';
        else if (key === 'parent_id') newKey = 'parentId';
        else if (key === 'admin_token') newKey = 'adminToken';
        else if (key === 'capture_date') newKey = 'captureDate';
        else if (key === 'upload_date') newKey = 'uploadDate';
        else if (key === 'folder_id') newKey = 'folderId';
        else if (key === 'drive_id') newKey = 'driveId';
        else if (key === 'thumbnail_url') newKey = 'thumbnailUrl';
        else if (key === 'display_name') newKey = 'displayName';
        else if (key === 'client_id') newKey = 'clientId';
        else if (key === 'client_email') newKey = 'clientEmail';
        
        // Wrap dates with Firestore Timestamp shim so .toDate() works!
        if (key === 'capture_date' || key === 'upload_date' || key === 'date') {
          mapped[newKey] = toDateCompat(data[key]);
        } else {
          mapped[newKey] = data[key];
        }
      });
      return mapped;
    }
  };
}

const tableListeners: { [table: string]: Set<() => void> } = {};

function addTableListener(table: string, listener: () => void) {
  if (!tableListeners[table]) {
    tableListeners[table] = new Set();
  }
  tableListeners[table].add(listener);
  return () => {
    tableListeners[table].delete(listener);
  };
}

function notifyTableChange(table: string) {
  if (tableListeners[table]) {
    // 1. Dispara imediato
    tableListeners[table].forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.warn("Erro ao disparar listener local imediato:", err);
      }
    });

    // 2. Dispara novamente após 500ms como salvaguarda para commits do Postgres
    setTimeout(() => {
      if (tableListeners[table]) {
        tableListeners[table].forEach(listener => {
          try {
            listener();
          } catch (err) {
            console.warn("Erro ao disparar listener local posterior:", err);
          }
        });
      }
    }, 500);
  }
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const table = docRef.path === 'users' ? 'user_profiles' : docRef.path;
  const mapped = { id: docRef.id, ...mapToSnakeCase(table, data) };
  
  let error;
  if (table === 'assets' && mapped.drive_id) {
    const { error: err } = await supabase.from(table).upsert(mapped, { onConflict: 'drive_id' });
    error = err;
  } else {
    const { error: err } = await supabase.from(table).upsert(mapped);
    error = err;
  }
  
  if (error) {
    if (error.message.includes('unique') || error.message.includes('violates')) {
      if (table === 'assets' && mapped.drive_id) {
        const { data: existingAsset, error: findErr } = await supabase.from(table).select('id').eq('drive_id', mapped.drive_id).maybeSingle();
        if (!findErr && existingAsset) {
          const { error: updErr } = await supabase.from(table).update(mapped).eq('id', existingAsset.id);
          if (!updErr) {
            notifyTableChange(table);
            return;
          }
        }
      }
    }
    throw new Error(error.message);
  }
  notifyTableChange(table);
}

export async function addDoc(collectionRef: any, data: any) {
  const table = collectionRef.path === 'users' ? 'user_profiles' : collectionRef.path;
  const mapped = mapToSnakeCase(table, data);
  
  // Se não houver ID (comum no addDoc do Firestore), geramos um ID de texto único aleatório
  if (!mapped.id) {
    mapped.id = 'fs_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  let error;
  let inserted;
  
  if (table === 'assets' && mapped.drive_id) {
    const { data: upserted, error: err } = await supabase.from(table).upsert(mapped, { onConflict: 'drive_id' }).select().single();
    error = err;
    inserted = upserted;
  } else {
    const { data: ins, error: err } = await supabase.from(table).insert(mapped).select().single();
    error = err;
    inserted = ins;
  }
  
  if (error) {
    // Tratamento definitivo e inteligente de conflitos de chave única no Drive ID ou IDs residuais
    if (error.message.includes('unique') || error.message.includes('violates')) {
      if (table === 'assets' && mapped.drive_id) {
        const { data: existingAsset, error: findErr } = await supabase.from(table).select('id').eq('drive_id', mapped.drive_id).maybeSingle();
        if (!findErr && existingAsset) {
          const { error: updErr } = await supabase.from(table).update(mapped).eq('id', existingAsset.id);
          if (!updErr) {
            notifyTableChange(table);
            return { id: existingAsset.id };
          }
        }
      }
      
      // Fallback secundário usando upsert pelo id
      const { data: fbData, error: fbErr } = await supabase.from(table).upsert(mapped).select().single();
      if (fbErr) throw new Error(fbErr.message);
      notifyTableChange(table);
      return { id: fbData.id };
    }
    throw new Error(error.message);
  }
  notifyTableChange(table);
  return { id: inserted.id };
}

export async function updateDoc(docRef: any, data: any) {
  const table = docRef.path === 'users' ? 'user_profiles' : docRef.path;
  const mapped = mapToSnakeCase(table, data);
  
  const { error } = await supabase.from(table).update(mapped).eq('id', docRef.id);
  if (error) throw new Error(error.message);
  notifyTableChange(table);
}

export async function deleteDoc(docRef: any) {
  const table = docRef.path === 'users' ? 'user_profiles' : docRef.path;
  const { error } = await supabase.from(table).delete().eq('id', docRef.id);
  if (error) throw new Error(error.message);
  notifyTableChange(table);
}

export function onSnapshot(ref: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) {
  const table = ref.path === 'users' ? 'user_profiles' : ref.path;
  
  const fetchAndNotify = async () => {
    try {
      // Buscar dados de forma paginada para contornar o limite de 1000 registros do PostgREST/Supabase
      let allData: any[] = [];
      let de = 0;
      const limiteBloco = 1000;
      let temMais = true;
      
      while (temMais) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(de, de + limiteBloco - 1);
          
        if (error) {
          if (errorCallback) errorCallback(error);
          return;
        }
        
        if (data && data.length > 0) {
          allData = allData.concat(data);
          if (data.length < limiteBloco) {
            temMais = false;
          } else {
            de += limiteBloco;
          }
        } else {
          temMais = false;
        }
      }
      
      const docs = allData.map(item => {
        // Map to camelCase
        const mapped: any = {};
        Object.keys(item).forEach(key => {
          let newKey = key;
          if (key === 'owner_id') newKey = 'ownerId';
          else if (key === 'parent_id') newKey = 'parentId';
          else if (key === 'admin_token') newKey = 'adminToken';
          else if (key === 'capture_date') newKey = 'captureDate';
          else if (key === 'upload_date') newKey = 'uploadDate';
          else if (key === 'folder_id') newKey = 'folderId';
          else if (key === 'drive_id') newKey = 'driveId';
          else if (key === 'thumbnail_url') newKey = 'thumbnailUrl';
          else if (key === 'display_name') newKey = 'displayName';
          else if (key === 'client_id') newKey = 'clientId';
        else if (key === 'client_email') newKey = 'clientEmail';
          
          if (key === 'capture_date' || key === 'upload_date' || key === 'date') {
            mapped[newKey] = toDateCompat(item[key]);
          } else {
            mapped[newKey] = item[key];
          }
        });
        
        return {
          id: item.id,
          data: () => mapped
        };
      });
      
      callback({ docs });
    } catch (e) {
      if (errorCallback) errorCallback(e);
    }
  };
  
  fetchAndNotify();
  
  const removeTableListener = addTableListener(table, () => {
    fetchAndNotify();
  });
  
  const channel = supabase.channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      fetchAndNotify();
    })
    .subscribe();
    
  return () => {
    removeTableListener();
    supabase.removeChannel(channel);
  };
}

export const serverTimestamp = () => new Date().toISOString();

export class Timestamp {
  static now() {
    return toDateCompat(new Date());
  }
  static fromDate(date: Date) {
    return toDateCompat(date);
  }
}

// Export a dummy db object for compatibility with Firebase-like syntax
export const db = {};
