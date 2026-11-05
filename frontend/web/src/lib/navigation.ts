/**
 * Куда сайт разрешает отпустить посетителя.
 *
 * `?next=` в адресной строке набирает сам клиент, поэтому он недоверенный ввод:
 * `//example.com` браузер прочитает как чужой домен, `\` ведёт себя как `/` в
 * части движков, а `javascript:` в ссылке исполнит код. Проверка живёт рядом с
 * точкой, где значение уходит в навигацию, — так её не обойдёт новый вызов.
 */
export function safeInternalPath(value: string | undefined | null): string {
  if (typeof value !== "string" || value === "" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("://")) return "/";
  // Управляющие символы и переводы строк в URL — признак подделанного значения.
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}
