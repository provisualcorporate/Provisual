import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, Plus, Shrink } from "lucide-react";
import { format } from "date-fns";
import { motion } from "motion/react";
import { displayDriveName } from "../lib/utils";
import { extractDriveFileId } from "../lib/driveImageUrl";
import { getDrivePreviewUrl, triggerDriveDownload, triggerFileDownload } from "../lib/driveDownload";

export interface PreviewItem {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "folder";
  driveId?: string;
  thumbnailUrl?: string;
  srcUrl?: string;
  webViewLink?: string;
  captureDate?: Date;
  size?: string;
  versions?: { size?: string; url?: string }[];
}

interface PhotoPreviewModalProps {
  items: PreviewItem[];
  activeIndex: number;
  onClose: () => void;
  onChange: (index: number) => void;
  contextLabel?: string;
}

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  item: PreviewItem;
}

function SafeImage({ item, alt, className, ...props }: SafeImageProps) {
  const driveId =
    item.driveId ||
    (item.id && !item.id.startsWith("local-") ? item.id : null) ||
    (item.srcUrl ? extractDriveFileId(item.srcUrl) : null);
  const previewUrl = driveId
    ? `/api/drive/thumbnail?id=${driveId}&sz=1200`
    : item.thumbnailUrl?.replace("=s220", "=s1200") || item.srcUrl || "";
  const [src, setSrc] = useState(previewUrl);
  const [failStep, setFailStep] = useState(0);

  useEffect(() => {
    const nextDriveId =
      item.driveId ||
      (item.id && !item.id.startsWith("local-") ? item.id : null) ||
      (item.srcUrl ? extractDriveFileId(item.srcUrl) : null);
    const nextUrl = nextDriveId
      ? `/api/drive/thumbnail?id=${nextDriveId}&sz=1200`
      : item.thumbnailUrl?.replace("=s220", "=s1200") || item.srcUrl || "";
    setSrc(nextUrl);
    setFailStep(0);
  }, [item.id, item.driveId, item.srcUrl, item.thumbnailUrl]);

  const handleError = () => {
    const resolvedDriveId =
      item.driveId ||
      (item.id && !item.id.startsWith("local-") ? item.id : null) ||
      (item.srcUrl ? extractDriveFileId(item.srcUrl) : null);
    if (failStep === 0 && resolvedDriveId) {
      setFailStep(1);
      setSrc(`https://drive.google.com/thumbnail?id=${resolvedDriveId}&sz=w1200`);
      return;
    }
    if (failStep === 1 && resolvedDriveId) {
      setFailStep(2);
      setSrc(`/api/drive/media?id=${encodeURIComponent(resolvedDriveId)}`);
      return;
    }
    if (failStep === 2 && item.srcUrl && src !== item.srcUrl) {
      setFailStep(3);
      setSrc(item.srcUrl);
    }
  };

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      onError={handleError}
      className={className}
      decoding="async"
      {...props}
    />
  );
}

function buildMetaText(item: PreviewItem, index: number, total: number, contextLabel?: string) {
  const extension = item.name.includes(".") ? item.name.split(".").pop() : "";
  const nameWithoutExt = item.name.includes(".")
    ? item.name.substring(0, item.name.lastIndexOf("."))
    : item.name;
  const capitalizedType = item.type.charAt(0).toUpperCase() + item.type.slice(1);
  const formatDisplay = extension ? `${capitalizedType}.${extension.toLowerCase()}` : capitalizedType;
  const sizeDisplay = item.size || item.versions?.[0]?.size || "";
  const dateDisplay = item.captureDate ? format(item.captureDate, "dd/MM/yyyy") : "";
  const parts = [formatDisplay, sizeDisplay, nameWithoutExt, contextLabel, dateDisplay, `${index + 1} / ${total}`]
    .filter(Boolean);
  return parts.join(" | ");
}

function resolveDriveFileId(item: PreviewItem): string | null {
  if (item.driveId && !item.driveId.startsWith("local-")) {
    return item.driveId;
  }
  if (item.srcUrl) {
    const fromSrc = extractDriveFileId(item.srcUrl);
    if (fromSrc) return fromSrc;
  }
  const fallbackUrl = item.versions?.[0]?.url || item.webViewLink || "";
  if (fallbackUrl.includes("drive.google.com")) {
    const matchId =
      fallbackUrl.match(/id=([^&]+)/) || fallbackUrl.match(/\/file\/d\/([^/]+)/);
    return matchId?.[1] || null;
  }
  return null;
}

