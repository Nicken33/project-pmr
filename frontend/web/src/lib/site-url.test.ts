import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-url";

describe("siteOrigin", () => {
  it("берёт NEXT_PUBLIC_SITE_URL, когда он задан", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://talentro.md/" })).toBe("https://talentro.md");
  });

  it("дополняет схему, если адрес указан без неё", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "talentro.md" })).toBe("https://talentro.md");
  });

  it("без явного адреса берёт домен Vercel, а не выдуманный", () => {
    expect(siteOrigin({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "talentro.vercel.app" })).toBe(
      "https://talentro.vercel.app",
    );
    expect(siteOrigin({ NEXT_PUBLIC_VERCEL_URL: "talentro-git-main.vercel.app" })).toBe(
      "https://talentro-git-main.vercel.app",
    );
  });

  it("production-домен важнее адреса конкретного превью", () => {
    expect(
      siteOrigin({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "talentro.vercel.app",
        VERCEL_URL: "talentro-abc123.vercel.app",
      }),
    ).toBe("https://talentro.vercel.app");
  });

  it("на локальной сборке — localhost, а не несуществующий домен", () => {
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });
});
