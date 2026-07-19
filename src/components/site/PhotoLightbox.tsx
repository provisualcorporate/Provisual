import PhotoPreviewModal, { type PreviewItem } from "../PhotoPreviewModal";
import type { SiteDrivePhoto } from "../../lib/siteGalleryApi";

interface PhotoLightboxProps {
  photos: SiteDrivePhoto[];
  activeIndex: number;
  albumTitle: string;
  onClose: () => void;
  onChange: (index: number) => void;
}

function toPreviewItem(photo: SiteDrivePhoto): PreviewItem {
  return {
    id: photo.id,
    name: photo.name,
    type: "image",
    driveId: photo.id.startsWith("local-") ? undefined : photo.id,
    srcUrl: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
  };
}

export default function PhotoLightbox({
  photos,
  activeIndex,
  albumTitle,
  onClose,
  onChange,
}: PhotoLightboxProps) {
  const items = photos.map(toPreviewItem);

  return (
    <PhotoPreviewModal
      items={items}
      activeIndex={activeIndex}
      onClose={onClose}
      onChange={onChange}
      contextLabel={albumTitle}
    />
  );
}
