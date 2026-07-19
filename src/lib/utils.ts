import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza nomes vindos do Google Drive para exibição legível nos painéis. */
type AdminProfile = {
  email?: string;
  id?: string;
  uid?: string;
  displayName?: string;
};

const MASTER_ADMIN_EMAIL = "silva.chamo@gmail.com";
const MASTER_ADMIN_ID = "admin_master_silva";

/** Apenas a conta master (Silva Chamo) pode ligar OAuth pessoal ao Google Drive. */
export function isSuperAdmin(profile: AdminProfile | null | undefined): boolean {
  if (!profile) return false;
  const email = String(profile.email || "").toLowerCase();
  const id = String(profile.id || profile.uid || "");
  const name = String(profile.displayName || "").toLowerCase();
  return (
    email === MASTER_ADMIN_EMAIL ||
    id === MASTER_ADMIN_ID ||
    name.includes("admin master")
  );
}

/** Identifica a conta master na lista de utilizadores. */
export function isMasterAccount(account: AdminProfile | null | undefined): boolean {
  return isSuperAdmin(account);
}

/** Master vê todas as contas; administrador simples não vê a conta master. */
export function filterAccountsForViewer<T extends AdminProfile>(
  accounts: T[],
  viewer: AdminProfile | null | undefined,
): T[] {
  if (isSuperAdmin(viewer)) return accounts;
  return accounts.filter((account) => !isMasterAccount(account));
}

export function displayDriveName(name: unknown): string {
  if (typeof name !== "string") return "Sem nome";
  let cleaned = name.normalize("NFC").replace(/\uFFFD/g, "").trim();
  if (!cleaned) return "Sem nome";
  if (/%[0-9A-Fa-f]{2}/.test(cleaned)) {
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch (_) {}
  }
  return cleaned.normalize("NFC").trim() || "Sem nome";
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: null,
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
