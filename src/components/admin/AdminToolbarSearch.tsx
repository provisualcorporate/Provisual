import { Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface AdminToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function AdminToolbarSearch({
  value,
  onChange,
  placeholder = "Pesquisar...",
  className,
}: AdminToolbarSearchProps) {
  return (
    <div className={cn("relative w-full md:w-64 shrink-0", className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-9 pr-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#a21b7e]"
      />
    </div>
  );
}
