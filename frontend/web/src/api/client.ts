/**
 * Кастомный fetch-клиент для TanStack Query + сгенерированного API
 * - Автоматически добавляет credentials: 'include' для кук
 * - Единая обработка ошибок
 * - Базовый URL из env
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(endpoint: string, params?: RequestOptions['params']): string {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function customFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers, ...fetchOptions } = options;

  const response = await fetch(buildUrl(endpoint, params), {
    ...fetchOptions,
    credentials: 'include', // ОБЯЗАТЕЛЬНО для кук сессии
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

  // 204 No Content — пустой ответ
  if (response.status === 204) {
    return undefined as T;
  }

  // 304 Not Modified — кэш, но fetch не возвращает тело
  if (response.status === 304) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // Нормализуем ошибку к единому формату
    const error: ApiError = {
      status: response.status,
      message: isJson ? data?.error?.message || data?.message || response.statusText : data,
      fields: isJson ? data?.error?.fields : undefined,
    };
    throw error;
  }

  return data as T;
}

export interface ApiError {
  status: number;
  message: string;
  fields?: Record<string, string>;
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

// Хелперы для типичных запросов
export const api = {
  get: <T>(endpoint: string, params?: RequestOptions['params']) =>
    customFetch<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body: unknown, params?: RequestOptions['params']) =>
    customFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      params,
    }),

  patch: <T>(endpoint: string, body: unknown) =>
    customFetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string) =>
    customFetch<T>(endpoint, { method: 'DELETE' }),
};