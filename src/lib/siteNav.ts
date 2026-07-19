export const SITE_NAV_LINKS = [
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#processo-criativo", label: "Processo" },
  { href: "/#equipa", label: "Equipa" },
  { href: "/#servicos", label: "Serviços" },
  { href: "/#videos", label: "Videos" },
  { href: "/#eventos", label: "Cobertura" },
  { href: "/#contactos", label: "Contactos" },
];

export const QUICK_LINK_ROUTES = [
  { to: "/galeria", label: "Galeria", icon: "galeria" as const, description: "Registos visuais de eventos" },
  { to: "/videos", label: "Videos", icon: "videos" as const, description: "Produções audiovisuais de excelência" },
  { to: "/arquivo", label: "Arquivo", icon: "arquivo" as const, description: "Acesso ao conteúdo." },
  { to: "/servicos", label: "Serviços", icon: "servicos" as const, description: "Soluções integradas para empresas" },
];

export const FOOTER_LINK_COLUMNS = [
  {
    title: "Navegação",
    links: [
      { label: "Serviços", href: "/servicos" },
      { label: "Galeria", href: "/galeria" },
      { label: "Vídeos", href: "/videos" },
      { label: "Arquivo", href: "/arquivo" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Eventos", href: "/#eventos" },
      { label: "Clientes", href: "/#clientes" },
      { label: "Contacte-nos", href: "/#contactos" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Contactos",
    links: [
      { label: "+258 86 30 76 065", href: "tel:+258863076065" },
      { label: "+258 85 51 13 215", href: "tel:+258855113215" },
      { label: "info@provisualcorporate.co.mz", href: "mailto:info@provisualcorporate.co.mz" },
      { label: "WhatsApp", href: "https://wa.me/258863076065" },
    ],
  },
];

export const DEFAULT_INTERIOR_BANNER = "/INICIO/producao-grafica.webp";

export const PAGE_BREADCRUMBS = {
  home: [{ label: "Início" }],
  galeria: [{ label: "Início", href: "/" }, { label: "Galeria" }],
  videos: [{ label: "Início", href: "/" }, { label: "Vídeos" }],
  servicos: [{ label: "Início", href: "/" }, { label: "Serviços" }],
} as const;
