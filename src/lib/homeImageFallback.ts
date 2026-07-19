/** Caminhos estáticos em /INICIO/ quando o proxy Drive falha (IDs inválidos em produção). */
export const HOME_STATIC_BY_FILENAME: Record<string, string> = {
  "coberturas.jpg": "/INICIO/Coberturas.jpg",
  "mmec40-scaled.jpg": "/INICIO/MMEC40-scaled.jpg",
  "paineis5-scaled.jpg": "/INICIO/PAINEIS5-scaled.jpg",
  "comunidade.jpg": "/INICIO/COmunidade.jpg",
  "sobre.webp": "/INICIO/sobre.webp",
  "producao-grafica.webp": "/INICIO/producao-grafica.webp",
  "fotografo.png": "/INICIO/Fotografo.png",
  "captura de ecrã 2026-05-23, às 14.09.11.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.09.11.png",
  "captura de ecrã 2026-05-23, às 14.10.07.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.10.07.png",
  "captura de ecrã 2026-05-23, às 14.10.43.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.10.43.png",
  "captura de ecrã 2026-05-23, às 14.16.15.png":
    "/INICIO/Equipa/Captura%20de%20ecr%C3%A3%202026-05-23%2C%20%C3%A0s%2014.16.15.png",
  "artboard-1.svg": "/INICIO/clientes/Artboard-1.svg",
  "artboard-2.svg": "/INICIO/clientes/Artboard-2.svg",
  "artboard-3.svg": "/INICIO/clientes/Artboard-3.svg",
  "artboard-4.svg": "/INICIO/clientes/Artboard-4.svg",
  "artboard-5.svg": "/INICIO/clientes/Artboard-5.svg",
  "artboard-6.svg": "/INICIO/clientes/Artboard-6.svg",
  "artboard-7.svg": "/INICIO/clientes/Artboard-7.svg",
  "artboard-8.svg": "/INICIO/clientes/Artboard-8.svg",
  "artboard-9.svg": "/INICIO/clientes/Artboard-9.svg",
  "artboard-10.svg": "/INICIO/clientes/Artboard-10.svg",
  "at.png": "/INICIO/clientes/AT.png",
  "up.png": "/INICIO/clientes/Up.png",
};

export function isDriveProxyImageUrl(url?: string | null): boolean {
  return Boolean(url && url.includes("/api/drive/"));
}

/** Usa imagem estática local em vez de URL do proxy Drive quando há fallback conhecido. */
export function homeDisplayImage(url: string | undefined, staticFallback: string): string {
  if (!url || isDriveProxyImageUrl(url)) {
    const basename = decodeURIComponent((staticFallback || "").split("/").pop() || "").toLowerCase();
    return HOME_STATIC_BY_FILENAME[basename] || staticFallback;
  }
  return url;
}
