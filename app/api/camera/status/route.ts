import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get("ip");
  const port = req.nextUrl.searchParams.get("port") ?? "80";
  if (!ip) return NextResponse.json({ error: "ip required" }, { status: 400 });

  async function queryPtz(cmd: string): Promise<string> {
    try {
      const url = `http://${ip}:${port}/cgi-bin/aw_ptz?cmd=${encodeURIComponent(cmd)}&res=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(400) });
      return (await res.text()).trim();
    } catch { return ""; }
  }

  async function queryCam(cmd: string): Promise<string> {
    try {
      const url = `http://${ip}:${port}/cgi-bin/aw_cam?cmd=${encodeURIComponent(cmd)}&res=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(400) });
      return (await res.text()).trim();
    } catch { return ""; }
  }

  try {
    const [irisRaw, zoomRaw, focusRaw, afRaw, gainRaw] =
      await Promise.all([
        queryPtz("#GI"),    // → giXXXX
        queryPtz("#GZ"),    // → gzXXXX
        queryPtz("#GF"),    // → gfXXXX
        queryCam("QSE:69"), // AF → QSE:69:0 or QSE:69:1
        queryCam("QGU"),    // gain → QGU:XX
      ]);

    return NextResponse.json({
      iris: parseIris(irisRaw),
      zoom: parsePosition(zoomRaw),
      focus: parsePosition(focusRaw),
      autoFocus: /1$/.test(afRaw),
      gain: parseGain(gainRaw),
      raw: { irisRaw, zoomRaw, focusRaw, afRaw, gainRaw },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ── Parsers ────────────────────────────────────────────────────────────────
// Flexible: match any prefix followed by 2–4 hex digits, case-insensitive

function parseIris(raw: string): string {
  const m = raw.match(/gi([0-9A-Fa-f]{3,4})/i);
  if (!m) return "—";
  const val = parseInt(m[1], 16);
  const v12 = m[1].length === 4 ? Math.round(val / 16) : val;
  return hexToFstop(v12);
}

function hexToFstop(val: number): string {
  if (val === 0) return "CLOSE";
  const table: [number, string][] = [
    [0x555, "F16"], [0x5AA, "F14"], [0x600, "F11"],
    [0x666, "F9.6"], [0x6AA, "F8"], [0x700, "F6.8"],
    [0x755, "F5.6"], [0x7AA, "F4.8"], [0x800, "F4"],
    [0x855, "F3.4"], [0x8AA, "F2.8"], [0x900, "F2.4"],
    [0x955, "F2"], [0x9AA, "F1.8"], [0xFFF, "OPEN"],
  ];
  let closest = table[0];
  for (const entry of table) {
    if (Math.abs(entry[0] - val) < Math.abs(closest[0] - val)) closest = entry;
  }
  return closest[1];
}


function parseGain(raw: string): string {
  // QGU → QGU:XX where XX is hex
  const m = raw.match(/QGU:([0-9A-Fa-f]{2})/i);
  if (!m) return "—";
  const val = parseInt(m[1], 16);
  if (val === 0x80) return "AUTO";
  return `${val - 0x08}dB`;
}

// AW-UE70 zoom/focus range: wide/near end = 0x555, tele/far end = 0xFFF
const POS_MIN = 0x555;
const POS_MAX = 0xFFF;

function parsePosition(raw: string): number {
  const m = raw.match(/[A-Za-z]{2,4}([0-9A-Fa-f]{3,4})$/);
  if (!m) return 0;
  const val = parseInt(m[1], 16);
  // Normalise 4-digit to 3-digit range
  const v = m[1].length === 4 ? Math.round(val / 16) : val;
  const clamped = Math.max(POS_MIN, Math.min(POS_MAX, v));
  return Math.round(((clamped - POS_MIN) / (POS_MAX - POS_MIN)) * 100);
}
