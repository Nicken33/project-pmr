import { API_BASE_URL } from '../config'

const TOKEN_KEY = 'talentro.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Ошибка API в формате {"error":{"code","message"}}. */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Понятные тексты для пользователя по коду ошибки бэка.
const friendly: Record<string, string> = {
  invalid_credentials: 'Неверная почта или пароль',
  email_taken: 'Эта почта уже зарегистрирована',
  rate_limited: 'Слишком много попыток. Попробуйте чуть позже',
  favorite_exists: 'Уже в избранном',
  review_exists: 'Вы уже оставили отзыв на эту секцию',
  own_review_forbidden: 'Нельзя оставлять отзыв на свою секцию',
  not_ready: 'Анкета ещё не готова к проверке: заполните группы, адрес с точкой на карте и расписание',
  invalid_status: 'Это действие недоступно в текущем статусе анкеты',
  file_too_large: 'Файл слишком большой',
  unsupported_file: 'Неподдерживаемый формат файла',
  invalid_video: 'Видео должно быть MP4 (H.264), не длиннее 30 секунд',
  email_unavailable: 'Отправка писем пока не настроена',
  account_blocked: 'Аккаунт заблокирован',
  unauthorized: 'Нужно войти в аккаунт',
  forbidden: 'Недостаточно прав',
  not_found: 'Не найдено',
  google_not_configured: 'Вход через Google пока не настроен',
  google_unavailable: 'Google сейчас недоступен, попробуйте позже',
  invalid_google_token: 'Google не подтвердил вход, попробуйте ещё раз',
  unverified_google_account: 'Почта в Google не подтверждена',
  invalid_credential: 'Google не передал данные для входа',
  invalid_token: 'Ссылка недействительна или устарела. Запросите письмо ещё раз',
  invalid_email: 'Введите корректную почту',
  invalid_file: 'Файл повреждён или не подходит',
  invalid_upload: 'Не удалось прочитать файл',
  missing_file: 'Файл не выбран',
  not_published: 'Анкета не опубликована',
  invalid_id: 'Неверная ссылка',
  invalid_activity_id: 'Неверная ссылка на анкету',
  invalid_media_id: 'Неверный файл',
  invalid_query: 'Неверные параметры поиска',
  internal_error: 'Ошибка на сервере, попробуйте позже',
  create_failed: 'Не удалось сохранить, попробуйте позже',
  update_failed: 'Не удалось сохранить, попробуйте позже',
  delete_failed: 'Не удалось удалить, попробуйте позже',
  submit_failed: 'Не удалось отправить на проверку, попробуйте позже',
  unpublish_failed: 'Не удалось снять с публикации, попробуйте позже',
  upload_failed: 'Не удалось загрузить файл, попробуйте позже',
  storage_error: 'Не удалось сохранить файл на сервере',
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const m = friendly[e.code] ?? e.message ?? 'Ошибка запроса'
    return m.charAt(0).toUpperCase() + m.slice(1)
  }
  if (e instanceof TypeError) return 'Нет связи с сервером'
  return 'Что-то пошло не так'
}

type Query = Record<string, string | number | boolean | undefined | null | (string | number)[]>

export function buildQuery(q?: Query): string {
  if (!q) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','))
    } else p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// Колбэк на 401 — AuthContext разлогинивает пользователя.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface Opts {
  method?: string
  query?: Query
  json?: unknown
  form?: FormData
  signal?: AbortSignal
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form // Content-Type с boundary ставит браузер
  }
  const res = await fetch(`${API_BASE_URL}${path}${buildQuery(opts.query)}`, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    signal: opts.signal,
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? `Ошибка ${res.status}`)
  }
  return data as T
}
