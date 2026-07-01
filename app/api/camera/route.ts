import { NextRequest, NextResponse } from "next/server";

// Proxy PTZ commands to the camera to avoid CORS issues.
// POST /api/camera  body: { ip: string, port: number, cmd: string }
export async function POST(req: NextRequest) {
  let body: { ip?: string; port?: number; cmd?: string; endpoint?: "aw_ptz" | "aw_cam" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ip, port = 80, cmd, endpoint = "aw_ptz" } = body;
  if (!ip || !cmd) {
    return NextResponse.json({ error: "ip and cmd are required" }, { status: 400 });
  }

  if (!/^[#A-Za-z0-9]/.test(cmd)) {
    return NextResponse.json({ error: "Invalid command format" }, { status: 400 });
  }

  const url = `http://${ip}:${port}/cgi-bin/${endpoint}?cmd=${encodeURIComponent(cmd)}&res=1`;

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    const text = await response.text();
    return NextResponse.json({ ok: true, response: text.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
