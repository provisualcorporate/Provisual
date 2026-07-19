import React, { useState, useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Facebook,
  Linkedin,
  Youtube,
  Sparkles,
  HardDrive,
  Lightbulb,
  ClipboardList,
  Cog,
  PackageCheck,
  Instagram,
} from "lucide-react";
import logoHorizontal from "../Logo/logo_horizontal_clean.png";
import QuickLinkIcon from "./site/QuickLinkIcon";
import SiteFooter from "./site/SiteFooter";
import TypewriterTitle from "./site/TypewriterTitle";
import { QUICK_LINK_ROUTES } from "../lib/siteNav";
import { SERVICE_ITEMS, VIDEO_ITEMS, type VideoItem } from "../lib/sitePages";
import {
  DEFAULT_HOME_CONTENT,
  type HomeContent,
} from "../lib/homeContent";
import { fetchSiteHomeContent, fetchSiteVideos } from "../lib/siteGalleryApi";
import { driveDisplayUrl } from "../lib/driveImageUrl";
import { homeDisplayImage, isDriveProxyImageUrl } from "../lib/homeImageFallback";
import SiteOffCanvasMenu from "./site/SiteOffCanvasMenu";
import SiteSectionLink from "./site/SiteSectionLink";
import OptimizedDriveImage from "./site/OptimizedDriveImage";
import AboutSection from "./site/AboutSection";
import HomeLeavingLink from "./HomeLeavingLink";
import SiteYoutubePlayer from "./site/SiteYoutubePlayer";
import { cn } from "../lib/utils";
import {
  clearHomeScrollRestore,
  restoreHomeScrollIfPending,
} from "../lib/homeScrollRestore";
import { scrollToHomeSectionWhenReady, scrollToSection } from "../lib/siteSectionNav";
import FormAntiSpamFields from "./FormAntiSpamFields";
import {
  formSpamUserMessage,
  recordFormSubmit,
  shouldBlockFormSubmit,
} from "../lib/formSpamGuard";
import { youtubeThumbnail } from "../lib/youtubeEmbed";

