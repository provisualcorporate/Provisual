import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronUp } from "lucide-react";
import logoColorido from "../../Logo/logo_horizontal.png";
import { FOOTER_LINK_COLUMNS } from "../../lib/siteNav";
import FooterMapBlock from "./FooterMapBlock";
import HomeLeavingLink from "../HomeLeavingLink";
import SiteSectionLink from "./SiteSectionLink";
import { isHomeSectionHref } from "../../lib/siteSectionNav";
import { cn } from "../../lib/utils";

export default function SiteFooter() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const isHome = useLocation().pathname === "/";
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (isHome) {
      const hero = document.getElementById("inicio");
      if (!hero) {
        setShowScrollTop(true);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          setShowScrollTop(!entry.isIntersecting);
        },
        { threshold: 0.15 },
      );

      observer.observe(hero);
      return () => observer.disconnect();
    }

    const onScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <>
      <div className="h-[5px] bg-[#a21b7e]" aria-hidden="true" />

      <section className="bg-[#2a2a2a] text-gray-300">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14 grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div>
            <Link to="/" className="inline-block mb-5">
              <img src={logoColorido} alt="ProVisual Corporate" className="h-12 w-auto object-contain brightness-110" />
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              Entre qualidade e eficiência — somos referência em produção de conteúdos criativos e
              estratégicos que fortalecem a presença das marcas em Moçambique.
            </p>
          </div>

          {FOOTER_LINK_COLUMNS.map((column) => (
            <div key={column.title} className={column.title === "Navegação" ? "pl-[40px]" : undefined}>
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">{column.title}</h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {isHomeSectionHref(link.href) ? (
                      <SiteSectionLink href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {link.label}
                      </SiteSectionLink>
                    ) : link.href.startsWith("/") && !link.href.includes("#") ? (
                      isHome ? (
                        <HomeLeavingLink to={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                          {link.label}
                        </HomeLeavingLink>
                      ) : (
                        <Link to={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                          {link.label}
                        </Link>
                      )
                    ) : (
                      <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <FooterMapBlock />
        </div>
      </section>

      <div className="bg-black text-gray-400 text-xs sm:text-sm py-4">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 text-center">
          <p>
            Copyright © Provisual Corporate {new Date().getFullYear()} | todos os direitos reservados |
            Desenvolvido por:{" "}
            <a
              href="https://visualdesigne.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              VisualDesign Services. Lda
            </a>
          </p>
        </div>
      </div>

      <div
        className={cn(
          "fixed bottom-6 right-6 z-[90] flex flex-col gap-3 transition-all duration-300",
          showScrollTop ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={scrollTop}
          aria-label="Voltar ao topo"
          className="w-12 h-12 rounded-full bg-[#a21b7e] text-white flex items-center justify-center shadow-lg hover:bg-[#8e176e] transition-colors"
        >
          <ChevronUp size={24} />
        </button>
      </div>
    </>
  );
}
