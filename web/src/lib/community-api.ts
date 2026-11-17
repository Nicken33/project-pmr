import { apiBaseUrl, getClientAuthToken } from "@/lib/api";
import { colorFromString, normalizeMediaPath } from "@/lib/utils";
import type { Review } from "@/lib/types";

export interface ReviewRecord {
  id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
  photos?: { id: string; path: string }[];
  videos?: { id: string; path: string }[];
}
export interface ReviewPage { items: ReviewRecord[]; total: number; page: number; limit: number }
export class CommunityError extends Error {
  constructor(public status: number, message: string, public code = "") { super(message); }
}
export function numericId(id: string): string {
  if (!/^[1-9]\d{0,18}$/.test(id)) throw new CommunityError(400, "Не удалось определить ID записи");
  return id;
}
export async function checkedResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch {
    if (response.ok) throw new CommunityError(502, "Сервер вернул некорректный ответ. Действие не подтверждено.");
    data = null;
  }
  if (!response.ok) {
    const error = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new CommunityError(response.status, error?.message || `Сервер вернул ошибку ${response.status}`, error?.code);
  }
  return data as T;
}
export async function communityRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/me${path}`, { ...init, cache: "no-store", headers: { accept: "application/json", ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}), ...init?.headers } });
  } catch { throw new CommunityError(0, "Не удалось связаться с сервером. Проверьте соединение."); }
  return checkedResponse<T>(response);
}
export function reviewFromRecord(row: ReviewRecord): Review {
  return { id: String(row.id), authorId: String(row.author_id), author: row.author_name,
    avatarColor: colorFromString(String(row.author_id)), text: row.text, createdAt: row.created_at,
    votesPlus: 0, votesMinus: 0,
    media: [...(row.photos ?? []).map((x) => ({id:String(x.id),url:normalizeMediaPath(x.path),kind:"photo" as const})), ...(row.videos ?? []).map((x) => ({id:String(x.id),url:normalizeMediaPath(x.path),kind:"video" as const}))],
    photos: (row.photos ?? []).map((x) => normalizeMediaPath(x.path)).filter(Boolean),
    video: row.videos?.[0]?.path ? normalizeMediaPath(row.videos[0].path) : undefined };
}
export function listReviews(activityId: string, page = 1) {
  return communityRequest<ReviewPage>(`/activities/${numericId(activityId)}/reviews?page=${page}&limit=20`);
}
export async function createReview(activityId: string, text: string) {
  const result = await communityRequest<ReviewRecord>(`/activities/${numericId(activityId)}/reviews`, { method: "POST", body: JSON.stringify({ text }) });
  if (!result?.id) throw new CommunityError(502, "Сервер не подтвердил создание отзыва");
  return result;
}
export function reportContent(targetType: "card" | "review" | "media", targetId: string, reason: string, detail = "") {
  return communityRequest<{ id: string }>("/reports", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: numericId(targetId), reason, detail }) });
}

/** Small files use the session proxy; large files bypass a hosting request-size cap. */
export async function uploadReviewFile(reviewId: string, file: File, kind: "photo" | "video") {
  const id = numericId(reviewId);
  const maxBytes = (kind === "photo" ? 10 : 50) * 1024 * 1024;
  if (file.size === 0 || file.size > maxBytes) throw new CommunityError(413, kind === "photo" ? "Фото должно быть не больше 10 МиБ" : "Видео должно быть не больше 50 МиБ");
  if (kind === "photo" && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new CommunityError(415, "Поддерживаются JPG, PNG и WebP");
  if (kind === "video" && file.type !== "video/mp4") throw new CommunityError(415, "Видео должно быть MP4 (H.264/AAC), до 30 секунд");
  const form = new FormData(); form.append("file", file);
  const path = `/reviews/${id}/${kind === "photo" ? "photos" : "videos"}`;
  if (file.size > 4 * 1024 * 1024 && apiBaseUrl()) {
    const token = await getClientAuthToken();
    if (!token) throw new CommunityError(401, "Сессия истекла. Войдите заново.");
    try {
      const response = await fetch(`${apiBaseUrl()}/api/v1${path}`, { method: "POST", body: form, headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      return await checkedResponse<{ id: string; path: string }>(response);
    } catch (error) {
      if (error instanceof CommunityError) throw error;
      throw new CommunityError(0, "Не удалось загрузить файл напрямую в API. Проверьте адрес сервера и ALLOWED_ORIGINS для домена сайта.");
    }
  }
  return communityRequest<{ id: string; path: string }>(path, { method: "POST", body: form });
}