const NAV_LINKS = [
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#processo-criativo", label: "Processo" },
  { href: "/#equipa", label: "Equipa" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/#videos", label: "Videos" },
  { href: "/#eventos", label: "Cobertura" },
  { href: "/#contactos", label: "Contactos" },
];

const SOCIAL_LINKS = [
  { href: "https://www.facebook.com/profile.php?id=61577619669570", icon: Facebook, label: "Facebook" },
  { href: "https://mz.linkedin.com/in/provisual-corporate-493342353", icon: Linkedin, label: "Linkedin" },
  { href: "https://wa.me/+258863076065", icon: "whatsapp" as const, label: "Whatsapp" },
  { href: "https://youtu.be/DVgtNr_bq1g", icon: Youtube, label: "Youtube" },
];

function WhatsAppIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function SocialIcon({ icon, size = 16 }: { icon: typeof SOCIAL_LINKS[number]["icon"]; size?: number }) {
  if (icon === "whatsapp") return <WhatsAppIcon size={size} />;
  const Icon = icon;
  return <Icon size={size} />;
}

function getHomeImageSrc(url: string, size: "sm" | "md" | "lg" = "md") {
  if (!url) return url;
  if (/\.svg(\?|$)/i.test(url)) {
    return driveDisplayUrl(url, "full");
  }
  return driveDisplayUrl(url, size);
}

const QUICK_LINKS = QUICK_LINK_ROUTES;

const FEATURED_SERVICES = SERVICE_ITEMS.slice(0, 4);

const SERVICE_CARD_TAG: Record<string, string> = {
  "publicidade-marketing": "Marketing",
  "branding-design": "Branding",
  "fotografia-videografia": "Fotografia",
  "servicos-informaticos": "Serviços digitais",
};

const SERVICE_CARD_TITLE: Record<string, string> = {
  "publicidade-marketing": "Marketing digital",
};

const PRODUCTION_PROCESS = [
  {
    step: "01",
    title: "Briefing",
    description:
      "Recolhemos a necessidade do cliente, os objectivos a alcançar e o contexto do projecto. Em seguida apresentamos a proposta e o orçamento adequados.",
    icon: Lightbulb,
  },
  {
    step: "02",
    title: "Planeamento",
    description:
      "Organizamos ideias, cronograma e recursos. Definimos a linha criativa, alinhamos expectativas e damos início formal ao projecto.",
    icon: ClipboardList,
  },
  {
    step: "03",
    title: "Execução",
    description:
      "Materializamos a solução proposta com acompanhamento contínuo, garantindo qualidade, rigor e cumprimento dos parâmetros acordados.",
    icon: Cog,
  },
  {
    step: "04",
    title: "Entrega",
    description:
      "Concluímos com a entrega final, validação do cliente e registo das lições aprendidas — incluindo relatório de resultados quando aplicável.",
    icon: PackageCheck,
  },
];

function getQuickLinksVisible(width: number) {
  if (width < 768) return 1;
  if (width < 1024) return 2;
  return 3;
}

function getTeamVisible(width: number) {
  if (width < 768) return 1;
  if (width < 1024) return 2;
  return 2;
}

function getLogoVisible(width: number) {
  if (width < 768) return 2;
  return 6;
}

export default function Home() {
  const navigationType = useNavigationType();
  const location = useLocation();
  const [content, setContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerParallaxY, setBannerParallaxY] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [quickLinkSlide, setQuickLinkSlide] = useState(0);
  const [quickLinkResetting, setQuickLinkResetting] = useState(false);
  const [teamSlide, setTeamSlide] = useState(2);
  const [teamResetting, setTeamResetting] = useState(false);
  const [logoSlide, setLogoSlide] = useState(2);
  const [logoResetting, setLogoResetting] = useState(false);
  const [activeServiceCard, setActiveServiceCard] = useState(0);
  const [activeProcessCard, setActiveProcessCard] = useState(0);
  const [featuredVideoId, setFeaturedVideoId] = useState(VIDEO_ITEMS[0]?.youtubeId ?? "");
  const [videoItems, setVideoItems] = useState<VideoItem[]>(VIDEO_ITEMS);
  const [contactFormNotice, setContactFormNotice] = useState<string | null>(null);
  const contactFormStartedAt = useRef(Date.now());
  const videosSectionRef = useRef<HTMLElement>(null);
  const [quickLinksVisible, setQuickLinksVisible] = useState(() =>
    typeof window !== "undefined" ? getQuickLinksVisible(window.innerWidth) : 3,
  );
  const [teamVisible, setTeamVisible] = useState(() =>
    typeof window !== "undefined" ? getTeamVisible(window.innerWidth) : 2,
  );
  const [logoVisible, setLogoVisible] = useState(() =>
    typeof window !== "undefined" ? getLogoVisible(window.innerWidth) : 6,
  );
  const [bannerSlideSrc, setBannerSlideSrc] = useState(DEFAULT_HOME_CONTENT.slides[0]?.image || "");

  const quickLinkExtended = useMemo(
    () => [...QUICK_LINKS, ...QUICK_LINKS.slice(0, quickLinksVisible)],
    [quickLinksVisible],
  );
  const quickLinkMaxSlide = QUICK_LINKS.length;

  const teamMembers = content.teamMembers;

  const teamExtended = useMemo(
    () => [
      ...teamMembers.slice(-teamVisible),
      ...teamMembers,
      ...teamMembers.slice(0, teamVisible),
    ],
    [teamMembers, teamVisible],
  );
  const teamStart = teamVisible;
  const teamEnd = teamStart + teamMembers.length;
  const teamResetBack = teamEnd - teamVisible;

  const clientLogos = content.clientLogos;

  const logoExtended = useMemo(
    () => [
      ...clientLogos.slice(-logoVisible),
      ...clientLogos,
      ...clientLogos.slice(0, logoVisible),
    ],
    [clientLogos, logoVisible],
  );
  const logoStart = logoVisible;
  const logoEnd = logoStart + clientLogos.length;
  const logoResetBack = logoEnd - logoVisible;

  const homeVideos = useMemo(() => videoItems.slice(0, 3), [videoItems]);
  const sideVideos = useMemo(
    () => homeVideos.filter((video) => video.youtubeId !== featuredVideoId),
    [homeVideos, featuredVideoId],
  );

  useEffect(() => {
    const onResize = () => {
      const nextQuick = getQuickLinksVisible(window.innerWidth);
      const nextTeam = getTeamVisible(window.innerWidth);
      const nextLogo = getLogoVisible(window.innerWidth);
      setQuickLinksVisible((prev) => (prev === nextQuick ? prev : nextQuick));
      setTeamVisible((prev) => (prev === nextTeam ? prev : nextTeam));
      setLogoVisible((prev) => (prev === nextLogo ? prev : nextLogo));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setQuickLinkSlide(0);
    setQuickLinkResetting(false);
  }, [quickLinksVisible]);

  useEffect(() => {
    setTeamSlide(teamStart);
    setTeamResetting(false);
  }, [teamVisible, teamStart]);

  useEffect(() => {
    setLogoSlide(logoStart);
    setLogoResetting(false);
  }, [logoVisible, logoStart, clientLogos.length]);

  useEffect(() => {
    fetchSiteHomeContent().then(setContent).catch(() => setContent(DEFAULT_HOME_CONTENT));
  }, []);

  useEffect(() => {
    fetchSiteVideos()
      .then((videos) => {
        setVideoItems(videos);
        const first = videos[0]?.youtubeId;
        if (first) setFeaturedVideoId(first);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!homeVideos.some((video) => video.youtubeId === featuredVideoId)) {
      const fallback = homeVideos[0]?.youtubeId;
      if (fallback) setFeaturedVideoId(fallback);
    }
  }, [homeVideos, featuredVideoId]);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      restoreHomeScrollIfPending();
      return;
    }
    clearHomeScrollRestore();
  }, [navigationType]);

  useEffect(() => {
    const BANNER_HEIGHT = 730;

    const onScroll = () => {
      const scrollY = window.scrollY;
      const bannerScroll = Math.min(scrollY, BANNER_HEIGHT);
      setBannerParallaxY(bannerScroll * 0.45);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (content.slides.length <= 1) return;
    const t = setInterval(() => {
      setSlideIndex((i) => (i + 1) % content.slides.length);
    }, 15000);
    return () => clearInterval(t);
  }, [content.slides.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setQuickLinkSlide((i) => i + 1);
    }, 7500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (quickLinkSlide !== quickLinkMaxSlide) return;
    const t = setTimeout(() => {
      setQuickLinkResetting(true);
      setQuickLinkSlide(0);
      requestAnimationFrame(() => setQuickLinkResetting(false));
    }, 520);
    return () => clearTimeout(t);
  }, [quickLinkSlide, quickLinkMaxSlide]);

  useEffect(() => {
    const t = setInterval(() => {
      setTeamSlide((i) => i + 1);
    }, 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (teamSlide !== teamEnd) return;
    const t = setTimeout(() => {
      setTeamResetting(true);
      setTeamSlide(teamStart);
      requestAnimationFrame(() => setTeamResetting(false));
    }, 520);
    return () => clearTimeout(t);
  }, [teamSlide, teamEnd, teamStart]);

  useEffect(() => {
    if (teamSlide !== teamStart - teamVisible) return;
    const t = setTimeout(() => {
      setTeamResetting(true);
      setTeamSlide(teamResetBack);
      requestAnimationFrame(() => setTeamResetting(false));
    }, 520);
    return () => clearTimeout(t);
  }, [teamSlide, teamStart, teamVisible, teamResetBack]);

  useEffect(() => {
    const t = setInterval(() => {
      setLogoSlide((i) => i + 1);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (logoSlide !== logoEnd) return;
    const t = setTimeout(() => {
      setLogoResetting(true);
      setLogoSlide(logoStart);
      requestAnimationFrame(() => setLogoResetting(false));
    }, 520);
    return () => clearTimeout(t);
  }, [logoSlide, logoEnd, logoStart]);

  useEffect(() => {
    if (logoSlide !== logoStart - logoVisible) return;
    const t = setTimeout(() => {
      setLogoResetting(true);
      setLogoSlide(logoResetBack);
      requestAnimationFrame(() => setLogoResetting(false));
    }, 520);
    return () => clearTimeout(t);
  }, [logoSlide, logoStart, logoVisible, logoResetBack]);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const sectionId = href.replace("/#", "").replace("#", "");
    scrollToSection(sectionId, "smooth");
  };

  useEffect(() => {
    if (location.pathname !== "/") return;
    const sectionId = location.hash.replace("#", "");
    if (!sectionId) return;
    scrollToHomeSectionWhenReady(sectionId, "smooth");
  }, [location.pathname, location.hash]);

  const activeSlide = content.slides[slideIndex] ?? content.slides[0];
  const slideStaticSrc = useMemo(() => {
    const fallback =
      DEFAULT_HOME_CONTENT.slides[slideIndex % DEFAULT_HOME_CONTENT.slides.length]?.image ||
      DEFAULT_HOME_CONTENT.hero.backgroundImage;
    return homeDisplayImage(
      activeSlide?.image || fallback,
      fallback,
    );
  }, [activeSlide?.image, slideIndex]);

  const slideImageSrc = useMemo(() => {
    if (!isDriveProxyImageUrl(slideStaticSrc)) return slideStaticSrc;
    return driveDisplayUrl(slideStaticSrc, "md");
  }, [slideStaticSrc]);

  useEffect(() => {
    setBannerSlideSrc(slideImageSrc);
  }, [slideImageSrc]);

  const prevSlide = () =>
    setSlideIndex((i) => (i - 1 + content.slides.length) % content.slides.length);
  const nextSlide = () => setSlideIndex((i) => (i + 1) % content.slides.length);

  return (
    <div className="site-bg min-h-screen overflow-x-hidden text-gray-900 font-sans">
      <header className="fixed inset-x-0 top-0 z-50 h-[70px] border-b border-gray-100 bg-white shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-full grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <a href="#inicio" onClick={() => scrollTo("#inicio")} className="shrink-0 flex items-center h-full">
            <img
              src={logoHorizontal}
              alt="ProVisual Corporate"
              className="h-10 w-auto object-contain transition-all duration-500"
            />
          </a>

          <nav className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-wrap">
            {NAV_LINKS.map((link) => (
              <SiteSectionLink
                key={link.href}
                href={link.href}
                className="site-nav-link transition-colors duration-500"
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
              className="p-1.5 text-gray-700 transition-colors duration-500 lg:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        <SiteOffCanvasMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          tone="home-scrolled"
          loginHref="/login"
          loginLabel="Entrar"
          links={NAV_LINKS.map((link) => ({
            href: link.href,
            label: link.label,
          }))}
        />
      </header>
      <div className="h-[70px] shrink-0" aria-hidden="true" />

      <section id="inicio" className="relative h-[730px] overflow-hidden text-white">
        <AnimatePresence initial={false}>
          <motion.img
            key={bannerSlideSrc}
            src={bannerSlideSrc}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            fetchPriority="high"
            decoding="async"
            onError={() => {
              if (slideStaticSrc && bannerSlideSrc !== slideStaticSrc) {
                setBannerSlideSrc(slideStaticSrc);
              }
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{
              transformOrigin: "center center",
              transform: `translate3d(0, ${bannerParallaxY}px, 0) scale(1.12)`,
            }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/55" />

        <button
          type="button"
          onClick={prevSlide}
          className="group absolute left-3 sm:left-[70px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3d001d] flex items-center justify-center hover:bg-[#8e176e] transition-colors"
          aria-label="Slide anterior"
        >
          <ChevronLeft size={24} className="text-[#c958a8] group-hover:text-white transition-colors" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={nextSlide}
          className="group absolute right-3 sm:right-[70px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3d001d] flex items-center justify-center hover:bg-[#8e176e] transition-colors"
          aria-label="Slide seguinte"
        >
          <ChevronRight size={24} className="text-[#c958a8] group-hover:text-white transition-colors" strokeWidth={2.25} />
        </button>

        <div className="relative z-10 flex h-full flex-col items-center px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10">
          <div className="text-center w-full mt-8 sm:mt-12 md:mt-16">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-5">
                <span className="h-px w-10 bg-white/60" />
                <p className="site-antetitle font-normal text-white/90">
                  {activeSlide?.category}
                </p>
                <span className="h-px w-10 bg-white/60" />
              </div>

              <TypewriterTitle
                text={activeSlide?.title ?? ""}
                className="text-3xl md:text-5xl lg:text-[3.25rem] font-bold leading-tight max-w-4xl mb-8 text-white min-h-[1.2em]"
                speedMs={90}
                deleteSpeedMs={14}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="#contactos"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("#contactos");
                }}
                className="inline-flex items-center bg-[#a21b7e] text-white text-sm font-normal px-8 py-3 rounded-full hover:bg-[#8e176e] transition-colors"
              >
                Siga-nos
              </a>
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map(({ href, icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full bg-[#a21b7e] text-white flex items-center justify-center hover:bg-[#8e176e] transition-colors"
                  >
                    <SocialIcon icon={icon} size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Carrossel — 1 card mobile, 2 tablet, 3 desktop */}
          <div className="mt-10 mb-12 w-[76%] max-w-[1200px] shrink-0 sm:mt-16 sm:mb-20 sm:w-full md:w-[85%] lg:w-[60%]">
            <div className="overflow-hidden w-full">
              <motion.div
                className="flex"
                style={{
                  width: `${(quickLinkExtended.length / quickLinksVisible) * 100}%`,
                }}
                animate={{
                  x: `-${quickLinkSlide * (100 / quickLinkExtended.length)}%`,
                }}
                transition={
                  quickLinkResetting
                    ? { duration: 0 }
                    : { duration: 0.5, ease: "easeInOut" }
                }
              >
                {quickLinkExtended.map((item, index) => {
                  const card = (
                    <div className="quick-link-candy h-full rounded-2xl">
                      <div className="quick-link-candy-gradient" aria-hidden="true" />
                      <div className="quick-link-candy-inner bg-white py-4 px-2 text-center h-full flex flex-col items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_36px_rgba(162,27,126,0.18)] transition-all duration-300 active:scale-[0.98] cursor-pointer">
                        <QuickLinkIcon type={item.icon} />
                        <h3 className="text-[#a21b7e] text-xl font-bold leading-none mt-2">{item.label}</h3>
                        <p className="text-[#737373] text-sm font-normal leading-snug mt-1 px-1">{item.description}</p>
                      </div>
                    </div>
                  );

                  const cardKey = `${item.label}-${index}`;
                  const slotWidth = 100 / quickLinkExtended.length;

                  return (
                    <div
                      key={cardKey}
                      className="shrink-0 box-border px-1.5 md:px-2.5"
                      style={{ width: `${slotWidth}%` }}
                    >
                      <HomeLeavingLink to={item.to} className="block h-full group" aria-label={`Abrir ${item.label}`}>
                        {card}
                      </HomeLeavingLink>
                    </div>
                  );
                })}
              </motion.div>
            </div>

            <div className="flex justify-center gap-2.5 mt-5">
              {QUICK_LINKS.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setQuickLinkSlide(index)}
                  aria-label={`Mostrar card ${item.label}`}
                  aria-current={quickLinkSlide % QUICK_LINKS.length === index ? "true" : undefined}
                  className={`h-2.5 rounded-full transition-all ${
                    quickLinkSlide % QUICK_LINKS.length === index
                      ? "w-7 bg-white/90"
                      : "w-2.5 bg-white/30 hover:bg-white/45"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* Container branco — secção Sobre nós completa */}
      <div className="relative z-20 -mt-[50px] mb-[75px] max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_5px_5px_5px_rgba(0,0,0,0.08)]">
          <AboutSection content={content} />
        </div>
      </div>

      <section
        id="processo-criativo"
        className="relative scroll-mt-[75px] overflow-hidden py-24 lg:py-28"
      >
        <div
          className="process-section-kenburns absolute inset-0"
          style={{ backgroundImage: `url(${driveDisplayUrl(content.processBackground, "md")})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#3d001d]/55" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="site-section-header site-section-header--center">
            <div className="site-section-kicker site-section-kicker--center">
              <span className="site-section-kicker-line site-section-kicker-line--light" />
              <p className="site-antetitle text-[#e888c8]">Como trabalhamos</p>
              <span className="site-section-kicker-line site-section-kicker-line--light" />
            </div>
            <h2 className="site-section-title text-white">
              Nosso <span className="font-light text-white/85">Processo Criativo</span>
            </h2>
            <p className="site-section-desc text-white/85">
              Do briefing à entrega de resultados, acrescentamos valor às suas estratégias com rigor,
              criatividade e acompanhamento em cada etapa.
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute left-[6%] right-[6%] top-[72px] hidden h-px border-t border-dashed border-white/35 lg:block"
              aria-hidden="true"
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-stretch lg:gap-5">
              {PRODUCTION_PROCESS.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeProcessCard === index;

                return (
                  <article
                    key={item.step}
                    onMouseEnter={() => setActiveProcessCard(index)}
                    className={cn(
                      "relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-[#a21b7e] bg-white shadow-[0_8px_24px_rgba(162,27,126,0.22),0_2px_10px_rgba(162,27,126,0.12)] transition-shadow duration-500",
                      isActive &&
                        "shadow-[0_12px_30px_rgba(162,27,126,0.3),0_4px_14px_rgba(162,27,126,0.18)]",
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-between px-6 py-5">
                      <div
                        className={cn(
                          "flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-full border-2 border-[#a21b7e] bg-[#a21b7e]/10 p-2.5 transition-colors duration-300",
                          isActive && "border-[#3d001d] bg-[#3d001d]",
                        )}
                      >
                        <Icon
                          size={28}
                          strokeWidth={1.75}
                          className={cn(
                            "text-[#a21b7e] transition-colors duration-300",
                            isActive && "text-white",
                          )}
                        />
                      </div>
                      <span className="text-[4.75rem] font-bold leading-none tabular-nums text-[#a21b7e]/15">
                        {item.step}
                      </span>
                    </div>

                    <div className="relative flex min-h-[11rem] flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
                      <div
                        className={cn(
                          "absolute inset-0 bg-[#3d001d]/90 transition-transform duration-300 ease-out",
                          isActive
                            ? "translate-y-0 border-b-2 border-[#a21b7e]"
                            : "translate-y-full",
                        )}
                        aria-hidden="true"
                      />

                      <h3
                        className={cn(
                          "relative z-10 mb-3 text-[1.35rem] font-extrabold leading-snug text-[#2a2a2a] transition-colors duration-300 sm:text-2xl",
                          isActive && "text-white",
                        )}
                      >
                        {item.title}
                      </h3>
                      <p
                        className={cn(
                          "relative z-10 flex-1 text-sm leading-relaxed text-gray-600 transition-colors duration-300",
                          isActive && "text-white/85",
                        )}
                      >
                        {item.description}
                      </p>
                    </div>

                    {index < PRODUCTION_PROCESS.length - 1 && (
                      <div
                        className="absolute -bottom-3 left-1/2 h-6 w-px -translate-x-1/2 bg-white/40 lg:hidden"
                        aria-hidden="true"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="equipa" className="scroll-mt-[75px] overflow-x-hidden py-12 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-stretch lg:gap-10">
            <div className="relative z-10 flex flex-col justify-center lg:-mr-[68px] lg:py-[45px] xl:-mr-[84px]">
              <div className="flex w-full flex-col items-start justify-center rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] sm:p-8">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Nossa equipa</span>
                  <span className="h-px w-8 bg-[#D7D7D7]" />
                </div>

                <h2 className="mb-3 text-4xl font-bold leading-tight text-[#333] sm:text-5xl lg:text-[3.25rem]">
                  Criatividade & <span className="font-light">Excelência</span>
                </h2>

                <h3 className="text-lg font-bold text-[#333]">
                  Profissionais <span className="font-light">dedicados</span>
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
                  Profissionais multidisciplinares unidos pela criatividade, precisão técnica e
                  compromisso com resultados que fortalecem a presença das marcas em Moçambique.
                </p>

                <Link
                  to="/#contactos"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("#contactos");
                  }}
                  className="mt-6 inline-flex self-start items-center gap-2 rounded-lg bg-[#a21b7e] px-8 py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-[#8e176e]"
                >
                  Contacte-nos
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            <div className="relative z-0 box-border flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-[#a21b7e]/18 bg-[#a21b7e]/[0.025] px-2 py-4 shadow-[0_8px_24px_4px_rgba(0,0,0,0.12)] sm:min-h-[370px] sm:px-4 lg:min-h-0 lg:px-4 lg:pl-14">
              <div className="flex w-full max-w-full items-center justify-center gap-1 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setTeamSlide((i) => i - 1)}
                  aria-label="Profissional anterior"
                  className="relative z-10 flex h-11 w-11 shrink-0 self-center items-center justify-center rounded-full bg-[#3d001d] text-[#c958a8] transition-colors hover:bg-[#8e176e] hover:text-white"
                >
                  <ChevronLeft size={20} strokeWidth={2.25} />
                </button>

                <div className="team-carousel-viewport relative z-10 min-w-0 flex-1 overflow-hidden">
                  <motion.div
                    className="flex items-center"
                    style={{
                      width: `${(teamExtended.length / teamVisible) * 100}%`,
                    }}
                    animate={{
                      x: `-${teamSlide * (100 / teamExtended.length)}%`,
                    }}
                    transition={
                      teamResetting
                        ? { duration: 0 }
                        : { duration: 0.5, ease: "easeInOut" }
                    }
                  >
                    {teamExtended.map((member, index) => (
                      <div
                        key={`${member.name}-${index}`}
                        className="box-border flex shrink-0 justify-center px-1.5 sm:px-2"
                        style={{ width: `${100 / teamExtended.length}%` }}
                      >
                        <article className="team-card-shadow mx-auto flex w-full max-w-[220px] flex-col overflow-hidden border border-[#a21b7e]/12 bg-white sm:max-w-[260px]">
                          <div className="relative h-[230px] shrink-0 overflow-hidden sm:h-[282px]">
                            <OptimizedDriveImage
                              src={member.image}
                              alt={member.name}
                              size="sm"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="h-2 shrink-0 bg-[#a21b7e]" aria-hidden="true" />
                          <div className="flex shrink-0 flex-col items-center justify-center px-3 py-3 text-center">
                            <h4 className="flex items-center justify-center gap-2 text-base font-bold text-[#333] sm:gap-3 sm:text-lg">
                              <span className="h-px w-7 bg-[#a21b7e] sm:w-9" aria-hidden="true" />
                              {member.name}
                              <span className="h-px w-7 bg-[#a21b7e] sm:w-9" aria-hidden="true" />
                            </h4>
                            <p className="mt-1 text-sm text-[#a21b7e]">{member.role}</p>
                            <div className="mt-2 flex justify-center gap-2.5">
                              <a
                                href={member.social.facebook}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Facebook de ${member.name}`}
                                className="text-[#a21b7e] transition-colors hover:text-[#8e176e]"
                              >
                                <Facebook size={15} strokeWidth={2} />
                              </a>
                              <a
                                href={member.social.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`LinkedIn de ${member.name}`}
                                className="text-[#a21b7e] transition-colors hover:text-[#8e176e]"
                              >
                                <Linkedin size={15} strokeWidth={2} />
                              </a>
                              <a
                                href={member.social.instagram}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Instagram de ${member.name}`}
                                className="text-[#a21b7e] transition-colors hover:text-[#8e176e]"
                              >
                                <Instagram size={15} strokeWidth={2} />
                              </a>
                            </div>
                          </div>
                        </article>
                      </div>
                    ))}
                  </motion.div>
                </div>

                <button
                  type="button"
                  onClick={() => setTeamSlide((i) => i + 1)}
                  aria-label="Profissional seguinte"
                  className="relative z-10 flex h-11 w-11 shrink-0 self-center items-center justify-center rounded-full bg-[#3d001d] text-[#c958a8] transition-colors hover:bg-[#8e176e] hover:text-white"
                >
                  <ChevronRight size={20} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicos" className="relative scroll-mt-[75px] bg-white pb-14 lg:pb-16">
        <div className="relative h-[310px] overflow-hidden sm:h-[350px] lg:h-[380px]">
          <OptimizedDriveImage
            src={content.teamBanner}
            alt=""
            aria-hidden="true"
            size="lg"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#3d001d]/82" aria-hidden="true" />
          <div className="absolute inset-0 bg-[#a21b7e]/35" aria-hidden="true" />

          <div className="relative z-10 flex h-full flex-col items-center justify-start px-6 pb-8 pt-[75px] text-center text-white sm:pb-10 lg:pb-12">
            <div className="site-section-kicker site-section-kicker--center">
              <span className="site-section-kicker-line site-section-kicker-line--light" aria-hidden="true" />
              <p className="site-antetitle text-[#e888c8]">Serviços</p>
              <span className="site-section-kicker-line site-section-kicker-line--light" aria-hidden="true" />
            </div>
            <h2 className="site-section-title max-w-3xl text-white">
              Soluções integradas <span className="font-light text-white/85">para si</span>
            </h2>
            <p className="site-section-desc mb-[50px] max-w-2xl text-white/85">
              {content.servicesIntro}
            </p>
          </div>
        </div>

        <div className="relative mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:-mt-14 md:gap-5 lg:-mt-20 lg:grid-cols-4 lg:gap-4 xl:-mt-24">
            {FEATURED_SERVICES.map((service, index) => {
              const isActive = activeServiceCard === index;
              const showCta = isActive;

              return (
                <article
                  key={service.slug}
                  onMouseEnter={() => setActiveServiceCard(index)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl bg-white text-center shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-transform duration-300",
                    isActive ? "-translate-y-1" : "",
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden transition-opacity duration-300",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  >
                    <div className="mx-auto h-32 w-[130%] -translate-y-[58%] rounded-[50%] bg-[#f0e8ec]" />
                  </div>

                  <div className="relative flex flex-col px-5 pt-6 pb-[73px]">
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      <span className="h-px w-6 bg-gray-300" aria-hidden="true" />
                      <p className="text-[15px] font-medium normal-case text-gray-500 sm:text-base">
                        {SERVICE_CARD_TAG[service.slug] ?? service.title.split(" ")[0]}
                      </p>
                      <span className="h-px w-6 bg-gray-300" aria-hidden="true" />
                    </div>
                    <h3 className="relative z-10 mt-2 text-[20px] font-extrabold leading-snug text-[#a21b7e]">
                      {SERVICE_CARD_TITLE[service.slug] ?? service.title}
                    </h3>
                    <p className="relative z-10 mt-3 min-h-[4.5rem] text-[15px] leading-relaxed text-gray-600 line-clamp-4">
                      {service.description}
                    </p>
                  </div>

                  <HomeLeavingLink
                    to={`/servicos/${service.slug}`}
                    className={cn(
                      "absolute inset-x-0 bottom-0 flex h-12 shrink-0 items-center justify-center gap-2 bg-[#a21b7e] px-3 text-sm font-medium text-white transition-all duration-300 ease-out hover:bg-[#8e176e]",
                      showCta
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-full opacity-0 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100",
                    )}
                  >
                    Leia mais
                    <ChevronRight size={16} />
                  </HomeLeavingLink>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="videos"
        ref={videosSectionRef}
        className="scroll-mt-[75px] bg-[#fafafa] py-8 lg:py-10"
      >
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="mt-4 mb-[50px] flex justify-end">
            <HomeLeavingLink
              to="/videos"
              className="inline-flex items-center gap-2 rounded-lg bg-[#a21b7e] px-8 py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-[#8e176e]"
            >
              Ver mais vídeos
              <ChevronRight size={16} />
            </HomeLeavingLink>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch">
            <div className="order-2 grid grid-rows-2 gap-3 lg:order-1 lg:min-h-0">
              {sideVideos.map((video) => (
                <button
                  key={video.slug}
                  type="button"
                  onClick={() => setFeaturedVideoId(video.youtubeId)}
                  className="group relative min-h-[120px] w-full overflow-hidden text-left shadow-md transition-all hover:ring-2 hover:ring-[#a21b7e]/40"
                  aria-label={`Reproduzir ${video.title}`}
                >
                  <img
                    src={youtubeThumbnail(video.youtubeId)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/45" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="line-clamp-2 text-xs font-medium text-white sm:text-sm">{video.title}</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-sm text-white">
                      ▶
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="order-1 w-full lg:order-2">
              <SiteYoutubePlayer
                videoId={featuredVideoId}
                playWhenVisible
                visibilityTargetRef={videosSectionRef}
                saveScrollOnLeave
                className="shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="arquivo" className="relative mt-[40px] scroll-mt-[75px] overflow-hidden bg-[#a21b7e] px-6 py-[50px] text-white">
        <div className="arquivo-section-fx pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="arquivo-grid-lines" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1400px] text-center">
          <div className="relative mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <HardDrive size={24} className="opacity-95" strokeWidth={1.75} />
            <Sparkles
              size={12}
              className="absolute -right-1 -top-1 text-amber-200 arquivo-sparkle-pulse"
              strokeWidth={2}
            />
          </div>
          <div className="site-section-header site-section-header--compact">
            <div className="site-section-kicker site-section-kicker--center">
              <span className="site-section-kicker-line site-section-kicker-line--light" />
              <p className="site-antetitle text-[#e888c8]">Arquivo</p>
              <span className="site-section-kicker-line site-section-kicker-line--light" />
            </div>
            <h2 className="site-section-title text-white">
              Arquivo <span className="font-light text-white/85">ProVisual Corporate</span>
            </h2>
            <p className="site-section-desc mx-auto mb-[30px] max-w-3xl text-white/85 line-clamp-2">
            Guarde, consulte e partilhe fotos e vídeos com a sua equipa num arquivo exclusivo pensado
            para si — o diferencial ProVisual, com arquivo institucional privado e IA integrada.
            </p>
          </div>
          <HomeLeavingLink
            to="/arquivo"
            className="mt-[30px] inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-sm font-medium uppercase tracking-wider text-[#a21b7e] shadow-lg transition-colors hover:bg-white/90"
          >
            Entrar no arquivo
            <ChevronRight size={16} />
          </HomeLeavingLink>
        </div>
      </section>

      <section id="eventos" className="py-16 scroll-mt-[75px] lg:py-24">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="site-section-header site-section-header--center">
            <div className="site-section-kicker site-section-kicker--center">
              <span className="site-section-kicker-line site-section-kicker-line--dark" />
              <p className="site-antetitle text-[#a21b7e]">Eventos</p>
              <span className="site-section-kicker-line site-section-kicker-line--dark" />
            </div>
            <h2 className="site-section-title text-gray-900">
              Cobertura <span className="font-light">profissional</span>
            </h2>
            <p className="site-section-desc text-gray-600">{content.eventIntro}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {content.eventTypes.map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_12px_32px_rgba(162,27,126,0.12)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <OptimizedDriveImage
                    src={item.image}
                    alt={item.title}
                    size="sm"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#a21b7e]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <HomeLeavingLink
              to="/galeria"
              className="inline-flex items-center gap-2 rounded-full border border-[#a21b7e] px-8 py-3 text-sm font-medium text-[#a21b7e] transition-colors hover:bg-[#a21b7e]/5"
            >
              Ver galeria de eventos
              <ChevronRight size={16} />
            </HomeLeavingLink>
          </div>
        </div>
      </section>

      <section id="clientes" className="scroll-mt-[75px] bg-white py-10 lg:py-12">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="mb-8 flex items-center justify-center gap-4 py-2">
            <span className="site-section-kicker-line site-section-kicker-line--dark" aria-hidden="true" />
            <h2 className="site-section-title mb-0 text-gray-900">Nossos clientes</h2>
            <span className="site-section-kicker-line site-section-kicker-line--dark" aria-hidden="true" />
          </div>

          <div className="client-logo-carousel" aria-label="Logotipos de clientes">
            <motion.div
              className="flex items-stretch"
              style={{
                width: `${(logoExtended.length / logoVisible) * 100}%`,
              }}
              animate={{
                x: `-${logoSlide * (100 / logoExtended.length)}%`,
              }}
              transition={
                logoResetting
                  ? { duration: 0 }
                  : { duration: 0.5, ease: "easeInOut" }
              }
            >
              {logoExtended.map((logo, index) => (
                <div
                  key={`${logo.name}-${index}`}
                  className="client-logo-cell box-border shrink-0 px-1.5"
                  style={{ width: `${100 / logoExtended.length}%` }}
                >
                  <OptimizedDriveImage
                    src={logo.image}
                    alt={logo.name}
                    size="sm"
                    className="h-full w-full object-fill"
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section id="contactos" className="scroll-mt-24 bg-[#f3f3f3] py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <div className="flex flex-col justify-center bg-[#a21b7e] px-8 py-8 text-center text-white sm:px-10 sm:py-10">
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-base font-bold uppercase tracking-wide">Telefone</h3>
                    <div className="space-y-1 text-sm sm:text-base">
                      {content.contact.phones.map((phone) => (
                        <a
                          key={phone}
                          href={`tel:${phone.replace(/\s/g, "")}`}
                          className="block hover:text-white/85"
                        >
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-base font-bold uppercase tracking-wide">Email</h3>
                    <div className="space-y-1 text-sm sm:text-base">
                      {(content.contact.emails?.length
                        ? content.contact.emails
                        : [content.contact.email]
                      ).map((email) => (
                        <a
                          key={email}
                          href={`mailto:${email}`}
                          className="block break-all hover:text-white/85"
                        >
                          {email}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-base font-bold uppercase tracking-wide">Website</h3>
                    <div className="space-y-1 text-sm sm:text-base">
                      {(content.contact.websites ?? []).map((website) => {
                        const href = /^https?:\/\//i.test(website)
                          ? website
                          : `https://${website.replace(/^\/\//, "")}`;

                        return (
                          <a
                            key={website}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block break-all hover:text-white/85"
                          >
                            {website.replace(/^https?:\/\//i, "")}
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-base font-bold uppercase tracking-wide">Localização</h3>
                    <p className="text-sm leading-relaxed sm:text-base">{content.contact.address}</p>
                  </div>
                </div>
              </div>

              <form
                className="relative bg-white pb-5 pt-0 sm:pb-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const blocked = shouldBlockFormSubmit(form, contactFormStartedAt.current, "home-contact");
                  if (blocked) {
                    const message = formSpamUserMessage(blocked);
                    if (message) setContactFormNotice(message);
                    return;
                  }
                  setContactFormNotice(null);
                  const data = new FormData(form);
                  const nome = data.get("nome") as string;
                  const email = data.get("email") as string;
                  const mensagem = data.get("mensagem") as string;
                  const terms = data.get("terms");
                  if (!terms) return;
                  recordFormSubmit("home-contact");
                  window.location.href = `mailto:${content.contact.email}?subject=${encodeURIComponent("Contacto via site")}&body=${encodeURIComponent(`Nome: ${nome}\nEmail: ${email}\n\n${mensagem}`)}`;
                }}
              >
                <FormAntiSpamFields idPrefix="home-contact" />
                <div className="flex min-h-[120px] items-center bg-[#fafafa] px-[80px] py-5 sm:min-h-[132px] sm:py-6">
                  <h2 className="site-section-title mb-0 w-full text-gray-900">
                    Fale <span className="font-light">connosco</span>
                  </h2>
                </div>
                <div className="mb-6 h-px w-full bg-[#D7D7D7]" aria-hidden="true" />

                <div className="space-y-4 px-[80px]">
                  <div>
                    <input
                      id="contact-nome"
                      name="nome"
                      type="text"
                      required
                      aria-label="Nome"
                      className="contact-field-input"
                      placeholder="Nome"
                    />
                  </div>

                  <div>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      aria-label="Email"
                      className="contact-field-input"
                      placeholder="E-mail"
                    />
                  </div>

                  <div>
                    <textarea
                      id="contact-mensagem"
                      name="mensagem"
                      required
                      rows={5}
                      aria-label="Mensagem"
                      className="contact-field-textarea min-h-[180px]"
                      placeholder="escreva sua mensagem"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="terms"
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#a21b7e]"
                    />
                    <span>
                      Aceito os{" "}
                      <a href="/#sobre" className="text-[#a21b7e] hover:underline">
                        Termos de Serviço
                      </a>
                    </span>
                  </label>

                  {contactFormNotice && (
                    <p className="text-sm text-[#a21b7e]" role="status">
                      {contactFormNotice}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="bg-[#a21b7e] px-10 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#8e176e]"
                  >
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
