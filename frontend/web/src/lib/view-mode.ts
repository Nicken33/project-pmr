export type ViewMode = "real" | "demo";

/**
 * Ответ `GET /api/auth/me` в том виде, в котором он нужен рендеру.
 *
 * Анониму бэкенд отдаёт только `authenticated` и `tester` (`MeView` с
 * `omitempty`), поэтому остальные поля необязательные: требовать их значило бы
 * рисовать пустого имени пользователя там, где пользователя нет.
 */
export interface SessionState {
  authenticated: boolean;
  tester: boolean;
  role?: string;
  name?: string;
  email?: string;
  picture?: string;
  provider?: string;
}

/**
 * Единственная точка, где решается, что показывать посетителю (§6).
 *
 * `real` — только то, что отдал бэкенд. `demo` — моки, «Рекомендуем», счётчики
 * направлений и прочие выставочные блоки. Демо включается в двух случаях:
 * зашёл тестировщик (ему нужно посмотреть всё, в том числе то, что ещё не
 * наполнено данными) либо поднят флаг `NEXT_PUBLIC_DEMO_DATA` для локальной
 * разработки без бэкенда. Флаг обязан быть снят на проде: иначе собранная
 * витрина с моками уйдёт к реальным посетителям.
 */
export function resolveViewMode(
  session: SessionState | null,
  demoFlag: string | undefined = process.env.NEXT_PUBLIC_DEMO_DATA,
): ViewMode {
  if (session?.authenticated && session.tester) return "demo";
  return demoFlag === "1" ? "demo" : "real";
}
