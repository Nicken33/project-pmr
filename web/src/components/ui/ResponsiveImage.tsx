"use client";

import Image from "next/image";
import { useState, type FC } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

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
  // Файлы `/media/**` раздаёт бэкенд, и на стенде их ещё нет. Битая картинка в
  // карточке выглядит как данные каталога, поэтому при ошибке — тот же пустой
  // блок, что и у занятия без фото.
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={cn("coverEmpty", className)} role="img" aria-label={`${alt} — фото недоступно`}>
        <ImageOff size={18} />
      </div>
    );
  }

  // next/image сам собирает srcset и форматы; ручной srcset у <Image> в Next 16
  // недоступен, а локальные `/images/…` через query-параметры не оптимизируются.
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
      onError={() => setFailed(true)}
    />
  );
};
