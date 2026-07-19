import { cn } from "../lib/utils";
import {
  accountLogoSrc,
  parseAccountDisplay,
} from "../lib/accountDisplay";

type AccountAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AccountAvatarSize, string> = {
  xs: "w-4 h-4 text-[8px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-[10px]",
  lg: "w-10 h-10 text-sm",
};

interface AccountAvatarProps {
  displayName?: string;
  email?: string;
  size?: AccountAvatarSize;
  className?: string;
  active?: boolean;
}

export default function AccountAvatar({
  displayName = "",
  email = "",
  size = "md",
  className,
  active = false,
}: AccountAvatarProps) {
  const parsed = parseAccountDisplay(displayName);
  const logo = accountLogoSrc(parsed.logo);
  const initial = (parsed.companyName || parsed.responsible || email || "C")
    .charAt(0)
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full border flex items-center justify-center overflow-hidden shrink-0",
        active
          ? "bg-[#a21b7e] text-white border-[#a21b7e]"
          : "bg-gray-50 text-gray-500 border-gray-100",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {logo ? (
        <img src={logo} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-black uppercase">{initial}</span>
      )}
    </div>
  );
}
