const HOME_SCROLL_KEY = "provisual_home_scroll";
const HOME_RESTORE_PENDING_KEY = "provisual_home_restore_pending";

const HOME_SECTION_IDS = [
  "inicio",
  "sobre",
  "processo-criativo",
  "equipa",
  "servicos",
  "videos",
  "arquivo",
  "eventos",
  "clientes",
  "contactos",
];

function detectSectionHash(): string {
  if (window.location.hash) return window.location.hash;

  const marker = window.scrollY + 120;
  let active = "";

  for (const id of HOME_SECTION_IDS) {
    const section = document.getElementById(id);
    if (section && section.offsetTop <= marker) {
      active = `#${id}`;
    }
  }

  return active;
}

export function saveHomeScrollOnLeave() {
  sessionStorage.setItem(
    HOME_SCROLL_KEY,
    JSON.stringify({
      y: window.scrollY,
      hash: detectSectionHash(),
    }),
  );
  sessionStorage.setItem(HOME_RESTORE_PENDING_KEY, "1");
}

export function clearHomeScrollRestore() {
  sessionStorage.removeItem(HOME_SCROLL_KEY);
  sessionStorage.removeItem(HOME_RESTORE_PENDING_KEY);
}

export function restoreHomeScrollIfPending() {
  if (sessionStorage.getItem(HOME_RESTORE_PENDING_KEY) !== "1") return;

  const raw = sessionStorage.getItem(HOME_SCROLL_KEY);
  if (!raw) {
    clearHomeScrollRestore();
    return;
  }

  try {
    const { y, hash } = JSON.parse(raw) as { y: number; hash: string };

    const apply = () => {
      if (y > 0) {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
        return;
      }

      if (hash) {
        const target = document.getElementById(hash.replace("#", ""));
        target?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    };

    requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 150);
      window.setTimeout(() => {
        apply();
        clearHomeScrollRestore();
      }, 500);
    });
  } catch {
    clearHomeScrollRestore();
  }
}
