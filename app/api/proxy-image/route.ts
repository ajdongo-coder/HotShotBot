import { NextRequest, NextResponse } from "next/server";

// Proxies images from local network cameras to avoid CORS issues in the browser.
// GET /api/proxy-image?url=http://192.168.x.x/cgi-bin/get_preset_thumbnail?preset_number=1
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("url param required", { status: 400 });

  if (!/^http:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|localhost)/.test(url)) {
    return new NextResponse("Only local network URLs allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return new NextResponse("Camera error", { status: 502 });
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: { "content-type": contentType, "cache-control": "no-cache" },
    });
  } catch {
    return new NextResponse("Unreachable", { status: 502 });
  }
}
