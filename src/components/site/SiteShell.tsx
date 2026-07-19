import React, { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoHorizontal from "../../Logo/logo_horizontal_clean.png";
import { SITE_NAV_LINKS } from "../../lib/siteNav";
import SitePageHeader from "./SitePageHeader";
import type { BreadcrumbItem } from "./SiteBreadcrumb.types";
import SiteFooter from "./SiteFooter";
import SiteOffCanvasMenu from "./SiteOffCanvasMenu";
import SiteSectionLink from "./SiteSectionLink";

interface SiteShellProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  bannerImage?: string;
  bannerImages?: string[];
  bannerKicker?: string;
  bannerHeading?: ReactNode;
  bannerDescription?: string;
}

export default function SiteShell({
  children,
  title,
  breadcrumbs,
  bannerImage,
  bannerImages,
  bannerKicker,
  bannerHeading,
  bannerDescription,
}: SiteShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-bg min-h-screen text-gray-900 font-sans">
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 h-[70px] grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link to="/" className="shrink-0 flex items-center h-full">
            <img src={logoHorizontal} alt="ProVisual Corporate" className="h-10 w-auto object-contain" />
          </Link>

          <nav className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-wrap">
            {SITE_NAV_LINKS.map((link) => (
              <SiteSectionLink
                key={link.href}
                href={link.href}
                className="site-nav-link"
              >
                {link.label}
              </SiteSectionLink>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <Link to="/login" className="site-btn-login hidden lg:inline-flex">
              Entrar
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-1.5 text-gray-700"
              aria-label="Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <SiteOffCanvasMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          tone="light"
          loginHref="/login"
          loginLabel="Entrar"
          links={SITE_NAV_LINKS.map((link) => ({
            href: link.href,
            label: link.label,
          }))}
        />
      </header>

      {title && (
        <SitePageHeader
          title={title}
          breadcrumbs={breadcrumbs}
          bannerImage={bannerImage}
          bannerImages={bannerImages}
          kicker={bannerKicker}
          heading={bannerHeading}
          description={bannerDescription}
        />
      )}

      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14">{children}</main>

      <SiteFooter />
    </div>
  );
}
