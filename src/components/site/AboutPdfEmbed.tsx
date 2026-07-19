import { extractDriveFileId } from "../../lib/driveImageUrl";

function resolvePdfEmbedSrc(url: string): string {
  if (!url) return "";
  const id = extractDriveFileId(url);
  if (id) return `/api/drive/media?id=${encodeURIComponent(id)}`;
  return url;
}

interface AboutPdfEmbedProps {
  url: string;
  title: string;
}

export default function AboutPdfEmbed({ url, title }: AboutPdfEmbedProps) {
  const src = resolvePdfEmbedSrc(url);
  if (!src) return null;

  return (
    <iframe
      src={src}
      title={title}
      className="h-[min(480px,65vh)] w-full rounded-xl border border-gray-200 bg-gray-100"
    />
  );
}
