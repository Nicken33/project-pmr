"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, ImageIcon, MessageCircle, Trash2, X } from "lucide-react";
import type { Activity, Review } from "@/lib/types";
import { formatRelative, initials } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProviders";
import { createReview, listReviews, reportContent, reviewFromRecord, uploadReviewFile } from "@/lib/community-api";

const reasons = ["Оскорбления", "Реклама или фейковый отзыв", "Личные данные", "Не соответствует занятию", "Другое"];
type Attachment = { url: string; file: File; kind: "photo" | "video" };
type ShownMedia = { id?: string; url: string; kind: "photo" | "video" };

export function ReviewsBlock({ activity, limit }: { activity: Activity; limit?: number }) {
  const { user, requestAuth, toast } = useApp();
  const [reviews, setReviews] = useState<Review[]>(activity.reviews);
  const [total, setTotal] = useState(activity.reviews.length);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [media, setMedia] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [savedReviewId, setSavedReviewId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ShownMedia | null>(null);
  const [report, setReport] = useState<{ id: string; type: "review" | "media"; reason: string; detail: string } | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [reportError, setReportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const publishing = useRef(false);
  const loadVersion = useRef({version:0});
  const draftKey = `talentro:review-draft:${activity.id}:${user?.id ?? "guest"}`;

  const load = useCallback(async (nextPage = 1) => {
    const version = ++loadVersion.current.version;
    setLoading(true); setLoadError("");
    try {
      const result = await listReviews(activity.id, nextPage);
      if (version !== loadVersion.current.version) return;
      const items = result.items.map(reviewFromRecord);
      setReviews((current) => nextPage === 1 ? items : [...current, ...items.filter((row) => !current.some((x) => x.id === row.id))]);
      setTotal(result.total); setPage(result.page);
    } catch (error) {
      if (version === loadVersion.current.version) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить отзывы");
    } finally { if (version === loadVersion.current.version) setLoading(false); }
  }, [activity.id]);

  useEffect(() => {
    let active = true;
    const state = loadVersion.current;
    // Start after mounting; cleanup also cancels an initial StrictMode mount.
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; state.version++; };
  }, [load]);
  useEffect(() => {
    const activeUrls = urls.current;
    return () => { activeUrls.forEach((url) => URL.revokeObjectURL(url)); activeUrls.clear(); };
  }, []);


  const changeText = (value: string) => {
    setText(value); setError("");
    try { localStorage.setItem(draftKey, JSON.stringify({ text: value })); } catch { /* Optional draft. */ }
  };
  const openForm = () => {
    if (!user) { requestAuth("Войдите, чтобы оставить отзыв"); return; }
    if (!text) {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { text?: string } | null;
        if (typeof draft?.text === "string") setText(draft.text);
      } catch { /* A corrupt draft must not prevent server actions. */ }
    }
    setFormOpen(true);
  };
  const removeAttachment = (url: string) => {
    URL.revokeObjectURL(url); urls.current.delete(url);
    setMedia((current) => current.filter((item) => item.url !== url));
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added: Attachment[] = []; let message = "";
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith("video/") ? "video" : "photo";
      if (kind === "photo" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { message = "Фото: JPG, PNG или WebP"; continue; }
      if (kind === "video" && file.type !== "video/mp4") { message = "Видео: MP4 (H.264/AAC), до 30 секунд"; continue; }
      if (!file.size || file.size > (kind === "photo" ? 10 : 50) * 1024 * 1024) { message = kind === "photo" ? "Фото должно быть не больше 10 МиБ" : "Видео должно быть не больше 50 МиБ"; continue; }
      if ([...media, ...added].filter((item) => item.kind === kind).length >= (kind === "photo" ? 5 : 1)) { message = "Можно прикрепить до пяти фото и одного видео"; continue; }
      const url = URL.createObjectURL(file); urls.current.add(url); added.push({ file, kind, url });
    }
    setMedia((current) => [...current, ...added]); setError(message);
  };
  const publish = async () => {
    if (!user) { requestAuth("Войдите, чтобы оставить отзыв"); return; }
    if (publishing.current) return;
    if (!text.trim() || text.trim().length > 600 || !consent) { setError("Напишите отзыв от 1 до 600 символов и подтвердите согласие."); return; }
    publishing.current = true; setPending(true); setError("");
    let reviewId = savedReviewId;
    try {
      if (!reviewId) {
        const created = await createReview(activity.id, text.trim());
        reviewId = String(created.id); setSavedReviewId(reviewId);
      }
      for (const attachment of media) {
        await uploadReviewFile(reviewId, attachment.file, attachment.kind);
        removeAttachment(attachment.url);
      }
      setSavedReviewId(null); setText(""); setConsent(false); setFormOpen(false);
      try { localStorage.removeItem(draftKey); } catch { /* Optional draft. */ }
      await load();
      toast({ title: "Отзыв опубликован", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить отзыв";
      setError(reviewId ? `Текст отзыва сохранён. Не все вложения загрузились: ${message}. Можно повторить загрузку оставшихся файлов.` : message);
      if (reviewId) await load();
    } finally { publishing.current = false; setPending(false); }
  };
  const startReport = (type: "review" | "media", id: string) => {
    if (!user) { requestAuth("Войдите, чтобы отправить жалобу"); return; }
    setReportError(""); setReport({ type, id, reason: reasons[0], detail: "" });
  };
  const sendReport = async () => {
    if (!report || reportPending) return;
    setReportPending(true); setReportError("");
    try {
      await reportContent(report.type, report.id, report.reason, report.detail);
      setReport(null); toast({ title: "Жалоба отправлена модератору", tone: "success" });
    } catch (error) { setReportError(error instanceof Error ? error.message : "Не удалось отправить жалобу"); }
    finally { setReportPending(false); }
  };
  const mediaOf = (review: Review): ShownMedia[] => review.media ?? [
    ...(review.photos ?? []).map((url) => ({ url, kind: "photo" as const })),
    ...(review.video ? [{ url: review.video, kind: "video" as const }] : []),
  ];

  return (
    <section className="detailCard reviewsCard" id="reviews" aria-labelledby="reviews-title">
      <div className="detailCardHead reviewsHead"><h2 id="reviews-title">Отзывы ({total})</h2><button type="button" className="btn btn--soft" onClick={openForm}><MessageCircle size={16} /> Написать отзыв</button></div>
      <p className="reviewDisclaimer">Один отзыв от каждого пользователя на секцию. Пишите о своём опыте.</p>
      {loadError ? <div role="alert" className="authError">{loadError} <button className="btn btn--soft" onClick={() => void load()}>Повторить</button></div> : null}
      {formOpen ? <div className="reviewForm">
        <h3>{savedReviewId ? "Завершить загрузку вложений" : "Ваш отзыв"}</h3>
        <textarea aria-label="Ваш отзыв" className="textarea" rows={4} value={text} maxLength={600} disabled={pending || Boolean(savedReviewId)} onChange={(e) => changeText(e.target.value)} />
        <input ref={fileRef} type="file" className="srOnly" accept="image/jpeg,image/png,image/webp,video/mp4" multiple disabled={pending} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => fileRef.current?.click()}><ImageIcon size={15} /> Прикрепить фото или видео</button>
        <div className="reviewAttachList">{media.map((item) => <span className="reviewAttachItem" key={item.url}>
          {item.kind === "photo" ? <img src={item.url} alt="Превью вложения" /> : <video src={item.url} muted playsInline />}
          <button aria-label="Убрать вложение" disabled={pending} onClick={() => removeAttachment(item.url)}><Trash2 size={14} /></button>
        </span>)}</div>
        <label className="reviewConsent"><input type="checkbox" checked={consent} disabled={pending} onChange={(e) => setConsent(e.target.checked)} /> Подтверждаю личный опыт и принимаю <Link href="/rules">правила публикации</Link>.</label>
        {error ? <p role="alert" className="authError">{error}</p> : null}
        <div className="reviewFormActions"><button className="btn btn--ghost" disabled={pending} onClick={() => setFormOpen(false)}>Закрыть</button><button className="btn btn--primary" disabled={pending || !consent} onClick={() => void publish()}>{pending ? "Сохраняем…" : savedReviewId ? "Повторить загрузку" : "Опубликовать"}</button></div>
      </div> : null}
      {loading ? <p role="status">Загружаем отзывы…</p> : null}
      {!loading && !loadError && total === 0 ? <p className="reviewEmpty">Отзывов пока нет. Напишите первый.</p> : null}
      <div className="reviewList">{(limit ? reviews.slice(0, limit) : reviews).map((review) => <article className="reviewItem" key={review.id}>
        <div className="reviewAuthor"><span className="avatar" style={{ background: review.avatarColor }}>{initials(review.author)}</span><div><strong>{review.author}</strong><small>{formatRelative(review.createdAt)}</small></div><button className="reviewReport" onClick={() => startReport("review", review.id)}><Flag size={13} /> Пожаловаться</button></div>
        <p>{review.text}</p>
        <div className="reviewMedia">{mediaOf(review).map((item) => <button key={item.id ?? item.url} className="reviewMediaItem" aria-label={item.kind === "photo" ? "Открыть фото" : "Открыть видео"} onClick={() => setViewer(item)}>{item.kind === "photo" ? <img src={item.url} alt={`Фото автора ${review.author}`} loading="lazy" /> : <video src={item.url} muted playsInline preload="metadata" />}</button>)}</div>
      </article>)}</div>
      {!limit && reviews.length < total ? <button className="btn btn--soft" disabled={loading} onClick={() => void load(page + 1)}>Загрузить ещё</button> : null}
      {limit && total > limit ? <Link href={`/activities/${activity.slug}/reviews`}>Все отзывы ({total})</Link> : null}
      {viewer ? <div className="lightbox" role="dialog" aria-modal="true" aria-label="Вложение отзыва" onClick={() => setViewer(null)}><button className="lightboxClose" aria-label="Закрыть вложение" onClick={() => setViewer(null)}><X /></button><div onClick={(e) => e.stopPropagation()}>{viewer.kind === "photo" ? <img src={viewer.url} alt="Фото из отзыва" /> : <video src={viewer.url} controls autoPlay playsInline />}{viewer.id ? <button className="btn btn--soft" onClick={() => startReport("media", viewer.id!)}>Пожаловаться на вложение</button> : null}</div></div> : null}
      {report ? <div className="modalBackdrop"><div className="reportModal" role="dialog" aria-modal="true" aria-label="Жалоба"><button className="modalClose" disabled={reportPending} aria-label="Закрыть жалобу" onClick={() => setReport(null)}><X /></button><h3>Отправить жалобу</h3><select aria-label="Причина жалобы" className="fieldSelect" value={report.reason} onChange={(e) => setReport({ ...report, reason: e.target.value })}>{reasons.map((reason) => <option key={reason}>{reason}</option>)}</select><textarea aria-label="Пояснение к жалобе" className="textarea" maxLength={2000} value={report.detail} onChange={(e) => setReport({ ...report, detail: e.target.value })} />{reportError ? <p role="alert" className="authError">{reportError}</p> : null}<button className="btn btn--primary" disabled={reportPending} onClick={() => void sendReport()}>{reportPending ? "Отправляем…" : "Отправить жалобу"}</button></div></div> : null}
    </section>
  );
}
