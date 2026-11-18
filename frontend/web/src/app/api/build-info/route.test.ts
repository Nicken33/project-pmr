// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
afterEach(()=>vi.unstubAllEnvs());
it("identifies the deployed source revision without exposing configuration",async()=>{
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA","1".repeat(40));
  const response=GET();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({application:"talentro-web",root_directory:"web",revision:"1".repeat(40),ui_contract:"2026-11-17.review-media-google-v2",features:["persistent-review-media","google-role-stage","session-verification"]});
});
it("works for local builds that have no Vercel commit metadata",async()=>{
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA","");
  expect(await GET().json()).toMatchObject({revision:null});
});
