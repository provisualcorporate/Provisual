export interface GalleryAlbum {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
}

export interface VideoItem {
  slug: string;
  title: string;
  youtubeId: string;
  image: string;
}

export interface ServiceItem {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  items: string[];
  itemDetails: { title: string; description: string }[];
  image: string;
  icon: "megaphone" | "palette" | "camera" | "monitor" | "briefcase" | "sparkles";
}

export const GALLERY_ALBUMS: GalleryAlbum[] = [
  {
    slug: "autoridade-tributaria",
    title: "Autoridade Tributária de Moçambique",
    subtitle: "Tomada de Posse",
    image: "/INICIO/galeria/autoridade-tributaria.jpg",
  },
  {
    slug: "construcao-obras",
    title: "Contrução/ Obras",
    subtitle: "Contrução da estrada de Quitunda",
    image: "/INICIO/galeria/construcao-quitunda.jpg",
  },
  {
    slug: "mmec",
    title: "MMEC",
    subtitle: "Mozambique Mining and Energy Conference",
    image: "/INICIO/galeria/mmec.jpg",
  },
  {
    slug: "gmt",
    title: "GMT",
    subtitle: "GMT Mulheres em Energia Limpa e Rede de Ação Climática para promover a inclusão",
    image: "/INICIO/galeria/gmt.jpg",
  },
  {
    slug: "agricultura",
    title: "Agricultura",
    subtitle: "Machambas",
    image: "/INICIO/galeria/agricultura-machambas.jpg",
  },
];

export const VIDEO_ITEMS: VideoItem[] = [
  {
    slug: "institucional-provisual",
    title: "ProVisual Corporate — Institucional",
    youtubeId: "WumPsSTFzaA",
    image: "https://img.youtube.com/vi/WumPsSTFzaA/hqdefault.jpg",
  },
  {
    slug: "provisual-youtube",
    title: "ProVisual Corporate",
    youtubeId: "DVgtNr_bq1g",
    image: "https://img.youtube.com/vi/DVgtNr_bq1g/hqdefault.jpg",
  },
];