function handleDownload(item: PreviewItem) {
  const driveId = resolveDriveFileId(item);
  if (driveId) {
    triggerDriveDownload(driveId, item.name);
    return;
  }

  const staticUrl = item.srcUrl || item.versions?.[0]?.url || item.webViewLink;
  if (staticUrl) {
    triggerFileDownload(staticUrl, item.name);
  }
}

export default function PhotoPreviewModal({
  items,
  activeIndex,
  onClose,
  onChange,
  contextLabel,
}: PhotoPreviewModalProps) {
  const item = items[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < items.length - 1;
  const showNav = items.length > 1;
  const [downloading, setDownloading] = useState(false);
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    setActualSize(false);
  }, [activeIndex, item?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrev) onChange(activeIndex - 1);
      if (event.key === "ArrowRight" && hasNext) onChange(activeIndex + 1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [activeIndex, hasPrev, hasNext, onChange, onClose]);

  if (!item) return null;

  const metaText = buildMetaText(item, activeIndex, items.length, contextLabel);
  const previewSrc = item.type === "image" ? null : getDrivePreviewUrl(item);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 md:p-6 [backdrop-filter:none]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#18191a] max-w-4xl w-full h-[75vh] md:h-[70vh] rounded-[10px] overflow-hidden flex flex-col shadow-[0_8px_40px_rgba(0,0,0,0.45)] relative"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-md hover:scale-105"
          aria-label="Fechar"
        >
          <Plus className="rotate-45" size={20} />
        </button>

        {showNav && hasPrev && (
          <button
            type="button"
            onClick={() => onChange(activeIndex - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-md"
            aria-label="Imagem anterior"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {showNav && hasNext && (
          <button
            type="button"
            onClick={() => onChange(activeIndex + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-md"
            aria-label="Imagem seguinte"
          >
            <ChevronRight size={22} />
          </button>
        )}

        <div className="flex-1 bg-[#121212] flex items-center justify-center relative overflow-hidden w-full h-full">
          {item.type === "image" ? (
            <SafeImage
              item={item}
              className={
                actualSize
                  ? "max-w-full max-h-full w-auto h-auto object-contain"
                  : "w-full h-full object-cover"
              }
              alt={displayDriveName(item.name)}
            />
          ) : previewSrc ? (
            <iframe
              src={previewSrc}
              title={displayDriveName(item.name)}
              className="w-full h-full border-none bg-white"
              allow="autoplay"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <Plus className="rotate-45" size={48} />
              <p className="text-sm font-bold uppercase tracking-widest">Visualização indisponível</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 pt-16 pb-5 px-6 bg-gradient-to-t from-black/95 via-black/70 to-black/0 flex items-center justify-between text-white z-20 rounded-b-[10px]">
          <div className="flex items-center max-w-[75%] text-left">
            <span className="text-xs md:text-sm font-medium text-white tracking-normal select-text">
              {metaText}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {item.type === "image" && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setActualSize((value) => !value);
                }}
                className="flex items-center gap-1.5 bg-transparent hover:text-[#a21b7e] text-white px-2 py-1.5 rounded-none text-xs font-bold transition-all cursor-pointer select-none border-none shadow-none"
              >
                {actualSize ? <Shrink size={14} /> : <Maximize2 size={14} />}
                <span>{actualSize ? "Preencher ecrã" : "Tamanho real"}</span>
              </button>
            )}

            <button
              type="button"
              disabled={downloading}
              onClick={(event) => {
                event.stopPropagation();
                setDownloading(true);
                handleDownload(item);
                window.setTimeout(() => setDownloading(false), 1200);
              }}
              className="flex items-center gap-1.5 bg-transparent hover:text-[#a21b7e] text-white px-2 py-1.5 rounded-none text-xs font-bold transition-all cursor-pointer select-none border-none shadow-none disabled:opacity-60"
            >
              <Download size={14} />
              <span>{downloading ? "A transferir..." : "Baixar"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
