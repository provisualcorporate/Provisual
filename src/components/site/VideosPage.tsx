import { useEffect, useState } from "react";
import { X } from "lucide-react";
import SiteShell from "./SiteShell";
import SiteYoutubePlayer from "./SiteYoutubePlayer";
import { VIDEO_ITEMS, type VideoItem } from "../../lib/sitePages";
import { PAGE_BREADCRUMBS } from "../../lib/siteNav";
import { youtubeThumbnail } from "../../lib/youtubeEmbed";
import { fetchSiteVideos } from "../../lib/siteGalleryApi";

export default function VideosPage() {
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>(VIDEO_ITEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSiteVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeYoutubeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveYoutubeId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [activeYoutubeId]);

  return (
    <SiteShell title="Vídeos" breadcrumbs={[...PAGE_BREADCRUMBS.videos]}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#a21b7e]/30 border-t-[#a21b7e] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <button
              key={`${video.slug}-${video.youtubeId}`}
              type="button"
              onClick={() => setActiveYoutubeId(video.youtubeId)}
              className="group relative aspect-video w-full overflow-hidden text-left shadow-lg"
              aria-label={`Reproduzir vídeo ${video.title}`}
            >
              <img
                src={video.image || youtubeThumbnail(video.youtubeId)}
                alt={video.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-10">
                <p className="text-sm font-bold text-white line-clamp-2">{video.title}</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-transparent text-2xl text-white transition-colors duration-200 group-hover:border-[#a21b7e] group-hover:bg-[#a21b7e] sm:h-[4.5rem] sm:w-[4.5rem]">
                  ▶
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {activeYoutubeId && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveYoutubeId(null)}
        >
          <div
            className="relative w-full max-w-[1280px] overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SiteYoutubePlayer
              key={activeYoutubeId}
              videoId={activeYoutubeId}
              autoplay
              hideMoreVideos
            />
            <div className="flex items-center justify-end border-t border-white/10 bg-[#111] px-4 py-3">
              <button
                type="button"
                onClick={() => setActiveYoutubeId(null)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm text-white transition-colors hover:bg-white/20"
                aria-label="Fechar vídeo"
              >
                <X size={18} />
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
