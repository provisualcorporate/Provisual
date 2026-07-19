import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "./SiteBreadcrumb.types";
import SiteBannerSlideshow from "./SiteBannerSlideshow";
import { DEFAULT_INTERIOR_BANNER } from "../../lib/siteNav";
import { driveDisplayUrl } from "../../lib/driveImageUrl";
import { fetchSiteHomeContent } from "../../lib/siteGalleryApi";

interface SitePageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  bannerImage?: string;
  bannerImages?: string[];
  kicker?: string;
  heading?: ReactNode;
  description?: string;
}

function BannerBreadcrumbs({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Caminho" className="mt-1">
      <ol className="flex flex-wrap items-center justify-center gap-1 text-sm text-white/75">
        {breadcrumbs.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight size={12} className="text-white/40 shrink-0" />}
            {item.href ? (
              <Link to={item.href} className="hover:text-white transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-white/90">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function SitePageHeader({
  title,
  breadcrumbs,
  bannerImage,
  bannerImages,
  kicker,
  heading,
  description,
}: SitePageHeaderProps) {
  const [defaultBanner, setDefaultBanner] = useState(DEFAULT_INTERIOR_BANNER);
  const slideshowImages = bannerImages?.filter(Boolean);
  const singleImage = bannerImage || (!slideshowImages?.length ? defaultBanner : undefined);
  const isRichBanner = Boolean(kicker || heading || description);

  useEffect(() => {
    if (bannerImage || slideshowImages?.length) return;
    fetchSiteHomeContent()
      .then((content) => {
        const bg = content.processBackground;
        if (bg && (bg.includes("/api/drive/") || /^https?:\/\//i.test(bg))) {
          setDefaultBanner(bg);
        }
      })
      .catch(() => {});
  }, [bannerImage, slideshowImages?.length]);

  return (
    <div className="relative h-[250px] overflow-hidden text-white">
      <div className="absolute inset-0 bg-black" aria-hidden="true" />

      {slideshowImages && slideshowImages.length > 0 ? (
        <SiteBannerSlideshow images={slideshowImages} />
      ) : singleImage ? (
        <img
          src={driveDisplayUrl(singleImage, "lg")}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center sm:px-6">
        {isRichBanner ? (
          <div className="site-interior-banner-rich flex w-full max-w-3xl flex-col items-center justify-center">
            {kicker && (
              <div className="site-section-kicker site-section-kicker--center mb-0 gap-3">
                <span className="site-section-kicker-line site-section-kicker-line--light" aria-hidden="true" />
                <p className="site-interior-banner-kicker text-[#e888c8]">{kicker}</p>
                <span className="site-section-kicker-line site-section-kicker-line--light" aria-hidden="true" />
              </div>
            )}

            <h1 className="site-interior-banner-title site-interior-banner-title--rich mb-0 text-white">
              {heading ?? title}
            </h1>

            {description && (
              <p className="site-interior-banner-desc mb-0 max-w-2xl text-white/85">
                {description}
              </p>
            )}

            {breadcrumbs && breadcrumbs.length > 0 && <BannerBreadcrumbs breadcrumbs={breadcrumbs} />}
          </div>
        ) : (
          <>
            <h1 className="site-interior-banner-title mb-0 text-white">{title}</h1>
            {breadcrumbs && breadcrumbs.length > 0 && <BannerBreadcrumbs breadcrumbs={breadcrumbs} />}
          </>
        )}
      </div>
    </div>
  );
}
