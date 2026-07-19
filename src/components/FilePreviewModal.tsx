import PhotoPreviewModal, { type PreviewItem } from "./PhotoPreviewModal";

export interface PreviewAsset {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "folder";
  captureDate?: Date;
  driveId?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  versions?: { size: string; url?: string }[];
}

interface FilePreviewModalProps {
  asset: PreviewAsset;
  assets?: PreviewAsset[];
  onClose: () => void;
  onChange?: (asset: PreviewAsset) => void;
  contextLabel?: string;
}

function toPreviewItem(asset: PreviewAsset): PreviewItem {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    driveId: asset.driveId,
    thumbnailUrl: asset.thumbnailUrl,
    webViewLink: asset.webViewLink,
    captureDate: asset.captureDate,
    size: asset.versions?.[0]?.size,
    versions: asset.versions,
  };
}

function isPreviewable(asset: PreviewAsset) {
  return asset.type === "image" || asset.type === "video" || asset.type === "document";
}

export default function FilePreviewModal({
  asset,
  assets = [],
  onClose,
  onChange,
  contextLabel,
}: FilePreviewModalProps) {
  const previewableAssets = assets.length > 0 ? assets.filter(isPreviewable) : isPreviewable(asset) ? [asset] : [];
  const items = previewableAssets.map(toPreviewItem);
  const activeIndex = Math.max(0, previewableAssets.findIndex((entry) => entry.id === asset.id));

  if (!items.length) return null;

  return (
    <PhotoPreviewModal
      items={items}
      activeIndex={activeIndex}
      onClose={onClose}
      onChange={(index) => {
        const next = previewableAssets[index];
        if (next && onChange) onChange(next);
      }}
      contextLabel={contextLabel}
    />
  );
}
