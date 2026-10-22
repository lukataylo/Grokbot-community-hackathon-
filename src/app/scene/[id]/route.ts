import { readDB } from "@/lib/store";

const BACKDROPS: Record<string, [string, string, string]> = {
  stage: ["#0f172a", "#312e81", "GROK BOT LONDON"],
  desk: ["#1c1917", "#44403c", ""],
  crowd: ["#111827", "#7c2d12", "#GrokBotLondon"],
  board: ["#e5e7eb", "#cbd5e1", "agents → photos → reach"],
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const [c1, c2, label] = BACKDROPS[url.searchParams.get("bg") ?? "crowd"] ?? BACKDROPS.crowd;
  const who = (url.searchParams.get("who") ?? "").split(",").filter(Boolean);
  const db = readDB();
  const people = who.map((w) => db.attendees.find((a) => a.id === w)).filter(Boolean);
  const W = 800;
  const H = 600;
  const gap = W / (people.length + 1);
  const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const figures = people
    .map((p, i) => {
      const x = gap * (i + 1);
      const scale = 0.9 + ((seed + i * 37) % 30) / 100;
      const y = 330 + ((seed + i * 53) % 40);
      const skin = ["#f1c27d", "#c68642", "#8d5524", "#e0ac69", "#ffdbac"][(seed + i) % 5];
      return `<g transform="translate(${x} ${y}) scale(${scale})"${p!.consentPhoto ? "" : ' filter="url(#redact)"'}>
        <ellipse cx="0" cy="250" rx="80" ry="14" fill="#000" opacity=".25"/>
        <path d="M-75 250 Q-80 90 0 80 Q80 90 75 250 Z" fill="${p!.color}"/>
        <rect x="-14" y="50" width="28" height="36" fill="${skin}"/>
        <circle cx="0" cy="10" r="48" fill="${skin}"/>
        <path d="M-50 0 Q-45 -50 0 -42 Q45 -50 50 0 Q30 -25 0 -22 Q-30 -25 -50 0Z" fill="#2b1d14"/>
        <circle cx="-16" cy="12" r="5" fill="#1f2937"/><circle cx="16" cy="12" r="5" fill="#1f2937"/>
        <path d="M-16 30 Q0 42 16 30" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="redact" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter><radialGradient id="l" cx=".5" cy=".1" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#l)"/>
    ${label ? `<text x="${W / 2}" y="110" text-anchor="middle" font-family="Helvetica,Arial" font-weight="800" font-size="54" fill="${c1 === "#e5e7eb" ? "#334155" : "#ffffff"}" opacity=".85">${label}</text>` : ""}
    ${figures}
  </svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}
