/**
 * Куда сайт разрешает отпустить посетителя.
 *
 * `?next=` в адресной строке набирает сам клиент, поэтому он недоверенный ввод:
 * `//example.com` браузер прочитает как чужой домен, `\` ведёт себя как `/` в
 * части движков, а `javascript:` в ссылке исполнит код. Проверка живёт рядом с
 * точкой, где значение уходит в навигацию, — так её не обойдёт новый вызов.
 */
/** Значение параметра из `useSearchParams`/`searchParams`: Next отдаёт и строку, и массив. */
export type SearchParam = string | string[] | undefined | null;

export function safeInternalPath(value: SearchParam): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw === "" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.includes("://")) return "/";
  // Управляющие символы и переводы строк в URL — признак подделанного значения.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
