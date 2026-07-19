import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { driveDisplayUrl, type DriveImageSize } from "../../lib/driveImageUrl";

interface OptimizedDriveImageProps {
  src: string;
  alt?: string;
  className?: string;
  size?: DriveImageSize;
  priority?: boolean;
  fallbackSrc?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export default function OptimizedDriveImage({
  src,
  size = "md",
  priority = false,
  className,
  alt = "",
  fallbackSrc,
  ...props
}: OptimizedDriveImageProps) {
  const optimizedSrc = driveDisplayUrl(src, size);
  const [imgSrc, setImgSrc] = useState(optimizedSrc);

  useEffect(() => {
    setImgSrc(optimizedSrc);
  }, [optimizedSrc]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={cn(className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => {
        if (fallbackSrc && imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
      }}
      {...props}
    />
  );
}
