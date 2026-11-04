"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Flag,
  ImageIcon,
  MessageCircle,
  Play,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Activity, Review, ReviewComment } from "@/lib/types";
import { reviewNote } from "@/lib/data";
import { formatDate, formatRelative, initials, plural } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";

const REVIEW_MIN = 60;
const REVIEW_MAX = 600;
const MAX_PHOTOS = 5;
const CLAMP_LENGTH = 320;

const contentReportReasons = [
  "Личные данные или контакты",
  "Оскорбления и нецензурно",
  "Реклама или фейковый отзыв",
  "Фото или видео чужих детей",
  "Не соответствует занятию",
];

interface MediaItem {
  url: string;
  kind: "photo" | "video";
}

interface ReviewsBlockProps {
  activity: Activity;
  limit?: number;
}

function draftKey(slug: string) {
  return `talentro:review-draft:${slug}`;
}

export function ReviewsBlock({ activity, limit }: ReviewsBlockProps) {
  const { user, requestAuth, toast } = useApp();
  const [localReviews, setLocalReviews] = useState<Review[]>([]);
  const [reviewVotes, setReviewVotes] = useState<Record<string, "+1" | "-1">>({});
  const [extraComments, setExtraComments] = useState<Record<string, ReviewComment[]>>({});
  const [openThreads, setOpenThreads] = useState<string[]>([]);
  const [expandedTexts, setExpandedTexts] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [report, setReport] = useState<{ excerpt: string; reason: string; detail: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(
    () =>
      [...localReviews, ...activity.reviews].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [activity.reviews, localReviews],
  );
  const total = ordered.length;
  const shown = limit ? ordered.slice(0, limit) : ordered;

  // Черновик отзыва живёт в localStorage до отправки (§10.19).
  /* localStorage недоступен на сервере: восстанавливаем черновик после монтирования. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(activity.slug));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { text?: string; consent?: boolean };
      if (parsed.text) {
        setText(parsed.text);
        setConsent(Boolean(parsed.consent));
        setFormOpen(true);
        setDraftRestored(true);
      }
    } catch {
      // повреждённый черновик игнорируем
    }
    // Проверяем один раз на смену карточки.
  }, [activity.slug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!formOpen) return;
    try {
      window.localStorage.setItem(draftKey(activity.slug), JSON.stringify({ text, consent }));
    } catch {
      // приватный режим — черновик не сохраняем
    }
  }, [activity.slug, consent, formOpen, text]);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(null);
      if (event.key === "ArrowRight")
        setViewer((current) =>
          current ? { ...current, index: (current.index + 1) % current.items.length } : current,
        );
      if (event.key === "ArrowLeft")
        setViewer((current) =>
          current
            ? { ...current, index: (current.index - 1 + current.items.length) % current.items.length }
            : current,
        );
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer]);

  const openForm = () => {
    if (!user) {
      requestAuth("Войдите, чтобы оставить отзыв");
      return;
    }
    setFormOpen(true);
  };

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: MediaItem[] = [];
    let photoOverflow = false;
    let videoOverflow = false;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const alreadyVideo = media.filter((item) => item.kind === "video").length;
      const alreadyPhotos = media.filter((item) => item.kind === "photo").length;
      if (isVideo && (alreadyVideo + next.filter((i) => i.kind === "video").length >= 1)) {
        videoOverflow = true;
        continue;
      }
      if (!isVideo && alreadyPhotos + next.filter((i) => i.kind === "photo").length >= MAX_PHOTOS) {
        photoOverflow = true;
        continue;
      }
      next.push({ url: URL.createObjectURL(file), kind: isVideo ? "video" : "photo" });
    }
    if (photoOverflow || videoOverflow) {
      toast({
        title: photoOverflow ? `До ${MAX_PHOTOS} фото` : "Видео уже прикреплено",
        description: photoOverflow
          ? "К отзыву можно приложить до пяти фото и одно видео."
          : "К одному отзыву — одно видео.",
      });
    }
    setMedia((current) => [...current, ...next]);
    setError("");
  };

  const validate = (value: string) => {
    const length = value.trim().length;
    if (length < REVIEW_MIN) return `Минимум ${REVIEW_MIN} знаков — сейчас ${length}.`;
    if (length > REVIEW_MAX) return `Максимум ${REVIEW_MAX} знаков — сейчас ${length}.`;
    if (!consent) return "Нужно согласиться с условиями.";
    return "";
  };

  const publish = () => {
    if (!user) {
      requestAuth("Войдите, чтобы оставить отзыв");
      return;
    }
    const message = validate(text);
    if (message) {
      setError(message);
      return;
    }
    const review: Review = {
      id: `local-${Date.now()}`,
      author: user.name,
      avatarColor: user.avatarColor,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      votesPlus: 0,
      votesMinus: 0,
      photos: media.filter((item) => item.kind === "photo").map((item) => item.url),
      video: media.find((item) => item.kind === "video")?.url,
    };
    // Второй отзыв того же автора заменяет первый.
    setLocalReviews((current) => [review, ...current.filter((item) => !item.id.startsWith("local-"))]);
    try {
      window.localStorage.removeItem(draftKey(activity.slug));
    } catch {
      // черновик мог не сохраниться
    }
    setText("");
    setConsent(false);
    setMedia([]);
    setError("");
    setDraftRestored(false);
    setFormOpen(false);
    toast({
      title: "Отзыв опубликован",
      description: "Он виден сразу, без предварительной проверки.",
      tone: "success",
    });
  };

  const voteReview = (reviewId: string, value: "+1" | "-1", own: boolean) => {
    if (!user) {
      requestAuth("Войдите, чтобы оценивать отзывы");
      return;
    }
    if (own) {
      toast({ title: "Свой отзыв оценить нельзя" });
      return;
    }
    setReviewVotes((current) => {
      const next = { ...current };
      if (next[reviewId] === value) delete next[reviewId];
      else next[reviewId] = value;
      return next;
    });
  };

  const submitReply = (reviewId: string) => {
    if (!user) {
      requestAuth("Войдите, чтобы ответить");
      return;
    }
    if (!replyText.trim()) return;
    const comment: ReviewComment = {
      id: `comment-${Date.now()}`,
      author: user.name,
      avatarColor: user.avatarColor,
      text: replyText.trim(),
      createdAt: new Date().toISOString(),
    };
    setExtraComments((current) => ({ ...current, [reviewId]: [...(current[reviewId] ?? []), comment] }));
    setOpenThreads((current) => (current.includes(reviewId) ? current : [...current, reviewId]));
    setReplyText("");
    setReplyTo(null);
    toast({ title: "Ответ добавлен", tone: "success" });
  };

  const sendReport = () => {
    setReport(null);
    toast({
      title: "Жалоба отправлена",
      description: "Модератор проверит запись во второй очереди.",
      tone: "success",
    });
  };

  const reviewMedia = (review: Review): MediaItem[] => [
    ...(review.photos ?? []).map((url) => ({ url, kind: "photo" as const })),
    ...(review.video ? [{ url: review.video, kind: "video" as const }] : []),
  ];

  return (
    <section className="detailCard reviewsCard" id="reviews" aria-labelledby="reviews-title">
      <div className="detailCardHead reviewsHead">
        <div>
          <span className="eyebrow">Мнения посетителей</span>
          <h2 id="reviews-title">Отзывы ({total})</h2>
        </div>
        <button type="button" className="btn btn--soft" onClick={openForm} aria-expanded={formOpen}>
          <MessageCircle size={16} /> Написать отзыв
        </button>
      </div>

      <p className="reviewDisclaimer">{reviewNote}</p>

      {formOpen ? (
        <div className="reviewForm">
          <div className="reviewFormHead">
            <span className="avatar" style={{ background: user?.avatarColor ?? "#8B5CF6" }}>
              {user ? initials(user.name) : <UserRound size={16} />}
            </span>
            <div>
              <strong>{user?.name ?? "Гость"}</strong>
              <small>Один отзыв на карточку: {REVIEW_MIN}–{REVIEW_MAX} знаков, до {MAX_PHOTOS} фото и одно видео.</small>
            </div>
            <button type="button" className="reviewFormClose" aria-label="Закрыть форму" onClick={() => setFormOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <label className="fieldLabel" htmlFor="review-text">
            Ваш отзыв
          </label>
          <textarea
            id="review-text"
            className="textarea"
            rows={4}
            value={text}
            onChange={(event) => {
              setText(event.target.value.slice(0, REVIEW_MAX));
              setError("");
              setDraftRestored(false);
            }}
            placeholder="Что понравилось, что стоит учесть? Без личных данных, телефонов и чужих детей в кадре."
            maxLength={REVIEW_MAX}
          />
          <div className="reviewAttach">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="srOnly"
              id="review-media"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={15} /> Прикрепить фото или видео
            </button>
            {media.length ? (
              <div className="reviewAttachList">
                {media.map((item, index) => (
                  <span className="reviewAttachItem" key={`${item.url}-${index}`}>
                    {item.kind === "video" ? (
                      <video src={item.url} muted playsInline />
                    ) : (
                      <img src={item.url} alt="" />
                    )}
                    <button
                      type="button"
                      aria-label="Убрать вложение"
                      onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <label className={cn("reviewConsent", consent && "isActive")}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              Согласен с условиями использования и подтверждаю, что писал(а) по личному опыту.
              <Link href="/rules"> Правила публикации</Link>
            </span>
          </label>

          {draftRestored ? <p className="reviewDraftNote">Восстановили ваш черновик.</p> : null}

          <div className="reviewFormFoot">
            <span className={cn("formHint", error && "formHint--error")}>
              {error || `${text.trim().length}/${REVIEW_MAX}`}
            </span>
            <div className="reviewFormActions">
              <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
                Отмена
              </button>
              <button type="button" className="btn btn--primary" onClick={publish} disabled={!consent}>
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="reviewEmpty">
          <MessageCircle size={22} />
          <strong>Отзывов пока нет</strong>
          <span>Расскажите, как прошло занятие — так другим проще выбрать.</span>
          <button type="button" className="btn btn--primary" onClick={openForm}>
            Написать первый отзыв
          </button>
        </div>
      ) : (
        <div className="reviewList">
          {shown.map((review) => {
            const comments = [...(review.comments ?? []), ...(extraComments[review.id] ?? [])];
            const myVote = reviewVotes[review.id];
            const own = Boolean(user && review.author === user.name);
            const photos = review.photos ?? [];
            const isLong = review.text.length > CLAMP_LENGTH;
            const expanded = expandedTexts.includes(review.id);
            const threadOpen = openThreads.includes(review.id);
            return (
              <article className="reviewItem" key={review.id}>
                <div className="reviewAuthor">
                  <span className="avatar" style={{ background: review.avatarColor }}>
                    {initials(review.author)}
                  </span>
                  <div>
                    <strong>{review.author}</strong>
                    <small>{formatRelative(review.createdAt)}</small>
                  </div>
                  <button
                    type="button"
                    className="reviewReport"
                    onClick={() => setReport({ excerpt: review.text.slice(0, 90), reason: contentReportReasons[0], detail: "" })}
                  >
                    <Flag size={13} /> Пожаловаться
                  </button>
                </div>

                <p className={cn(isLong && !expanded && "reviewText--clamped")}>{review.text}</p>
                {isLong ? (
                  <button
                    type="button"
                    className="reviewExpand"
                    onClick={() =>
                      setExpandedTexts((current) =>
                        current.includes(review.id)
                          ? current.filter((id) => id !== review.id)
                          : [...current, review.id],
                      )
                    }
                  >
                    {expanded ? "Свернуть" : "Показать полностью"}
                  </button>
                ) : null}

                {photos.length || review.video ? (
                  <div className="reviewMedia">
                    {photos.map((photo, index) => (
                      <button
                        type="button"
                        key={photo + index}
                        className="reviewMediaItem"
                        aria-label={`Открыть фото ${index + 1}`}
                        onClick={() => setViewer({ items: reviewMedia(review), index })}
                      >
                        <img src={photo} alt={`Фото автора: ${review.author}`} loading="lazy" />
                      </button>
                    ))}
                    {review.video ? (
                      <button
                        type="button"
                        className="reviewMediaItem reviewMediaItem--video"
                        aria-label="Открыть видео"
                        onClick={() =>
                          setViewer({ items: reviewMedia(review), index: photos.length })
                        }
                      >
                        <video src={review.video} muted playsInline preload="metadata" />
                        <span className="reviewPlay">
                          <Play size={20} fill="currentColor" />
                        </span>
                        {review.videoDuration ? (
                          <span className="reviewDuration">{review.videoDuration}</span>
                        ) : null}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="reviewActions">
                  <span className="reviewVoteGroup" role="group" aria-label="Оценить отзыв">
                    <button
                      type="button"
                      className={cn("reviewVote", myVote === "+1" && "isActive")}
                      aria-pressed={myVote === "+1"}
                      onClick={() => voteReview(review.id, "+1", own)}
                    >
                      <ThumbsUp size={13} />
                      {review.votesPlus + (myVote === "+1" ? 1 : 0)}
                    </button>
                    <button
                      type="button"
                      className={cn("reviewVote", myVote === "-1" && "isNegative")}
                      aria-pressed={myVote === "-1"}
                      onClick={() => voteReview(review.id, "-1", own)}
                    >
                      <ThumbsDown size={13} />
                      {review.votesMinus + (myVote === "-1" ? 1 : 0)}
                    </button>
                  </span>
                  <button
                    type="button"
                    className="reviewReply"
                    onClick={() => {
                      if (!user) {
                        requestAuth("Войдите, чтобы ответить");
                        return;
                      }
                      setReplyTo(replyTo === review.id ? null : review.id);
                    }}
                  >
                    <MessageCircle size={13} /> Ответить
                  </button>
                  <span className="reviewDate" title={formatDate(review.createdAt)}>
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                {comments.length ? (
                  <div className="reviewThread">
                    <button
                      type="button"
                      className="threadToggle"
                      aria-expanded={threadOpen}
                      onClick={() =>
                        setOpenThreads((current) =>
                          current.includes(review.id)
                            ? current.filter((id) => id !== review.id)
                            : [...current, review.id],
                        )
                      }
                    >
                      <ChevronDown size={14} className={cn(threadOpen && "isRotated")} />
                      {comments.length} {plural(comments.length, "ответ", "ответа", "ответов")}
                    </button>
                    {threadOpen ? (
                      <div className="commentList">
                        {comments.map((comment) => (
                          <div
                            className={cn("commentItem", comment.isOrganization && "commentItem--org")}
                            key={comment.id}
                          >
                            <span className="avatar avatar--sm" style={{ background: comment.avatarColor }}>
                              {initials(comment.author)}
                            </span>
                            <div>
                              <div className="commentHead">
                                <strong>{comment.author}</strong>
                                {comment.isOrganization ? (
                                  <span className="orgReplyTag">ответ организации</span>
                                ) : null}
                                <small>{formatRelative(comment.createdAt)}</small>
                                <button
                                  type="button"
                                  className="commentReport"
                                  onClick={() =>
                                    setReport({
                                      excerpt: comment.text.slice(0, 90),
                                      reason: contentReportReasons[0],
                                      detail: "",
                                    })
                                  }
                                >
                                  <Flag size={12} /> Пожаловаться
                                </button>
                              </div>
                              <p>{comment.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {replyTo === review.id ? (
                  <div className="replyForm">
                    <textarea
                      className="textarea textarea--sm"
                      rows={2}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="Ваш ответ…"
                      aria-label="Ответ на отзыв"
                    />
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => submitReply(review.id)}>
                      <Send size={14} /> Отправить
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}

          {limit && total > limit ? (
            <Link href={`/activities/${activity.slug}/reviews`} className="reviewShowAll">
              Показать все {total} {plural(total, "отзыв", "отзыва", "отзывов")} <ChevronDown size={15} />
            </Link>
          ) : null}
        </div>
      )}

      {viewer ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр вложений отзыва"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewer(null);
          }}
        >
          <button type="button" className="lightboxClose" aria-label="Закрыть" onClick={() => setViewer(null)}>
            <X size={22} />
          </button>
          {viewer.items.length > 1 ? (
            <>
              <button
                type="button"
                className="lightboxNav lightboxNav--prev"
                aria-label="Предыдущее вложение"
                onClick={() =>
                  setViewer((current) =>
                    current
                      ? { ...current, index: (current.index - 1 + current.items.length) % current.items.length }
                      : current,
                  )
                }
              >
                ‹
              </button>
              <button
                type="button"
                className="lightboxNav lightboxNav--next"
                aria-label="Следующее вложение"
                onClick={() =>
                  setViewer((current) =>
                    current ? { ...current, index: (current.index + 1) % current.items.length } : current,
                  )
                }
              >
                ›
              </button>
            </>
          ) : null}
          <figure>
            {viewer.items[viewer.index].kind === "video" ? (
              <video src={viewer.items[viewer.index].url} controls autoPlay playsInline />
            ) : (
              <img src={viewer.items[viewer.index].url} alt="" />
            )}
            <figcaption>
              {viewer.index + 1} из {viewer.items.length}
            </figcaption>
          </figure>
        </div>
      ) : null}

      {report ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setReport(null)}>
          <div
            className="reportModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-report-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modalClose reportClose" aria-label="Закрыть" onClick={() => setReport(null)}>
              <X size={20} />
            </button>
            <span className="eyebrow">Жалоба на отзыв</span>
            <h2 id="review-report-title">Что не так с этой записью?</h2>
            <p className="reportQuote">{report.excerpt}…</p>
            <fieldset className="reportReasons">
              <legend className="srOnly">Причина жалобы</legend>
              {contentReportReasons.map((reason) => (
                <label
                  key={reason}
                  className={cn("reportReason", report.reason === reason && "isActive")}
                >
                  <input
                    type="radio"
                    name="review-report-reason"
                    value={reason}
                    checked={report.reason === reason}
                    onChange={() => setReport({ ...report, reason })}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </fieldset>
            <label className="fieldLabel" htmlFor="review-report-detail">
              Уточнение <span>необязательно</span>
            </label>
            <textarea
              id="review-report-detail"
              className="textarea"
              rows={3}
              value={report.detail}
              onChange={(event) => setReport({ ...report, detail: event.target.value })}
              placeholder="Что именно нарушено?"
            />
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={sendReport}>
              Отправить жалобу
            </button>
            <p className="reportHint">Жалоба не публикуется. Модератор может скрыть запись до разбора.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
