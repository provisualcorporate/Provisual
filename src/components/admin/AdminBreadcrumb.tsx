import { ChevronLeft, ChevronRight } from "lucide-react";

export type AdminCrumb = {
  label: string;
  onClick?: () => void;
};

export type AdminNavState = {
  crumbs: AdminCrumb[];
  onBack?: () => void;
};

interface AdminBreadcrumbProps {
  crumbs: AdminCrumb[];
  onBack?: () => void;
  compact?: boolean;
}

export default function AdminBreadcrumb({ crumbs, onBack, compact }: AdminBreadcrumbProps) {
  return (
    <div
      className={
        compact
          ? "flex items-center gap-2 text-sm text-gray-500 min-h-[36px]"
          : "flex items-center gap-3 text-sm text-gray-500 border-b border-gray-100 pb-3 mb-4 min-h-[44px]"
      }
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 shrink-0 px-2 py-1.5 rounded-sm text-gray-600 hover:text-[#a21b7e] hover:bg-[#a21b7e]/5 font-bold transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} />
          Voltar
        </button>
      )}
      <nav aria-label="Caminho" className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1 min-w-0">
              {index > 0 && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
              {crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="hover:text-[#a21b7e] transition-colors truncate text-left cursor-pointer bg-transparent border-0 p-0 font-medium"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-gray-700 font-semibold truncate">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
