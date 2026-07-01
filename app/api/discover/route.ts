import { NextResponse } from "next/server";
import { networkInterfaces } from "os";

export interface DiscoveredCamera {
  ip: string;
  model: string;
  name: string;
}

// Get all local IPv4 subnets
function getLocalSubnets(): { base: string; bits: number }[] {
  const subnets: { base: string; bits: number }[] = [];
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        const parts = addr.address.split(".").map(Number);
        const maskParts = addr.netmask.split(".").map(Number);
        const baseParts = parts.map((p, i) => p & maskParts[i]);
        // Only scan /24 or smaller subnets (skip very large ones)
        const bits = maskParts.reduce((acc, m) => acc + m.toString(2).split("0").join("").length, 0);
        if (bits >= 24) {
          subnets.push({ base: baseParts.slice(0, 3).join("."), bits });
        }
      }
    }
  }
  return subnets;
}

// Probe a single IP for a Panasonic PTZ camera
async function probePanasonic(ip: string): Promise<DiscoveredCamera | null> {
  try {
    const res = await fetch(
      `http://${ip}/cgi-bin/aw_ptz?cmd=%23O&res=1`,
      { signal: AbortSignal.timeout(600) }
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();

    // Camera responds with p1 (on) or p0 (standby) — either means it's a Panasonic PTZ
    if (!text.startsWith("p")) return null;

    // Try to get model info from cam endpoint
    let model = "aw-ue70";
    let name = `Camera (${ip})`;
    try {
      const infoRes = await fetch(`http://${ip}/cgi-bin/aw_cam?cmd=QID&res=1`, { signal: AbortSignal.timeout(600) });
      const info = (await infoRes.text()).trim();
      // QID response: QID:AW-UE70 or similar
      const m = info.match(/QID:([^\s]+)/i);
      if (m) {
        const raw = m[1].toLowerCase();
        name = m[1];
        if (raw.includes("he130") || raw.includes("he-130")) model = "aw-he130";
        else if (raw.includes("ue160") || raw.includes("ue-160")) model = "aw-ue160";
        else model = "aw-ue70";
      }
    } catch {}

    return { ip, model, name };
  } catch {
    return null;
  }
}

export async function GET() {
  const subnets = getLocalSubnets();
  if (subnets.length === 0) {
    return NextResponse.json({ cameras: [], error: "No local network found" });
  }

  // Scan the first /24 subnet found (e.g. 192.168.1.1–254)
  const { base } = subnets[0];
  const probes: Promise<DiscoveredCamera | null>[] = [];
  for (let i = 1; i <= 254; i++) {
    probes.push(probePanasonic(`${base}.${i}`));
  }

  const results = await Promise.all(probes);
  const cameras = results.filter((r): r is DiscoveredCamera => r !== null);

  return NextResponse.json({ cameras, subnet: `${base}.0/24` });
}
