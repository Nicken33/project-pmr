/**
 * TanStack Query хуки для работы с API
 */
import { useQuery } from '@tanstack/react-query';
import { customFetch } from './client';
import type { Card, CatalogPage, Session, Activity } from './generated';
import { mapCardToActivity, mapActivityToActivityItem } from './mappers';
import type { ActivityItem } from '../types';

interface UseActivitiesParams {
  q?: string;
  city?: string;
  kind?: string;
  sort?: string;
  category?: string;
  age?: number | null;
  priceMax?: number | null;
  free?: string;
  online?: string;
  verified?: string;
  day?: string;
  time?: string;
  near?: string;
  radius?: number;
  page?: number;
  limit?: number;
}

interface UseActivitiesResult {
  items: ActivityItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Хук для получения списка активностей (каталог)
 */
export function useActivities(params: UseActivitiesParams = {}) {
  return useQuery<UseActivitiesResult>({
    queryKey: ['activities', params],
    queryFn: async () => {
      const response = await customFetch<CatalogPage>('/api/v1/catalog', {
        params: {
          q: params.q,
          city: params.city,
          kind: params.kind,
          sort: params.sort || 'updated',
          category: params.category,
          age: params.age,
          priceMax: params.priceMax,
          free: params.free,
          online: params.online,
          verified: params.verified,
          day: params.day,
          time: params.time,
          near: params.near,
          radius: params.radius,
          page: params.page || 1,
          limit: params.limit || 24,
        },
      });

      if (!response) {
        return { items: [], page: 1, limit: 24, total: 0, totalPages: 0 };
      }

      return {
        items: (response.items || []).map(mapCardToActivity),
        page: response.page || 1,
        limit: response.limit || 24,
        total: response.total || 0,
        totalPages: Math.ceil((response.total || 0) / (response.limit || 24)),
      };
    },
    staleTime: 30_000, // 30 секунд
    placeholderData: (previous) => previous, // сохранить старые данные при рефетче
  });
}

/**
 * Хук для получения детальной информации об активности
 */
export function useActivity(id: string | null) {
  return useQuery<ActivityItem | null>({
    queryKey: ['activity', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await customFetch<Activity>(`/api/v1/catalog/${id}`);
      return response ? mapActivityToActivityItem(response) : null;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

/**
 * Хук для получения сессии пользователя
 */
export function useSession() {
  return useQuery<Session | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const response = await customFetch<Session>('/api/v1/auth/me');
        return response;
      } catch (error) {
        // 401 = не авторизован, возвращаем null
        if (error instanceof Response && error.status === 401) {
          return null;
        }
        // Если это наша ApiError с 401
        if (typeof error === 'object' && error !== null && 'status' in error && (error as any).status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    retry: false,
  });
}

/**
 * Хук для получения категорий
 */
export function useCategories() {
  return useQuery<string[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await customFetch<{ categories: string[] }>('/api/v1/dict/categories');
      return response?.categories || [];
    },
    staleTime: 10 * 60 * 1000, // 10 минут
  });
}

/**
 * Хук для получения городов
 */
export function useCities() {
  return useQuery<string[]>({
    queryKey: ['cities'],
    queryFn: async () => {
      const response = await customFetch<{ cities: string[] }>('/api/v1/dict/cities');
      return response?.cities || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// Re-export types
export type { UseActivitiesParams, UseActivitiesResult };