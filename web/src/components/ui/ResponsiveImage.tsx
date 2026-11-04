"use client";

import Image from "next/image";
import type { FC } from "react";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

export const ResponsiveImage: FC<ResponsiveImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className,
  priority = false,
}) => {
  // next/image сам собирает srcset и форматы; в Next 16 проп srcSet у <Image> отсутствует,
  // а ручные ?fm=…&w=… адресаToLocal фото (/images/…) всё равно не обслуживаются.
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      // 75, а не 80: Next 16 разрешает только значения из images.qualities,
      // а по умолчанию там один 75 — с любой другой цифрой /_next/image отвечает 400.
      quality={75}
      loading={priority ? "eager" : "lazy"}
      placeholder="blur"
      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgAB/1h1ZQAAAABJRU5ErkJggg=="
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
};
