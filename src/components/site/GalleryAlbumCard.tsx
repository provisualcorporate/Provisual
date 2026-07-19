import { Link } from "react-router-dom";
import type { GalleryAlbum } from "../../lib/sitePages";
import { driveDisplayUrl } from "../../lib/driveImageUrl";

interface GalleryAlbumCardProps {
  album: GalleryAlbum;
  compact?: boolean;
}

export default function GalleryAlbumCard({ album, compact = false }: GalleryAlbumCardProps) {
  const cover = driveDisplayUrl(album.image, compact ? "sm" : "md");

  if (compact) {
    return (
      <article className="group relative aspect-[16/10] rounded-lg overflow-hidden shadow-md">
        <img
          src={cover}
          alt={album.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-3 py-2">
          <h2 className="text-white text-xs sm:text-sm font-bold mb-1 line-clamp-2">{album.title}</h2>
          <p className="text-white/90 text-[10px] sm:text-xs mb-2 leading-snug line-clamp-2">{album.subtitle}</p>
          <Link
            to={`/galeria/${album.slug}`}
            className="inline-flex items-center justify-center border border-white text-white text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded hover:bg-white hover:text-[#4a0e4e] transition-colors"
          >
            VER ALBUM
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-lg">
      <img
        src={cover}
        alt={album.title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-white text-lg md:text-xl font-bold mb-2">{album.title}</h2>
        <p className="text-white/90 text-sm mb-6 leading-snug">{album.subtitle}</p>
        <Link
          to={`/galeria/${album.slug}`}
          className="inline-flex items-center justify-center border border-white text-white text-xs font-semibold uppercase tracking-widest px-6 py-2.5 rounded hover:bg-white hover:text-[#4a0e4e] transition-colors"
        >
          VER ALBUM
        </Link>
      </div>
    </article>
  );
}
