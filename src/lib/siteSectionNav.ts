export const PENDING_HOME_SECTION_KEY = "provisual_pending_home_section";

export function getSectionIdFromHref(href: string): string | null {
  if (href.startsWith("/#")) return href.slice(2);
  if (href.startsWith("#")) return href.slice(1);
  return null;
}

export function isHomeSectionHref(href: string): boolean {
  return getSectionIdFromHref(href) !== null;
}

export function scrollToSection(sectionId: string, behavior: ScrollBehavior = "smooth") {
  const target = document.getElementById(sectionId);
  if (!target) return false;

  target.scrollIntoView({ behavior, block: "start" });

  if (window.location.pathname === "/") {
    window.history.replaceState(null, "", `#${sectionId}`);
  }

  return true;
}

export function queueHomeSectionScroll(sectionId: string) {
  sessionStorage.setItem(PENDING_HOME_SECTION_KEY, sectionId);
}

export function consumePendingHomeSection(): string | null {
  const id = sessionStorage.getItem(PENDING_HOME_SECTION_KEY);
  if (id) sessionStorage.removeItem(PENDING_HOME_SECTION_KEY);
  return id;
}

export function scrollToHomeSectionWhenReady(sectionId: string, behavior: ScrollBehavior = "smooth") {
  const attempt = () => scrollToSection(sectionId, behavior);

  requestAnimationFrame(attempt);
  window.setTimeout(attempt, 120);
  window.setTimeout(attempt, 350);
  window.setTimeout(attempt, 700);
}
