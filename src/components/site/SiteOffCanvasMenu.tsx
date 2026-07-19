import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { getSectionIdFromHref, scrollToSection } from "../../lib/siteSectionNav";

export interface OffCanvasNavLink {
  href: string;
  label: string;
  onNavigate?: () => void;
}

interface SiteOffCanvasMenuProps {
  open: boolean;
  onClose: () => void;
  links: OffCanvasNavLink[];
  /** home = sobre hero escuro; light = páginas internas */
  tone?: "home" | "home-scrolled" | "light";
  loginHref?: string;
  loginLabel?: string;
}

export default function SiteOffCanvasMenu({
  open,
  onClose,
  links,
  tone = "light",
  loginHref,
  loginLabel = "Entrar",
}: SiteOffCanvasMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panelClass =
    tone === "light" || tone === "home-scrolled"
      ? "bg-white text-gray-800"
      : "bg-[#1a0a12]/95 text-white backdrop-blur-md";

  const linkClass =
    tone === "light" || tone === "home-scrolled"
      ? "text-gray-700 hover:text-[#a21b7e] hover:bg-[#a21b7e]/5"
      : "text-white/90 hover:text-white hover:bg-white/10";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-[60] bg-black/45 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className={cn(
              "fixed top-0 right-0 z-[70] flex h-full w-[min(288px,84vw)] flex-col shadow-2xl lg:hidden",
              panelClass,
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            aria-hidden={!open}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-widest opacity-70">Menu</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 opacity-80 hover:opacity-100"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    const sectionId = getSectionIdFromHref(link.href);
                    if (link.onNavigate) {
                      e.preventDefault();
                      link.onNavigate();
                    } else if (sectionId) {
                      e.preventDefault();
                      if (location.pathname === "/") {
                        scrollToSection(sectionId, "smooth");
                      } else {
                        navigate({ pathname: "/", hash: `#${sectionId}` });
                      }
                    }
                    onClose();
                  }}
                  className={cn(
                    "site-nav-link rounded-lg px-3 py-2",
                    linkClass,
                  )}
                >
                  {link.label}
                </a>
              ))}
              {loginHref && (
                <Link
                  to={loginHref}
                  onClick={onClose}
                  className={cn(
                    "site-btn-login mt-2 self-start",
                    tone === "light" || tone === "home-scrolled" ? "" : "bg-white/15 hover:bg-white/25",
                  )}
                >
                  {loginLabel}
                </Link>
              )}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
