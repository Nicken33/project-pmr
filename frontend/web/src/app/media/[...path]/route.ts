import { apiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  const base = apiBaseUrl();
  if (!base) {
    return new Response("Not Found", { status: 404 });
  }

  const mediaPath = (path ?? []).join("/");
  if (!mediaPath) {
    return new Response("Not Found", { status: 404 });
  }

  const targetUrl = `${base.replace(/\/+$/, "")}/media/${mediaPath}`;

  try {
    const upstreamHeaders: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
      "User-Agent": "Talentro-Media-Proxy/1.0",
      accept: request.headers.get("accept") ?? "*/*",
    };
    const range = request.headers.get("range");
    if (range) {
      upstreamHeaders["range"] = range;
    }

    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    if (upstream.status === 304) {
      return new Response(null, { status: 304 });
    }

    if (!upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") || "text/plain",
        },
      });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("content-range", contentRange);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("etag", etag);
    const lastModified = upstream.headers.get("last-modified");
    if (lastModified) headers.set("last-modified", lastModified);

    headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error("Media proxy error:", err);
    return new Response("Internal Server Error", { status: 502 });
  }
}
