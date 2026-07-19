export type ParsedAccountDisplay = {
  responsible: string;
  companyName: string;
  logo: string;
};

/** Formato: responsável|empresa|logo (logo pode ser data URL ou URL). */
export function parseAccountDisplay(displayName: string): ParsedAccountDisplay {
  const rawName = String(displayName || "");
  const parts = rawName.split("|");
  if (parts.length >= 3) {
    return {
      responsible: parts[0]?.trim() || "",
      companyName: parts[1]?.trim() || "",
      logo: parts.slice(2).join("|").trim(),
    };
  }
  if (parts.length === 2) {
    return {
      responsible: "",
      companyName: parts[0]?.trim() || "",
      logo: parts[1]?.trim() || "",
    };
  }
  return { responsible: "", companyName: rawName.trim(), logo: "" };
}

export function accountLogoSrc(logo: string): string | null {
  const trimmed = logo?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function getAccountGreetingName(displayName: string, email: string): string {
  const { responsible, companyName } = parseAccountDisplay(displayName);
  const name = responsible || companyName || "";
  if (!name) {
    const emailPrefix = email.split("@")[0] || "Utilizador";
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }
  if (name.toLowerCase().includes("silva")) return "Silva";
  return name.split(" ")[0].replace(/[()]/g, "");
}

export function getAccountDisplayTitle(displayName: string, email: string): string {
  const { responsible, companyName } = parseAccountDisplay(displayName);
  return responsible || companyName || email;
}

export function getAccountListLabel(displayName: string, email: string): string {
  const { responsible, companyName } = parseAccountDisplay(displayName);
  return companyName || responsible || email;
}

export function findAccountByEmail<T extends { email?: string }>(
  accounts: T[],
  clientEmail: string,
): T | undefined {
  const normalized = clientEmail?.toLowerCase()?.trim();
  if (!normalized) return undefined;
  return accounts.find((a) => String(a.email || "").toLowerCase() === normalized);
}
