import { createClient } from '@supabase/supabase-js';
import { compressImage } from './compressImage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://avfoqkigxuoofsztfdbi.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Zm9xa2lneHVvb2ZzenRmZGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDU0NDMsImV4cCI6MjEwNTY4MTQ0M30.UZg69ECsFZbjfd7iPGSM7OjYCGbTum-bGaPr5rjERAU';

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
// A imagem é automaticamente comprimida para ≤ 50 KB antes do envio.
export async function uploadPhotoToAlbum(
  file: File,
  albumId: string
): Promise<{ storagePath: string; publicUrl: string }> {
  // Comprimir antes de enviar
  const compressed = await compressImage(file);

  const fileExt = compressed.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storagePath = `${albumId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, compressed, {
      upsert: false,
      contentType: compressed.type,
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

// Criar um novo álbum (via API)
export async function createAlbum(
  slug: string,
  title: string,
  description?: string
): Promise<GalleryAlbum> {
  const response = await fetch('/api/gallery/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, title, description }),
  });

  if (!response.ok) throw new Error('Failed to create album');
  return response.json();
}

// Atualizar um álbum (via API)
export async function updateAlbum(
  id: string,
  updates: Partial<Pick<GalleryAlbum, 'title' | 'description' | 'cover_image_url'>>
): Promise<GalleryAlbum> {
  console.log('updateAlbum called with:', { id, updates });
  const response = await fetch(`/api/gallery/albums/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  console.log('updateAlbum response status:', response.status);
  if (!response.ok) {
    const error = await response.text();
    console.error('Update album failed:', error);
    throw new Error(`Failed to update album: ${error}`);
  }
  const data = await response.json();
  console.log('updateAlbum success:', data);
  return data;
}

// Deletar um álbum (via API)
export async function deleteAlbum(id: string): Promise<void> {
  const response = await fetch(`/api/gallery/albums/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete album');
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

// Adicionar uma foto a um álbum (via API)
export async function addPhotoToAlbum(
  albumId: string,
  storagePath: string,
  publicUrl: string,
  caption?: string,
  orderIndex?: number
): Promise<GalleryPhoto> {
  const response = await fetch('/api/gallery/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ albumId, storagePath, publicUrl, caption, orderIndex }),
  });

  if (!response.ok) throw new Error('Failed to add photo');
  return response.json();
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

// Deletar uma foto de um álbum (via API)
export async function deletePhotoFromAlbum(photoId: string): Promise<void> {
  const response = await fetch(`/api/gallery/photos/${photoId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete photo');
}

// Atualizar ordem das fotos (via API)
export async function updatePhotoOrder(photoId: string, orderIndex: number): Promise<void> {
  const response = await fetch(`/api/gallery/photos/${photoId}/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIndex }),
  });

  if (!response.ok) throw new Error('Failed to update photo order');
}

export { supabase };
