import type { Activity, FilterState } from "@/lib/types";

/** Три карточки «рядом по теме» при пустом результате (§3.1.8). */
export const NEARBY_SIZE = 3;

/**
 * Подбор соседей из готового пула — ни одного занятия не додумываем.
 *
 * `scope` задаёт демо-режим: приоритет тому же направлению, что и снятый
 * фильтр, порядок по голосам, а если ровесников по направлению нет — весь пул.
 * Без `scope` (канон) пул уже собран без фильтров, поэтому идёт как есть.
 * Ровно лимит: релевантных меньше трёх — показываем меньше.
 */
export function selectNearby(
  pool: Activity[],
  options: { limit?: number; scope?: FilterState } = {},
): Activity[] {
  const { limit = NEARBY_SIZE, scope } = options;
  if (!scope) return pool.slice(0, limit);

  const sameDirection = pool.filter(
    (activity) =>
      (Boolean(scope.category) && activity.categorySlug === scope.category) ||
      (Boolean(scope.superCategory) && activity.superSlug === scope.superCategory),
  );
  const candidates = sameDirection.length ? sameDirection : pool;
  return [...candidates].sort((a, b) => b.votesPlus - a.votesPlus).slice(0, limit);
}
