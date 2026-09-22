import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || 'https://avfoqkigxuoofsztfdbi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU0NDMsImV4cCI6MjEwNTY4MTQ0M30.UZg69ECsFZbjfd7iPGSM7OjYCGbTum-bGaPr5rjERAU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET_NAME = 'gallery-albums';

export interface GalleryAlbum {
  id: string;
  slug: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GalleryPhoto {
  id: string;
  album_id: string;
  storage_path: string;
  public_url: string;
  caption?: string;
  order_index: number;
  created_at: string;
}

// Upload uma foto para o Supabase Storage
export async function uploadPhotoToAlbum(
  file: File,
  albumId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storagePath = `${albumId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl,
  };
}

// Deletar uma foto do Supabase Storage
export async function deletePhotoFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) throw error;
}

// Criar um novo álbum
export async function createAlbum(
  slug: string,
  title: string,
  description?: string
): Promise<GalleryAlbum> {
  const { data, error } = await supabase
    .from('gallery_albums')
    .insert({
      slug,
      title,
      description,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar um álbum
export async function updateAlbum(
  id: string,
  updates: Partial<Pick<GalleryAlbum, 'title' | 'description' | 'cover_image_url'>>
): Promise<GalleryAlbum> {
  const { data, error } = await supabase
    .from('gallery_albums')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Deletar um álbum (e todas as fotos associadas via CASCADE)
export async function deleteAlbum(id: string): Promise<void> {
  // Primeiro deletar todas as fotos do storage
  const { data: photos } = await supabase
    .from('gallery_photos')
    .select('storage_path')
    .eq('album_id', id);

  if (photos && photos.length > 0) {
    const storagePaths = photos.map(p => p.storage_path);
    await supabase.storage
      .from(BUCKET_NAME)
      .remove(storagePaths);
  }

  // Depois deletar o álbum (CASCADE deleta as fotos da tabela)
  const { error } = await supabase
    .from('gallery_albums')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Listar todos os álbuns
export async function listAlbums(): Promise<GalleryAlbum[]> {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Obter um álbum por slug
export async function getAlbumBySlug(slug: string): Promise<GalleryAlbum | null> {
  const { data, error } = await supabase
    .from('gallery_albums')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

// Adicionar uma foto a um álbum
export async function addPhotoToAlbum(
  albumId: string,
  storagePath: string,
  publicUrl: string,
  caption?: string,
  orderIndex?: number
): Promise<GalleryPhoto> {
  const { data, error } = await supabase
    .from('gallery_photos')
    .insert({
      album_id: albumId,
      storage_path: storagePath,
      public_url: publicUrl,
      caption,
      order_index: orderIndex || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Listar fotos de um álbum
export async function listAlbumPhotos(albumId: string): Promise<GalleryPhoto[]> {
  const { data, error } = await supabase
    .from('gallery_photos')
    .select('*')
    .eq('album_id', albumId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Deletar uma foto de um álbum
export async function deletePhotoFromAlbum(photoId: string): Promise<void> {
  // Primeiro obter o storage path
  const { data: photo } = await supabase
    .from('gallery_photos')
    .select('storage_path')
    .eq('id', photoId)
    .single();

  if (photo?.storage_path) {
    await deletePhotoFromStorage(photo.storage_path);
  }

  // Depois deletar da tabela
  const { error } = await supabase
    .from('gallery_photos')
    .delete()
    .eq('id', photoId);

  if (error) throw error;
}

// Atualizar ordem das fotos
export async function updatePhotoOrder(photoId: string, orderIndex: number): Promise<void> {
  const { error } = await supabase
    .from('gallery_photos')
    .update({ order_index: orderIndex })
    .eq('id', photoId);

  if (error) throw error;
}

export { supabase };
