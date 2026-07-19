import type { MouseEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSectionIdFromHref, scrollToSection } from "../../lib/siteSectionNav";

type SiteSectionLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function SiteSectionLink({ href, children, className, onClick }: SiteSectionLinkProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const sectionId = getSectionIdFromHref(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !sectionId) return;

    event.preventDefault();

    if (location.pathname === "/") {
      scrollToSection(sectionId, "smooth");
      return;
    }

    navigate({ pathname: "/", hash: `#${sectionId}` });
  };

  return (
    <a href={sectionId ? `/#${sectionId}` : href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