export const SERVICE_ITEMS: ServiceItem[] = [
  {
    slug: "publicidade-marketing",
    title: "Publicidade e Marketing Digital",
    subtitle: "Advertising & Marketing",
    description:
      "Num mundo onde todos os dias surgem novas marcas, produtos e serviços, é imprescindível uma estratégia de construção de marca emocional com o público-alvo.",
    items: [
      "Consultoria e planeamento estratégico de marketing",
      "Estratégia de comunicação",
      "Planeamento de mídia",
      "Planeamento de campanha",
      "Facebook e Instagram ads campaigns",
      "Google Ads, etc.",
    ],
    itemDetails: [
      {
        title: "Consultoria e planeamento estratégico de marketing",
        description:
          "Analisamos o mercado, o público-alvo e a concorrência para definir objectivos claros, canais prioritários e um plano de acção alinhado às metas da sua instituição.",
      },
      {
        title: "Estratégia de comunicação",
        description:
          "Construímos a narrativa da sua marca — mensagens-chave, tom de voz e posicionamento — para que cada peça comunique de forma consistente e credível.",
      },
      {
        title: "Planeamento de mídia",
        description:
          "Seleccionamos e calendarizamos os meios mais adequados (digital, impresso, rádio, TV ou outdoor) para maximizar alcance e retorno do investimento.",
      },
      {
        title: "Planeamento de campanha",
        description:
          "Desenhamos campanhas completas: conceito criativo, cronograma, materiais e indicadores de sucesso, do lançamento ao relatório final.",
      },
      {
        title: "Facebook e Instagram ads campaigns",
        description:
          "Criamos, gerimos e optimizamos anúncios nas redes sociais com segmentação precisa, criativos adaptados e acompanhamento de resultados.",
      },
      {
        title: "Google Ads, etc.",
        description:
          "Implementamos campanhas de pesquisa, display e remarketing no Google e outras plataformas digitais para captar leads qualificados.",
      },
    ],
    icon: "megaphone",
    image: "/INICIO/PAINEIS5-scaled.jpg",
  },
  {
    slug: "branding-design",
    title: "Branding e Design Gráfico",
    subtitle: "Branding & Graphic Design",
    description:
      "Materializamos o propósito da sua empresa em identidades visuais sólidas, traduzindo valores em formas, cores e sistemas gráficos coerentes e agradáveis.",
    items: [
      "Criação de identidade visual",
      "Criação de embalagens",
      "Criação de marcas/logotipo",
      "Criação de manual de marca",
      "Criação de flyers/panfletos",
      "Criação de revistas/boletins",
      "Projecto de sinalização, etc.",
    ],
    itemDetails: [
      {
        title: "Criação de identidade visual",
        description:
          "Desenvolvemos sistemas visuais completos — logotipo, paleta de cores, tipografia e aplicações — que reflectem a personalidade e os valores da sua marca.",
      },
      {
        title: "Criação de embalagens",
        description:
          "Projectamos embalagens funcionais e atractivas que destacam o produto no ponto de venda e reforçam a experiência da marca.",
      },
      {
        title: "Criação de marcas/logotipo",
        description:
          "Criamos logotipos memoráveis e versáteis, pensados para funcionar em todos os suportes — digital, impresso e ambiental.",
      },
      {
        title: "Criação de manual de marca",
        description:
          "Documentamos regras de uso da identidade visual para garantir consistência em todas as comunicações internas e externas.",
      },
      {
        title: "Criação de flyers/panfletos",
        description:
          "Produzimos materiais promocionais impressos com layout profissional, copy persuasivo e acabamento de qualidade.",
      },
      {
        title: "Criação de revistas/boletins",
        description:
          "Editamos e diagramamos publicações periódicas — revistas institucionais, boletins informativos e relatórios — com identidade coerente.",
      },
      {
        title: "Projecto de sinalização, etc.",
        description:
          "Desenhamos sistemas de sinalética interior e exterior para edifícios, eventos e espaços comerciais, orientando e reforçando a marca.",
      },
    ],
    icon: "palette",
    image: "/INICIO/designer-gr%C3%A1fico-africano-criativo-no-flipchart-com-gr%C3%A1ficos-e-notas-adesivas-187855551.webp",
  },
  {
    slug: "fotografia-videografia",
    title: "Fotografia e Videografia",
    subtitle: "Photography & Videography",
    description:
      "A fotografia e o vídeo profissionais ajudam empresas a destacarem-se da concorrência, reforçando a credibilidade e confiança na presença visual das empresas.",
    items: [
      "Filmagem e fotografia de conferências",
      "Filmagem e fotografia de seminários/palestras",
      "Filmagem e fotografia de activação de marcas",
      "Filmagem e fotografia aérea com drone",
      "Filmagem e fotografia de feiras, etc.",
    ],
    itemDetails: [
      {
        title: "Filmagem e fotografia de conferências",
        description:
          "Cobertura audiovisual completa de conferências — palco, intervenientes, público e bastidores — com entrega de vídeo editado e banco de imagens.",
      },
      {
        title: "Filmagem e fotografia de seminários/palestras",
        description:
          "Registamos seminários e palestras com qualidade broadcast, ideal para arquivo, divulgação e plataformas de e-learning.",
      },
      {
        title: "Filmagem e fotografia de activação de marcas",
        description:
          "Captamos a energia das activações de marca no terreno — interacção com o público, demonstrações e momentos-chave para redes sociais.",
      },
      {
        title: "Filmagem e fotografia aérea com drone",
        description:
          "Imagens aéreas em alta definição para eventos, obras, destinos turísticos e campanhas publicitárias com perspectiva única.",
      },
      {
        title: "Filmagem e fotografia de feiras, etc.",
        description:
          "Documentamos feiras, exposições e stands com cobertura fotográfica e vídeo institucional para maximizar o impacto pós-evento.",
      },
    ],
    icon: "camera",
    image: "/INICIO/MMEC40-scaled.jpg",
  },
  {
    slug: "servicos-informaticos",
    title: "Serviços Informáticos",
    subtitle: "IT Services",
    description:
      "Porque o futuro é digital, queremos conectar empresas, produtos, serviços e grandes ideias de pessoa com o mundo virtual através de diversas plataformas.",
    items: [
      "Sites institucionais",
      "Lojas online (e-commerce)",
      "Aplicativos móveis",
      "Plataformas e-learning",
      "Integração de sistemas",
    ],
    itemDetails: [
      {
        title: "Sites institucionais",
        description:
          "Desenvolvemos websites modernos, responsivos e optimizados para SEO que apresentam a sua instituição com credibilidade e clareza.",
      },
      {
        title: "Lojas online (e-commerce)",
        description:
          "Criamos lojas virtuais completas com catálogo, pagamentos, gestão de encomendas e integração com meios de pagamento locais.",
      },
      {
        title: "Aplicativos móveis",
        description:
          "Projectamos e desenvolvemos apps nativas ou híbridas para iOS e Android, alinhadas às necessidades do seu negócio ou serviço público.",
      },
      {
        title: "Plataformas e-learning",
        description:
          "Implementamos ambientes de formação online com gestão de cursos, avaliações, certificados e acompanhamento de progresso.",
      },
      {
        title: "Integração de sistemas",
        description:
          "Ligamos plataformas, APIs e bases de dados para automatizar fluxos de trabalho e eliminar redundâncias operacionais.",
      },
    ],
    icon: "monitor",
    image: "/INICIO/designer-gr%C3%A1fico-africano-web-usando-software-de-edi%C3%A7%C3%A3o-design-212684276.webp",
  },
  {
    slug: "consultorias",
    title: "Consultorias",
    subtitle: "Consulting",
    description:
      "Buscamos entender o seu negócio na íntegra, propomos um plano de melhoria e garantimos que o plano seja executado.",
    items: [
      "Diagnóstico de comunicação",
      "Planos de melhoria",
      "Acompanhamento estratégico",
      "Relatórios e indicadores",
    ],
    itemDetails: [
      {
        title: "Diagnóstico de comunicação",
        description:
          "Avaliamos a comunicação actual da sua instituição — canais, mensagens, materiais e percepção pública — para identificar gaps e oportunidades.",
      },
      {
        title: "Planos de melhoria",
        description:
          "Elaboramos planos concretos com acções prioritárias, prazos e recursos necessários para elevar a eficácia comunicacional.",
      },
      {
        title: "Acompanhamento estratégico",
        description:
          "Acompanhamos a execução do plano com reuniões periódicas, ajustes e apoio à equipa interna até à entrega de resultados.",
      },
      {
        title: "Relatórios e indicadores",
        description:
          "Produzimos relatórios periódicos com métricas de desempenho, análise de impacto e recomendações para decisões informadas.",
      },
    ],
    icon: "briefcase",
    image: "/INICIO/Coberturas.jpg",
  },
  {
    slug: "outros-servicos",
    title: "Outros Serviços",
    subtitle: "Other services",
    description:
      "O nosso leque de soluções não se limita ao que está catalogado — somos a solução completa para multimédia e informática.",
    items: [
      "Produção de conteúdos sob medida",
      "Projectos especiais",
      "Suporte técnico em eventos",
      "Soluções personalizadas",
    ],
    itemDetails: [
      {
        title: "Produção de conteúdos sob medida",
        description:
          "Criamos conteúdos audiovisuais, gráficos ou digitais adaptados a briefings específicos que não se enquadram nos pacotes standard.",
      },
      {
        title: "Projectos especiais",
        description:
          "Assumimos projectos complexos ou pontuais — lançamentos, campanhas institucionais ou acções de responsabilidade social — de ponta a ponta.",
      },
      {
        title: "Suporte técnico em eventos",
        description:
          "Disponibilizamos equipa e equipamento técnico no local — som, imagem, streaming e registo — para garantir eventos sem falhas.",
      },
      {
        title: "Soluções personalizadas",
        description:
          "Combinamos serviços de multimédia, design e IT numa proposta única, desenhada à medida das necessidades da sua organização.",
      },
    ],
    icon: "sparkles",
    image: "/INICIO/COmunidade.jpg",
  },
];

export const SERVICOS_INTRO =
  "O nosso leque de soluções é aplicado de forma sistemática, com o objectivo de oferecer tudo o que a sua empresa precisa para se posicionar no mercado com excelência visual.";

export function getServiceBySlug(slug: string) {
  return SERVICE_ITEMS.find((s) => s.slug === slug);
}
