import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import type { GalleryAlbum } from "../../lib/sitePages";
import GalleryAlbumCard from "./GalleryAlbumCard";

const VISIBLE = 4;

interface GalleryAlbumCarouselProps {
  albums: GalleryAlbum[];
}

export default function GalleryAlbumCarousel({ albums }: GalleryAlbumCarouselProps) {
  const [slide, setSlide] = useState(0);
  const [resetting, setResetting] = useState(false);

  const maxSlide = albums.length;
  const extended = maxSlide > 0 ? [...albums, ...albums.slice(0, VISIBLE)] : [];
  const slotWidth = extended.length > 0 ? 100 / extended.length : 0;
  const canSlide = albums.length > VISIBLE;

  useEffect(() => {
    if (!canSlide) return;
    const timer = window.setInterval(() => {
      setSlide((prev) => prev + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [canSlide, maxSlide]);

  useEffect(() => {
    if (!canSlide || slide !== maxSlide) return;
    const timer = window.setTimeout(() => {
      setResetting(true);
      setSlide(0);
      requestAnimationFrame(() => setResetting(false));
    }, 520);
    return () => window.clearTimeout(timer);
  }, [slide, maxSlide, canSlide]);

  if (albums.length === 0) return null;

  const prev = () => setSlide((s) => (s <= 0 ? maxSlide - 1 : s - 1));
  const next = () => setSlide((s) => s + 1);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {canSlide && (
        <button
          type="button"
          onClick={prev}
          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md text-[#3d001d] flex items-center justify-center hover:bg-[#f7f7f7] transition-colors"
          aria-label="Álbum anterior"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        <motion.div
          className="flex"
          style={{ width: `${(extended.length / VISIBLE) * 100}%` }}
          animate={{ x: `-${slide * (100 / extended.length)}%` }}
          transition={resetting ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
        >
          {extended.map((album, index) => (
            <div
              key={`${album.slug}-${index}`}
              className="shrink-0 box-border px-1.5"
              style={{ width: `${slotWidth}%` }}
            >
              <GalleryAlbumCard album={album} compact />
            </div>
          ))}
        </motion.div>
      </div>

      {canSlide && (
        <button
          type="button"
          onClick={next}
          className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md text-[#3d001d] flex items-center justify-center hover:bg-[#f7f7f7] transition-colors"
          aria-label="Álbum seguinte"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
