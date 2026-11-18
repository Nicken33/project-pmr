/** Public deployment marker: source revision only, never configuration secrets. */
export const dynamic = "force-dynamic";

export function GET() {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  return Response.json({
    application: "talentro-web",
    root_directory: "web",
    revision: revision && /^[a-f0-9]{40}$/i.test(revision) ? revision : null,
    ui_contract: "2026-11-17.review-media-google-v2",
    features: ["persistent-review-media", "google-role-stage", "session-verification"],
  }, {headers: {"cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff"}});
}
