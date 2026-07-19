import { GALLERY_STATIC_PHOTOS } from "../../lib/galleryStaticPhotos.js";

export const GALLERY_PHOTOS = GALLERY_STATIC_PHOTOS;

export function getGalleryPhotos(slug: string, fallbackCover: string) {
  const photos = GALLERY_PHOTOS[slug];
  return photos?.length ? photos : [fallbackCover];
}
