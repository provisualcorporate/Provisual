import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DashboardSidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export default function DashboardSidebarItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: DashboardSidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        "w-full flex items-center rounded-sm text-[16px] font-bold transition-all duration-200 ease-in-out relative cursor-pointer",
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-1.5 transform hover:translate-x-1",
        active ? "text-[#a21b7e]" : "text-gray-500 hover:bg-[#a21b7e]/5 hover:text-[#a21b7e]",
      )}
    >
      <span className={cn("shrink-0 transition-colors", active ? "text-[#a21b7e]" : "text-gray-400")}>
        {icon}
      </span>
      <span className={cn("tracking-tight truncate", collapsed && "hidden")}>{label}</span>
      {active && !collapsed && (
        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#a21b7e]" />
      )}
    </button>
  );
}
