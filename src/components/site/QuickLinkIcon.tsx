export type QuickLinkIconType = "galeria" | "videos" | "arquivo" | "servicos";

export default function QuickLinkIcon({ type }: { type: QuickLinkIconType }) {
  const stroke = "#3d001d";
  const sw = 2;

  if (type === "galeria") {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="48" height="48" rx="10" stroke={stroke} strokeWidth={sw} />
        <rect x="13" y="13" width="13" height="13" rx="3" stroke={stroke} strokeWidth={sw} />
        <rect x="30" y="13" width="13" height="13" rx="3" stroke={stroke} strokeWidth={sw} />
        <rect x="13" y="30" width="13" height="13" rx="3" stroke={stroke} strokeWidth={sw} />
        <rect x="30" y="30" width="13" height="13" rx="3" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (type === "videos") {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="48" height="48" rx="10" stroke={stroke} strokeWidth={sw} />
        <rect x="15" y="19" width="18" height="18" rx="2" stroke={stroke} strokeWidth={sw} />
        <path d="M33 24L41 20V36L33 32V24Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "arquivo") {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="48" height="48" rx="10" stroke={stroke} strokeWidth={sw} />
        <path
          d="M16 22H40V38C40 39.1 39.1 40 38 40H18C16.9 40 16 39.1 16 38V22Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <path d="M20 22V18C20 16.9 20.9 16 22 16H34C35.1 16 36 16.9 36 18V22" stroke={stroke} strokeWidth={sw} />
        <path d="M22 30H34" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="48" height="48" rx="10" stroke={stroke} strokeWidth={sw} />
      <circle cx="28" cy="28" r="6" stroke={stroke} strokeWidth={sw} />
      <path
        d="M28 17v3M28 36v3M17 28h3M36 28h3M20.5 20.5l2.1 2.1M33.4 33.4l2.1 2.1M35.5 20.5l-2.1 2.1M22.6 33.4l-2.1 2.1"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}
