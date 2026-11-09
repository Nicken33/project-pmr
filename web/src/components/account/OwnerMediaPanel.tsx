"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Undo2, Video } from "lucide-react";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { useApp } from "@/components/providers/AppProviders";
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  VIDEO_MAX_BYTES,
  VIDEO_TYPES,
  checkUpload,
  deleteMedia,
  toOwnerError,
  uploadMedia,
  type OwnerMedia,
  type UploadKind,
} from "@/lib/owner-api";

/**
 * Медиа карточки владельца: загрузка фото и видео, удаление, показ сохранённого
 * `/media/…`. Пределы проверяются до отправки для удобства, но решает сервер:
 * его 413 и 415 показываются текстом из конверта §9, а не подменяются успехом.
 * Галерею закрытых статусов сервер защищает от правок (409): на витрине новые
 * файлы попали бы в каталог без проверки, а на модерации подменили бы то, что
 * смотрит модератор. Панель честно показывает правило и следующий шаг.
 */
export function OwnerMediaPanel({
  cardId,
  status,
  photos,
  videos,
  onChanged,
  onUnpublish,
  unpublishing,
}: {
  cardId: string;
  /** Статус как его назвал сервер: guard медиа закрывает `published` и `on_moderation`. */
  status: string;
  photos: OwnerMedia[];
  videos: OwnerMedia[];
  onChanged: () => void;
  onUnpublish: () => void;
  unpublishing?: boolean;
}) {
  const { toast } = useApp();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const published = status === "published";
  const onModeration = status === "on_moderation";
  const locked = published || onModeration;

  const send = async (file: File, kind: UploadKind) => {
    const invalid = checkUpload(file, kind);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      await uploadMedia(cardId, file, kind);
      toast({
        title: kind === "photo" ? "Фото загружено" : "Видео загружено",
        description: "Файл сохранён на сервере и привязан к карточке.",
        tone: "success",
      });
      onChanged();
    } catch (reason) {
      const apiError = toOwnerError(reason);
      setError(`${apiError.message} (ответ ${apiError.status})`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (media: OwnerMedia) => {
    if (media.id === undefined) return;
    const mediaId = String(media.id);
    setBusy(mediaId);
    setError(null);
    try {
      await deleteMedia(cardId, mediaId);
      toast({ title: "Файл удалён", description: "Сервер удалил запись и сам файл.", tone: "success" });
      onChanged();
    } catch (reason) {
      const apiError = toOwnerError(reason);
      setError(`${apiError.message} (ответ ${apiError.status})`);
    } finally {
      setBusy(null);
    }
  };

  const pick = (kind: UploadKind, files: FileList | null) => {
    const file = files?.[0];
    if (file) void send(file, kind);
  };

  // Деталь кабинета присылает числовой `id` каждого файла. Если его вдруг нет,
  // удаление адресовать нечем, и предлагать кнопку, которая ничего не удалит, нельзя.
  const identifiable = [...photos, ...videos].every((item) => item.id !== undefined);
  const total = photos.length + videos.length;

  return (
    <section className="appFormFieldset" aria-label="Медиа карточки">
      <div className="appFormSetHead">
        <h2>Медиа</h2>
        <span className="appFormSetCount">{total}</span>
      </div>
      <p className="appFormSetHint">
        Фото — JPEG, PNG или WebP до {Math.round(PHOTO_MAX_BYTES / (1024 * 1024))} МиБ; видео — MP4
        до {Math.round(VIDEO_MAX_BYTES / (1024 * 1024))} МиБ. SVG сервер не принимает. Первое фото
        по порядку становится обложкой карточки.
      </p>

      {locked ? (
        <div className="cabinetNotice" role="alert">
          {published ? (
            <p>
              Анкета опубликована: сервер не принимает новые фото и видео и не удаляет старые, пока
              карточка на витрине, — иначе новые файлы попали бы в каталог без проверки. Снимите
              анкету с публикации, затем меняйте медиа.
            </p>
          ) : (
            <p>
              Анкета на проверке: модератор смотрит именно эти фото и видео, поэтому сервер не
              принимает новые файлы и не удаляет старые. Дождитесь решения, затем меняйте медиа и
              подавайте анкету заново.
            </p>
          )}
          {published ? (
            <button
              type="button"
              className="btn btn--soft btn--sm"
              disabled={unpublishing || busy !== null}
              onClick={onUnpublish}
            >
              {unpublishing ? <Loader2 size={14} /> : <Undo2 size={14} />}
              {unpublishing ? "Снимаем…" : "Снять с публикации"}
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={photoInput}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="srOnly"
        onChange={(event) => {
          pick("photo", event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        className="srOnly"
        onChange={(event) => {
          pick("video", event.target.files);
          event.target.value = "";
        }}
      />

      {total === 0 ? (
        <button
          type="button"
          className="mediaAdminEmpty"
          disabled={busy !== null || locked}
          onClick={() => photoInput.current?.click()}
        >
          <ImagePlus size={22} />
          <span>Фото пока нет</span>
          <small>Без фото карточка выглядит пустой в каталоге — загрузите хотя бы одно.</small>
        </button>
      ) : (
        <ul className="mediaAdminGrid">
          {photos.map((media, index) => (
            <li className="mediaAdminItem" key={`photo-${media.id ?? media.path}-${index}`}>
              <span className="mediaAdminThumb">
                <ResponsiveImage
                  src={media.path}
                  alt={media.caption ?? "Фото карточки"}
                  width={400}
                  height={300}
                  sizes="(max-width: 768px) 50vw, 200px"
                />
                {index === 0 ? <span className="mediaAdminCover">Обложка</span> : null}
              </span>
              <MediaTools
                media={media}
                busy={busy === String(media.id)}
                disabled={busy !== null || locked || media.id === undefined}
                onRemove={() => void remove(media)}
              />
            </li>
          ))}
          {videos.map((media, index) => (
            <li className="mediaAdminItem" key={`video-${media.id ?? media.path}-${index}`}>
              <span className="mediaAdminThumb">
                {/* next/image видео не умеет: источник — сохранённый /media/… бэкенда. */}
                <video src={media.path} controls muted playsInline preload="metadata" />
              </span>
              <MediaTools
                media={media}
                busy={busy === String(media.id)}
                disabled={busy !== null || locked || media.id === undefined}
                onRemove={() => void remove(media)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mediaAdminActions">
        <button
          type="button"
          className="btn btn--soft"
          disabled={busy !== null || locked}
          onClick={() => photoInput.current?.click()}
        >
          {busy === "photo" ? <Loader2 size={16} /> : <ImagePlus size={16} />}
          {busy === "photo" ? "Загружаем…" : "Загрузить фото"}
        </button>
        <button
          type="button"
          className="btn btn--soft"
          disabled={busy !== null || locked}
          onClick={() => videoInput.current?.click()}
        >
          {busy === "video" ? <Loader2 size={16} /> : <Video size={16} />}
          {busy === "video" ? "Загружаем…" : "Загрузить видео"}
        </button>
      </div>

      {error ? (
        <p className="formHint formHint--error" role="alert">
          {error}
        </p>
      ) : null}
      {!identifiable && total > 0 ? (
        <p className="formHint">
          Сервер не прислал номера файлов — удаление недоступно. Загрузка при этом работает.
        </p>
      ) : null}
    </section>
  );
}

function MediaTools({
  media,
  busy,
  disabled,
  onRemove,
}: {
  media: OwnerMedia;
  busy: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="mediaAdminTools">
      <small className="mediaAdminPath" title={media.path}>{media.path}</small>
      <button
        type="button"
        aria-label="Удалить файл"
        title={media.id === undefined ? "Сервер не прислал номер файла" : "Удалить файл"}
        disabled={disabled}
        onClick={onRemove}
      >
        {busy ? <Loader2 size={14} /> : <Trash2 size={14} />}
      </button>
    </span>
  );
}