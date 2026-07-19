export const MIN_FORM_SUBMIT_MS = 3000;
export const FORM_RATE_LIMIT_MS = 60_000;

const RATE_LIMIT_PREFIX = "pv_form_submit:";

export type FormSpamBlockReason = "honeypot" | "too_fast" | "rate_limit";

export function isHoneypotFilled(form: HTMLFormElement): boolean {
  const trap = String(new FormData(form).get("website") ?? "").trim();
  return trap.length > 0;
}

export function isFormSubmittedTooFast(
  formStartedAt: number,
  minMs: number = MIN_FORM_SUBMIT_MS,
): boolean {
  return Date.now() - formStartedAt < minMs;
}

export function isFormRateLimited(formKey: string, minIntervalMs = FORM_RATE_LIMIT_MS): boolean {
  try {
    const last = sessionStorage.getItem(`${RATE_LIMIT_PREFIX}${formKey}`);
    if (!last) return false;
    return Date.now() - Number(last) < minIntervalMs;
  } catch {
    return false;
  }
}

export function recordFormSubmit(formKey: string) {
  try {
    sessionStorage.setItem(`${RATE_LIMIT_PREFIX}${formKey}`, String(Date.now()));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getFormSpamBlockReason(
  form: HTMLFormElement,
  formStartedAt: number,
  formKey: string,
): FormSpamBlockReason | null {
  if (isHoneypotFilled(form)) return "honeypot";
  if (isFormRateLimited(formKey)) return "rate_limit";
  if (isFormSubmittedTooFast(formStartedAt)) return "too_fast";
  return null;
}

export function formSpamUserMessage(reason: FormSpamBlockReason | null): string | null {
  if (reason === "too_fast") {
    return "Aguarde alguns segundos antes de enviar.";
  }
  if (reason === "rate_limit") {
    return "Já enviou recentemente. Tente novamente dentro de um minuto.";
  }
  return null;
}

export function shouldBlockFormSubmit(
  form: HTMLFormElement,
  formStartedAt: number,
  formKey: string,
): FormSpamBlockReason | null {
  return getFormSpamBlockReason(form, formStartedAt, formKey);
}
