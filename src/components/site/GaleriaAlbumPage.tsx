import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SiteShell from "./SiteShell";
import { GALLERY_ALBUMS } from "../../lib/sitePages";
import { driveDisplayUrl } from "../../lib/driveImageUrl";
import {
  fetchSiteGalleryAlbums,
  fetchSiteGalleryPhotos,
  type SiteDrivePhoto,
} from "../../lib/siteGalleryApi";
import GalleryAlbumCarousel from "./GalleryAlbumCarousel";
import PhotoLightbox from "./PhotoLightbox";

const COLS = 4;
const ROWS = 6;
const PHOTOS_PER_PAGE = COLS * ROWS;

export default function GaleriaAlbumPage() {
  const { slug } = useParams();
  const staticAlbum = GALLERY_ALBUMS.find((a) => a.slug === slug);
  const [albumMeta, setAlbumMeta] = useState(staticAlbum || null);
  const [photos, setPhotos] = useState<SiteDrivePhoto[]>([]);
  const [allAlbums, setAllAlbums] = useState(GALLERY_ALBUMS);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const prevPageRef = useRef(1);

  useEffect(() => {
    setPage(1);
    prevPageRef.current = 0;
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const albums = await fetchSiteGalleryAlbums();
        const found = albums.find((a) => a.slug === slug) || staticAlbum;
        if (active && found) {
          setAlbumMeta(found);
          const loadedPhotos = await fetchSiteGalleryPhotos(found.slug, found.image);
          if (active) setPhotos(loadedPhotos);
        }
        if (active) setAllAlbums(albums);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug, staticAlbum]);

  const totalPages = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));
  const safePage = Math.min(page, totalPages);

  const scrollToPageTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goToPage = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  useLayoutEffect(() => {
    if (loading || !albumMeta || prevPageRef.current === safePage) return;
    prevPageRef.current = safePage;
    scrollToPageTop();
  }, [safePage, loading, albumMeta, scrollToPageTop]);

  if (!albumMeta && !loading) {
    return (
      <SiteShell
        title="Galeria"
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Galeria", href: "/galeria" }, { label: "Álbum" }]}
      >
        <p className="text-center text-gray-500">Álbum não encontrado.</p>
        <p className="text-center mt-4">
          <Link to="/galeria" className="text-[#a21b7e] hover:underline">
            Voltar à galeria
          </Link>
        </p>
      </SiteShell>
    );
  }

  const album = albumMeta!;
  const related = allAlbums.filter((a) => a.slug !== album.slug);
  const start = (safePage - 1) * PHOTOS_PER_PAGE;
  const pagePhotos = photos.slice(start, start + PHOTOS_PER_PAGE);

  return (
    <SiteShell
      title="Galeria"
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: "Galeria", href: "/galeria" },
        { label: album.title },
      ]}
      bannerImages={
        photos.length > 0
          ? photos.slice(0, 12).map((photo) => photo.url)
          : album.image
            ? [album.image]
            : undefined
      }
    >
      {loading ? (
        <div className="flex justify-center py-20 mb-8">
          <div className="w-10 h-10 border-4 border-[#a21b7e]/30 border-t-[#a21b7e] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {pagePhotos.map((photo, index) => {
              const globalIndex = start + index;
              return (
                <button
                  key={`${photo.id}-${globalIndex}`}
                  type="button"
                  onClick={() => setLightboxIndex(globalIndex)}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-md bg-gray-100 group text-left w-full"
                  aria-label={`Ver imagem ${globalIndex + 1} de ${album.title}`}
                >
                  <img
                    src={driveDisplayUrl(photo.url, "sm")}
                    alt={`${album.title} ${globalIndex + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 mb-12"
              aria-label="Paginação de fotos"
            >
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:border-[#a21b7e] hover:text-[#a21b7e] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goToPage(n)}
                  aria-current={safePage === n ? "page" : undefined}
                  className={`min-w-[2.5rem] h-10 px-3 text-sm rounded-lg border transition-colors ${
                    safePage === n
                      ? "bg-[#a21b7e] border-[#a21b7e] text-white"
                      : "border-gray-200 text-gray-700 hover:border-[#a21b7e] hover:text-[#a21b7e]"
                  }`}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:border-[#a21b7e] hover:text-[#a21b7e] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Seguinte
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}

      {related.length > 0 && (
        <section className="w-screen relative left-1/2 -translate-x-1/2 bg-[#f5f5f5] py-10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-6 text-left">Ver mais álbuns</h2>
            <GalleryAlbumCarousel albums={related} />
          </div>
        </section>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          activeIndex={lightboxIndex}
          albumTitle={album.title}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
    </SiteShell>
  );
}
