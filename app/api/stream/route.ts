import { NextRequest } from "next/server";

// Proxy the MJPEG stream from the camera through Next.js to avoid CORS / canvas taint.
// GET /api/stream?url=http://192.168.x.x/cgi-bin/mjpeg?...
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("url param required", { status: 400 });

  // Only allow http:// to local network addresses — basic SSRF guard
  if (!/^http:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|localhost)/.test(url)) {
    return new Response("Only local network URLs allowed", { status: 403 });
  }

  const upstream = await fetch(url, {
    headers: { connection: "keep-alive" },
    // @ts-expect-error — Node fetch supports duplex streaming
    duplex: "half",
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Camera unreachable", { status: 502 });
  }

  // Pass through content-type (multipart/x-mixed-replace for MJPEG)
  const contentType = upstream.headers.get("content-type") ?? "multipart/x-mixed-replace";

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
}
