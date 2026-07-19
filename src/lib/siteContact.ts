export const SERVICE_REQUEST_EMAIL = "geral@provisualcorporate.co.mz";
export const SITE_CONTACT_EMAIL = "info@provisualcorporate.co.mz";

export const SITE_ADDRESS =
  "Av. 24 de Julho esquina com Rua Francisco Matange nº 8, Maputo - Moçambique";

export const SITE_MAP_EMBED_URL = `https://maps.google.com/maps?q=${encodeURIComponent(SITE_ADDRESS)}&output=embed`;

export function buildMailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
