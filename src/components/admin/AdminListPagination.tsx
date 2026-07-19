import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export const ADMIN_LIST_PAGE_SIZE = 10;

interface AdminListPaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export default function AdminListPagination({
  page,
  totalItems,
  pageSize = ADMIN_LIST_PAGE_SIZE,
  onPageChange,
}: AdminListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = page * pageSize + 1;
  const end = Math.min(totalItems, (page + 1) * pageSize);

  return (
    <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-500">
        A mostrar {start}–{end} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="inline-flex h-9 items-center gap-1 rounded-sm border border-gray-300 bg-transparent px-3 text-xs font-bold text-gray-600 transition-colors hover:border-[#a21b7e] hover:text-[#a21b7e] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <span className="px-2 text-xs font-bold text-gray-500">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-sm border border-gray-300 bg-transparent px-3 text-xs font-bold text-gray-600 transition-colors hover:border-[#a21b7e] hover:text-[#a21b7e] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer",
          )}
        >
          Seguinte
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function paginateList<T>(items: T[], page: number, pageSize = ADMIN_LIST_PAGE_SIZE): T[] {
  return items.slice(page * pageSize, page * pageSize + pageSize);
}
