import { describe, expect, it } from "vitest";
import { resolveViewMode, type SessionState } from "@/lib/view-mode";

/**
 * Развилка §6: что посетитель видит из базы, а что — выставочный образец.
 *
 * здесь важен именно порядок: тестировщик должен получать демо, даже когда флаг
 * снят, а аноним — не получать его никогда, кроме локальной разработки.
 */

const anonymous: SessionState = { authenticated: false, tester: false };
const user: SessionState = { authenticated: true, tester: false, role: "user" };
const tester: SessionState = { authenticated: true, tester: true, role: "tester" };

describe("resolveViewMode", () => {
  it("аноним без флага видит только данные бэкенда", () => {
    expect(resolveViewMode(anonymous, undefined)).toBe("real");
    expect(resolveViewMode(null, undefined)).toBe("real");
    expect(resolveViewMode(anonymous, "0")).toBe("real");
  });

  it("обычный пользователь не получает демо-блоки", () => {
    expect(resolveViewMode(user, undefined)).toBe("real");
  });

  it("тестировщик видит всё, в том числе с невыставленным флагом", () => {
    expect(resolveViewMode(tester, undefined)).toBe("demo");
    expect(resolveViewMode(tester, "0")).toBe("demo");
  });

  it("флаг локальной разработки включает демо и без сессии", () => {
    expect(resolveViewMode(anonymous, "1")).toBe("demo");
    expect(resolveViewMode(null, "1")).toBe("demo");
  });

  it("любое значение флага, кроме «1», остаётся реальным режимом", () => {
    expect(resolveViewMode(anonymous, "true")).toBe("real");
    expect(resolveViewMode(anonymous, "")).toBe("real");
  });
});
