"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState, type FC } from "react";

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
  // Фолбэком служит пустая обложка, а не похожая картинка из моков: фото сида
  // лежат в /srv/media на сервере, и их отсутствие — факт, а не неполадка.
  const [photo, setPhoto] = useState({ src, failed: false });
  if (photo.src !== src) setPhoto({ src, failed: false });

  if (photo.failed) {
    return (
      <div className="coverEmpty">
        <ImageOff size={18} />
        <span>Фото нет</span>
      </div>
    );
  }

  // next/image сам собирает srcset и форматы; в Next 16 проп srcSet у <Image> отсутствует,
  // а ручные ?fm=…&w=… адреса к локальным фото (/images/…) всё равно не обслуживаются.
  return (
    <Image
      src={src}
      onError={() => setPhoto({ src, failed: true })}
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
