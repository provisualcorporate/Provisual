/**
 * Migra imagens locais de INICIO/ para Google Drive (pasta site/) e actualiza home no Supabase.
 * Uso: node scripts/migrate-inicio-to-drive.mjs
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import {
  uploadFileToSiteFolder,
} from "../lib/siteDriveHelpers.js";

const ROOT = process.cwd();
const SUPABASE_URL = "https://gwankhxcbkrtgxopbxwd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YW5raHhjYmtydGd4b3BieHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY2NzUsImV4cCI6MjA4NTgwMjY3NX0.Wmx16vE2PQBuuyCT0wWrLQTDemMufo2VJeM5NF9IfcY";
const HOME_CONTENT_KEY = "home_page_content";

const GALLERY_ALBUMS = [
  { slug: "autoridade-tributaria", dir: "autoridade-tributaria", cover: "autoridade-tributaria.jpg" },
  { slug: "construcao-obras", dir: "construcao-obras", cover: "construcao-quitunda.jpg" },
  { slug: "mmec", dir: "mmec", cover: "mmec.jpg" },
  { slug: "gmt", dir: "gmt", cover: "gmt.jpg" },
  { slug: "agricultura", dir: "agricultura", cover: "agricultura-machambas.jpg" },
];

const SERVICE_IMAGES = [
  { slug: "publicidade-marketing", file: "PAINEIS5-scaled.jpg" },
  { slug: "branding-design", file: "designer-gráfico-africano-criativo-no-flipchart-com-gráficos-e-notas-adesivas-187855551.webp" },
  { slug: "fotografia-videografia", file: "MMEC40-scaled.jpg" },
  { slug: "servicos-informaticos", file: "designer-gráfico-africano-web-usando-software-de-edição-design-212684276.webp" },
  { slug: "consultorias", file: "Coberturas.jpg" },
  { slug: "outros-servicos", file: "COmunidade.jpg" },
];

const SCRAPE_DIR = "INICIO/Home - ProvisualCorporate_files";

const EVENT_TYPE_FILES = [
  { title: "WORKSHOPS", file: "MMEC40-scaled.jpg", description: "Cobertura de foto, vídeo, som e apoio técnico. Produção de conteúdos para comunicação e registo das actividades formativas." },
  { title: "FORMAÇÕES", file: "PAINEIS5-scaled.jpg", description: "Cobertura técnica e audiovisual de formações, com captação de imagem e som, e conteúdos para relatórios ou divulgação." },
  { title: "EVENTOS INSTITUCIONAIS", file: "Coberturas.jpg", description: "Registamos eventos com fotografia, vídeo, streaming e produção de conteúdos para promoção e arquivo." },
  { title: "TEAM BUILDINGS", file: "COmunidade.jpg", description: "Cobertura de actividades de equipa, com fotos e vídeos dinâmicos que reforçam a cultura organizacional." },
];

const CLIENT_LOGO_FILES = [
  "Artboard-1.svg", "Artboard-2.svg", "Artboard-3.svg", "Artboard-4.svg", "Artboard-5.svg",
  "Artboard-6.svg", "Artboard-7.svg", "Artboard-8.svg", "Artboard-9.svg", "Artboard-10.svg",
  "AT.png", "Up.png",
];

const NEWS_ITEMS = [
  {
    title: "Aníbal Mbalango desafia os Directores-Gerais a trabalharem em prol do interesse da organização",
    file: "A70A8812-300x200.jpg",
  },
  {
    title: "Ministério das Finanças e AT com nova liderança para reforçar a gestão pública",
    file: "A70A8732-1-300x200.jpg",
  },
  {
    title: "Formações corporativas ganham impacto com produção audiovisual da ProVisual",
    file: "FIRST-PANEL-3-300x190.jpg",
  },
];

function guessMime(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

function resolveLocal(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (fs.existsSync(full)) return full;
  const dir = path.dirname(full);
  const base = path.basename(full);
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find((f) => f === base || decodeURIComponent(f) === base);
  return match ? path.join(dir, match) : null;
}

async function uploadLocal(drive, supabase, localRelative, subpath, remoteName) {
  const localPath = resolveLocal(localRelative);
  if (!localPath) {
    console.warn(`  missing: ${localRelative}`);
    return null;
  }
  const buffer = fs.readFileSync(localPath);
  const name = remoteName || path.basename(localPath);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const result = await uploadFileToSiteFolder(
        drive,
        supabase,
        subpath,
        name,
        buffer,
        guessMime(name),
      );
      console.log(`  ${result.skipped ? "exists" : "uploaded"}: site/${subpath}/${name}`);
      await new Promise((r) => setTimeout(r, 300));
      return result.url;
    } catch (err) {
      if (attempt === 4) throw err;
      console.warn(`  retry ${attempt}/4: ${subpath}/${name}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return null;
}

async function uploadDirectory(drive, supabase, localDir, subpath) {
  const dirPath = path.join(ROOT, localDir);
  if (!fs.existsSync(dirPath)) {
    console.warn(`  dir missing: ${localDir}`);
    return;
  }
  const files = fs.readdirSync(dirPath).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(dirPath, file));
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await uploadFileToSiteFolder(drive, supabase, subpath, file, buffer, guessMime(file));
        console.log(`  uploaded: site/${subpath}/${file}`);
        await new Promise((r) => setTimeout(r, 300));
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        console.warn(`  retry ${attempt}/4: ${subpath}/${file}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
}

async function getGoogleAuth() {
  const oauthKeys = JSON.parse(fs.readFileSync(path.join(ROOT, "google-oauth.json"), "utf-8"));
  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, "google-tokens.json"), "utf-8"));
  const oauth2Client = new google.auth.OAuth2(
    oauthKeys.client_id,
    oauthKeys.client_secret,
    "http://localhost:3333/api/drive/auth/callback",
  );
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function main() {
  console.log("A migrar imagens INICIO/ → Google Drive (site/)...\n");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  console.log("— Galeria —");
  for (const album of GALLERY_ALBUMS) {
    await uploadLocal(
      drive,
      supabase,
      `INICIO/galeria/${album.cover}`,
      `galeria/${album.slug}`,
      "cover.jpg",
    );
    await uploadDirectory(drive, supabase, `INICIO/galeria/${album.dir}`, `galeria/${album.slug}`);
  }

  console.log("\n— Serviços —");
  for (const svc of SERVICE_IMAGES) {
    await uploadLocal(drive, supabase, `INICIO/${svc.file}`, `servicos/${svc.slug}`, "cover.jpg");
  }

  console.log("\n— Homepage —");
  const aboutImage = await uploadLocal(drive, supabase, "INICIO/sobre.webp", "home", "sobre.webp");
  const processBackground = await uploadLocal(
    drive,
    supabase,
    "INICIO/producao-grafica.webp",
    "home",
    "producao-grafica.webp",
  );
  const teamBanner = await uploadLocal(drive, supabase, "INICIO/Coberturas.jpg", "home", "coberturas.jpg");
  const contactPhoto = await uploadLocal(drive, supabase, "INICIO/Fotografo.png", "home", "Fotografo.png");
  const heroBg = await uploadLocal(drive, supabase, "INICIO/Coberturas.jpg", "hero", "coberturas.jpg");

  const slideFiles = [
    "MMEC40-scaled.jpg",
    "PAINEIS5-scaled.jpg",
    "Coberturas.jpg",
    "COmunidade.jpg",
  ];
  const slideUrls = [];
  for (const file of slideFiles) {
    const url = await uploadLocal(drive, supabase, `INICIO/${file}`, "hero", file);
    if (url) slideUrls.push(url);
  }

  const teamFiles = [
    "Equipa/Captura de ecrã 2026-05-23, às 14.09.11.png",
    "Equipa/Captura de ecrã 2026-05-23, às 14.10.07.png",
    "Equipa/Captura de ecrã 2026-05-23, às 14.10.43.png",
    "Equipa/Captura de ecrã 2026-05-23, às 14.16.15.png",
  ];
  const teamUrls = [];
  for (const file of teamFiles) {
    const url = await uploadLocal(drive, supabase, `INICIO/${file}`, "home/equipa", file.split("/").pop());
    if (url) teamUrls.push(url);
  }

  console.log("\n— Eventos (homepage) —");
  const eventTypes = [];
  for (const evt of EVENT_TYPE_FILES) {
    const image = await uploadLocal(drive, supabase, `INICIO/${evt.file}`, "home/eventos", evt.file);
    eventTypes.push({
      title: evt.title,
      description: evt.description,
      image,
    });
  }

  console.log("\n— Clientes (logos) —");
  const clientLogos = [];
  for (const file of CLIENT_LOGO_FILES) {
    const localCandidates = [
      `${SCRAPE_DIR}/${file}`,
      `INICIO/clientes/${file}`,
    ];
    let image = null;
    for (const localPath of localCandidates) {
      image = await uploadLocal(drive, supabase, localPath, "home/clientes", file);
      if (image) break;
    }
    if (image) {
      clientLogos.push({
        name: file.replace(/\.[^.]+$/, "").replace(/-/g, " "),
        image,
      });
    }
  }

  console.log("\n— Notícias —");
  const newsItems = [];
  for (const item of NEWS_ITEMS) {
    const image = await uploadLocal(drive, supabase, `${SCRAPE_DIR}/${item.file}`, "home/noticias", item.file);
    newsItems.push({
      title: item.title,
      image,
    });
  }

  const { data: existing } = await supabase
    .from("settings")
    .select("value")
    .eq("key", HOME_CONTENT_KEY)
    .single();

  const base = existing?.value || {};

  const defaultSlides = [
    {
      category: "FOTOS CORPORATIVAS",
      title: "Presença, Estilo e Identidade",
      subtitle: "Gestão visual que reforça a imagem da sua organização.",
      image: slideUrls[0],
    },
    {
      category: "VÍDEOS PUBLICITÁRIOS",
      title: "Marca, Visibilidade e Confiança",
      subtitle: "Comunicação estratégica para destacar-se no mercado.",
      image: slideUrls[1],
    },
    {
      category: "VÍDEOS INSTITUCIONAIS",
      title: "Informação, Promoção e Vida",
      subtitle: "Conteúdos que conectam a sua marca ao público certo.",
      image: slideUrls[2],
    },
    {
      category: "DOCUMENTÁRIOS",
      title: "Factos, histórias e arte",
      subtitle: "Produção criativa com impacto e narrativa autêntica.",
      image: slideUrls[3],
    },
  ];

  const defaultTeam = [
    {
      name: "Carlos Nhaca",
      role: "Director de Produção",
      image: teamUrls[0],
      social: {
        facebook: "https://www.facebook.com/profile.php?id=61577619669570",
        linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
        instagram: "https://www.instagram.com/",
      },
    },
    {
      name: "Miguel Tembe",
      role: "Especialista Audiovisual",
      image: teamUrls[1],
      social: {
        facebook: "https://www.facebook.com/profile.php?id=61577619669570",
        linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
        instagram: "https://www.instagram.com/",
      },
    },
    {
      name: "João Machava",
      role: "Gestor de Projectos",
      image: teamUrls[2],
      social: {
        facebook: "https://www.facebook.com/profile.php?id=61577619669570",
        linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
        instagram: "https://www.instagram.com/",
      },
    },
    {
      name: "Ana Mabunda",
      role: "Directora Criativa",
      image: teamUrls[3],
      social: {
        facebook: "https://www.facebook.com/profile.php?id=61577619669570",
        linkedin: "https://mz.linkedin.com/in/provisual-corporate-493342353",
        instagram: "https://www.instagram.com/",
      },
    },
  ];

  const homeContent = {
    ...base,
    hero: {
      ...(base.hero || {}),
      backgroundImage: heroBg || base.hero?.backgroundImage,
    },
    slides: base.slides?.length
      ? base.slides.map((slide, i) => ({ ...slide, image: slideUrls[i] || slide.image }))
      : defaultSlides,
    aboutImage: aboutImage || base.aboutImage,
    processBackground: processBackground || base.processBackground,
    teamBanner: teamBanner || base.teamBanner,
    teamMembers: defaultTeam.map((member, i) => ({
      ...member,
      image: teamUrls[i] || member.image,
    })),
    eventIntro:
      base.eventIntro ||
      "Captamos narrativas visuais de elevado rigor e profundidade, concebidas para imortalizar factos, histórias e personagens com autenticidade e arte.",
    eventTypes: base.eventTypes?.length
      ? base.eventTypes.map((item, i) => ({ ...item, image: eventTypes[i]?.image || item.image }))
      : eventTypes,
    clientLogos: clientLogos.length ? clientLogos : base.clientLogos,
    newsItems: base.newsItems?.length
      ? base.newsItems.map((item, i) => ({ ...item, image: newsItems[i]?.image || item.image }))
      : newsItems,
    contact: {
      ...(base.contact || {}),
      photo: contactPhoto || base.contact?.photo,
    },
  };

  await supabase.from("settings").upsert({ key: HOME_CONTENT_KEY, value: homeContent });
  console.log("\n✓ Conteúdo da homepage actualizado no Supabase com URLs do Drive.");
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
