import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/navigation";

/**
 * `?next=` набирает в адресной строке сам посетитель, поэтому в навигацию должно
 * уходить только внутреннее направление. Здесь — все формы, которыми open redirect
 * обходит проверку «начинается с /».
 */

describe("safeInternalPath", () => {
  it("внутренние пути проходят", () => {
    expect(safeInternalPath("/favorites")).toBe("/favorites");
    expect(safeInternalPath("/activities/kruzhok?tab=reviews")).toBe(
      "/activities/kruzhok?tab=reviews",
    );
    expect(safeInternalPath("/moderation")).toBe("/moderation");
  });

  it("чужие домены и схемы возвращают на главную", () => {
    for (const value of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "http://evil.example",
      "javascript:alert(1)",
      "/\\evil.example/x",
      " /favorites",
    ]) {
      expect(safeInternalPath(value)).toBe("/");
    }
  });

  it("пустое, массив и управляющие символы — тоже главная", () => {
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
    expect(safeInternalPath(["/favorites", "//evil.example"])).toBe("/favorites");
    expect(safeInternalPath("/a\nHost: evil.example")).toBe("/");
    expect(safeInternalPath("/favorites\u0000")).toBe("/");
  });
});
