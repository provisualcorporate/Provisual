import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { driveDisplayUrl } from "../../lib/driveImageUrl";

interface SiteBannerSlideshowProps {
  images: string[];
  intervalMs?: number;
  className?: string;
}

export default function SiteBannerSlideshow({
  images,
  intervalMs = 5000,
  className,
}: SiteBannerSlideshowProps) {
  const slides = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [slides.length, intervalMs]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("absolute inset-0", className)} aria-hidden="true">
      {slides.map((src, index) => (
        <img
          key={`${src}-${index}`}
          src={driveDisplayUrl(src, "lg")}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}
