"use client";

import Image from "next/image";
import { useEffect, useState, type FC } from "react";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

/** Фото сида живут в /srv/media на сервере; без него карточка не должна ломаться. */
const FALLBACK_SRC = "/images/kids.jpg";

export const ResponsiveImage: FC<ResponsiveImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className,
  priority = false,
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  // next/image сам собирает srcset и форматы; в Next 16 проп srcSet у <Image> отсутствует,
  // а ручные ?fm=…&w=… адресаToLocal фото (/images/…) всё равно не обслуживаются.
  return (
    <Image
      src={currentSrc}
      onError={() => {
        if (currentSrc !== FALLBACK_SRC) setCurrentSrc(FALLBACK_SRC);
      }}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      quality={80}
      loading={priority ? "eager" : "lazy"}
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgAB/1h1ZQAAAABJRU5ErkJggg=="
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
};
