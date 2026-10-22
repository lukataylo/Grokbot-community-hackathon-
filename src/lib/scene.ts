import type { Attendee } from "./types";

const BACKDROPS: Record<string, [string, string]> = {
  stage: ["#1e2a5a", "#2d3f7c"],
  desk: ["#3b2a20", "#6b4a33"],
  crowd: ["#2a2338", "#7a4b3a"],
  board: ["#dfe8f1", "#b9c9d9"],
};

/** Stylised "event photo": warm venue lights, and each person drawn in the outfit colour they declared at join. */
export function renderScene(id: string, bg: string, people: Pick<Attendee, "color" | "consentPhoto">[]) {
  const [c1, c2] = BACKDROPS[bg] ?? BACKDROPS.crowd;
  const W = 800;
  const H = 600;
  const gap = W / (people.length + 1);
  const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const rnd = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280;
  const light = bg !== "board";
  // Out-of-focus string lights, like the warm bokeh in a real venue shot.
  const bokeh = light
    ? Array.from({ length: 18 }, (_, i) => `<circle cx="${rnd(i) * W}" cy="${40 + rnd(i + 50) * 260}" r="${10 + rnd(i + 99) * 28}" fill="${["#ffd27a", "#ffb35c", "#fff1c1", "#9fd8ff"][i % 4]}" opacity="${0.18 + rnd(i + 7) * 0.35}" filter="url(#soft)"/>`).join("")
    : "";
  const props =
    bg === "stage"
      ? `<rect x="470" y="70" width="280" height="170" rx="10" fill="#0c1f4d" stroke="#45b8fb" stroke-width="3"/><text x="500" y="140" font-family="Helvetica,Arial" font-weight="700" font-size="34" fill="#dff1fe">Build</text><text x="500" y="182" font-family="Helvetica,Arial" font-weight="700" font-size="34" fill="#dff1fe">with Grok</text>`
      : bg === "board"
        ? `<rect x="60" y="50" width="680" height="260" rx="12" fill="#ffffff" stroke="#9fb3c8" stroke-width="4"/><path d="M110 130h120M110 170h200M110 210h150M380 120c60-40 120 40 180 0M380 200h90l40 40" stroke="#1d9ef0" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="560" y="170" width="120" height="70" rx="10" fill="none" stroke="#f97316" stroke-width="5"/>`
        : `<path d="M0 260 Q200 220 400 250 T800 240 V320 H0Z" fill="#000" opacity=".18"/><path d="M40 300c10-60 40-80 60-120 20 40 50 60 60 120Z" fill="#14532d" opacity=".55"/><path d="M700 300c10-70 40-90 60-130 20 40 40 70 50 130Z" fill="#14532d" opacity=".55"/>`;
  const figures = people
    .map((p, i) => {
      const x = gap * (i + 1);
      const scale = 0.9 + ((seed + i * 37) % 30) / 100;
      const y = 330 + ((seed + i * 53) % 40);
      const skin = ["#f1c27d", "#c68642", "#8d5524", "#e0ac69", "#ffdbac"][(seed + i) % 5];
      const hair = ["#2b1d14", "#4a3020", "#111111", "#7a4a1f"][(seed + i) % 4];
      return `<g transform="translate(${x} ${y}) scale(${scale})"${p.consentPhoto ? "" : ' filter="url(#redact)"'}>
        <ellipse cx="0" cy="250" rx="80" ry="14" fill="#000" opacity=".25"/>
        <path d="M-75 250 Q-80 90 0 80 Q80 90 75 250 Z" fill="${p.color}"/>
        <rect x="-14" y="50" width="28" height="36" fill="${skin}"/>
        <circle cx="0" cy="10" r="48" fill="${skin}"/>
        <path d="M-50 0 Q-45 -50 0 -42 Q45 -50 50 0 Q30 -25 0 -22 Q-30 -25 -50 0Z" fill="${hair}"/>
        <circle cx="-16" cy="12" r="5" fill="#1f2937"/><circle cx="16" cy="12" r="5" fill="#1f2937"/>
        <path d="M-16 30 Q0 42 16 30" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>`;
    })
    .join("");
  const laptops =
    bg === "desk"
      ? `<rect x="0" y="520" width="${W}" height="80" fill="#2a1d14"/>` +
        people.slice(0, 3).map((_, i) => `<g transform="translate(${gap * (i + 1) - 70} 470)"><rect width="140" height="60" rx="6" fill="#c9ced6"/><circle cx="70" cy="30" r="9" fill="#e5e7eb"/><rect x="-10" y="58" width="160" height="10" rx="4" fill="#9aa3af"/></g>`).join("")
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <filter id="redact" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <radialGradient id="l" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#ffcf8a" stop-opacity="${light ? 0.22 : 0}"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>${bokeh}${props}
    ${figures}${laptops}
    <rect width="${W}" height="${H}" fill="url(#l)"/>
  </svg>`;
}

/** Parse a `/scene/<id>?bg=..&who=a,b` URL into its parts. */
export function parseSceneUrl(url: string) {
  const u = new URL(url, "http://x");
  return { id: u.pathname.split("/").pop() ?? "", bg: u.searchParams.get("bg") ?? "crowd", who: (u.searchParams.get("who") ?? "").split(",").filter(Boolean) };
}
