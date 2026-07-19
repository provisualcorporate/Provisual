import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "./SiteBreadcrumb.types";

export type { BreadcrumbItem };

interface SiteBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  backHref?: string;
}

export default function SiteBreadcrumb({ breadcrumbs, backHref }: SiteBreadcrumbProps) {
  return (
    <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-10 py-2.5 flex items-center gap-2 min-h-[48px]">
      {backHref && (
        <Link
          to={backHref}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} />
        </Link>
      )}

      <nav aria-label="Caminho" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
          {breadcrumbs.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1 min-w-0">
              {index > 0 && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
              {item.href ? (
                <Link to={item.href} className="hover:text-[#a21b7e] transition-colors truncate">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-700 truncate">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
