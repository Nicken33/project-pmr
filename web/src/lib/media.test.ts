import { describe, expect, it } from "vitest";
import { mediaProxyTarget } from "@/lib/media";

describe("mediaProxyTarget", () => {
  it("адрес бэкенда не задан — ничего не проксируем", () => {
    expect(mediaProxyTarget(undefined)).toBeNull();
    expect(mediaProxyTarget("")).toBeNull();
    expect(mediaProxyTarget("   ")).toBeNull();
  });

  it("собирает destination из адреса бэкенда", () => {
    expect(mediaProxyTarget("http://26.52.103.163:8080")).toBe(
      "http://26.52.103.163:8080/media/:path*",
    );
    expect(mediaProxyTarget("http://26.52.103.163:8080/")).toBe(
      "http://26.52.103.163:8080/media/:path*",
    );
  });

  it("не-URL не становится destination", () => {
    expect(mediaProxyTarget("26.52.103.163:8080")).toBeNull();
  });
});
