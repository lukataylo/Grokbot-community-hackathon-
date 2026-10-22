import type { Brand, EventKit, VisualFormat } from "./types";
import { dayLabel, timeLabel } from "./kit";

/** On-brand event visuals from code templates, not image models: same layout rules every week. */

export const FORMATS: Record<VisualFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  banner: { w: 1600, h: 900 },
  "newsletter-header": { w: 1200, h: 400 },
};

const FONTS: Record<Brand["font"], string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap that shrinks the font until the text fits in maxLines, so nothing overflows. */
export function fitText(text: string, maxWidth: number, maxLines: number, startSize: number, minSize = 18, charW = 0.56) {
  minSize = Math.min(minSize, startSize);
  for (let size = startSize; size >= minSize; size -= 2) {
    const perLine = Math.floor(maxWidth / (size * charW));
    const lines: string[] = [];
    let cur = "";
    let ok = true;
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (word.length > perLine) {
        ok = false;
        break;
      }
      const next = cur ? `${cur} ${word}` : word;
      if (next.length <= perLine) cur = next;
      else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    if (ok && lines.length <= maxLines) return { size, lines };
  }
  // Last resort: hard-truncate at the minimum size.
  const perLine = Math.floor(maxWidth / (minSize * charW));
  const words = text.slice(0, perLine * maxLines - 1);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine));
  lines[lines.length - 1] += "…";
  return { size: minSize, lines };
}

function textBlock(lines: string[], x: number, y: number, size: number, fill: string, weight: number, font: string, lh = 1.12, anchor = "start") {
  return lines.map((l, i) => `<text x="${x}" y="${y + i * size * lh}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(l)}</text>`).join("");
}

export function renderVisual(kit: Pick<EventKit, "facts" | "brand" | "items">, format: VisualFormat) {
  const { w, h } = FORMATS[format];
  const b = kit.brand;
  const f = kit.facts;
  const font = FONTS[b.font];
  const headline = kit.items[`visual:${format}`].data.headline || kit.items.page.data.title;
  const tagline = kit.items.page.data.tagline;
  const pad = Math.round(Math.min(w, h) * (format === "newsletter-header" ? 0.09 : 0.08));
  const when = `${dayLabel(f.startsAt)} · ${timeLabel(f.startsAt)}`;
  const tall = format === "story";
  const wide = format === "banner" || format === "newsletter-header";
  const textW = (wide ? w * 0.62 : w) - pad * 2;

  const head = fitText(headline, textW, format === "newsletter-header" ? 2 : tall ? 5 : 3, Math.round((tall ? 0.11 : wide ? 0.1 : 0.095) * (wide ? h : w)));
  const tag = fitText(tagline, textW, 2, Math.round(head.size * 0.36), 16);
  const meta = fitText(`${when}`, textW, 1, Math.round(head.size * 0.3), 14);
  const venue = fitText(f.venue, textW, 1, Math.round(head.size * 0.3), 14);
  const logoSize = Math.round(Math.min(w, h) * 0.035);
  const headY = tall ? h * 0.38 : format === "newsletter-header" ? pad + logoSize * 1.2 + head.size * 1.15 : h * 0.34;
  const tagY = headY + head.lines.length * head.size * 1.12 + tag.size * 0.6;
  const metaY = format === "newsletter-header" ? h - pad : tall ? h - pad * 3.2 : h - pad - meta.size * 1.6;
  const showTag = format !== "newsletter-header";

  // Decorative shapes: brand blobs on the right and a dotted grid, seeded so each event looks a bit different.
  const seed = [...f.name].reduce((s, c) => s + c.charCodeAt(0), 0);
  const cx = wide ? w * 0.82 : w * (0.75 + (seed % 10) / 100);
  const cy = wide ? h * 0.5 : tall ? h * 0.18 : h * 0.2;
  const r = Math.min(w, h) * (wide ? 0.42 : 0.32);
  const dots = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => `<circle cx="${pad + i * 22}" cy="${h - pad - (tall ? pad * 3.6 : meta.size * 4) - j * 22}" r="3" fill="${b.accent}" opacity=".35"/>`).join(""),
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.background}"/><stop offset="1" stop-color="${b.background}" stop-opacity=".92"/></linearGradient>
<radialGradient id="blob" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${b.primary}"/><stop offset="1" stop-color="${b.accent}" stop-opacity=".0"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="${b.background}"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#blob)" opacity=".9"/>
<circle cx="${cx - r * 0.55}" cy="${cy + r * 0.6}" r="${r * 0.45}" fill="${b.accent}" opacity=".35"/>
<rect x="${cx - r * 0.2}" y="${cy - r * 0.9}" width="${r * 0.5}" height="${r * 0.5}" rx="${r * 0.08}" fill="none" stroke="${b.primary}" stroke-width="${Math.max(3, r * 0.02)}" transform="rotate(${seed % 30} ${cx} ${cy})"/>
${format === "newsletter-header" ? "" : dots}
<rect x="${pad}" y="${pad}" width="${logoSize * 1.2}" height="${logoSize * 1.2}" rx="${logoSize * 0.3}" fill="${b.primary}"/>
<text x="${pad + logoSize * 1.6}" y="${pad + logoSize * 0.95}" font-family="${font}" font-size="${logoSize}" font-weight="700" fill="#ffffff" letter-spacing="1">${esc(b.community.toUpperCase())}</text>
${textBlock(head.lines, pad, headY, head.size, "#ffffff", 800, font, 1.08)}
${showTag ? textBlock(tag.lines, pad, tagY, tag.size, "#d4d4d8", 400, font, 1.25) : ""}
${textBlock(meta.lines, pad, metaY, meta.size, b.primary, 700, font)}
${format === "newsletter-header" ? "" : textBlock(venue.lines, pad, metaY + meta.size * 1.5, venue.size, "#e4e4e7", 500, font)}
${tall ? `<rect x="${pad}" y="${h - pad * 1.6}" width="${w - pad * 2}" height="${pad * 0.9}" rx="${pad * 0.45}" fill="${b.primary}"/><text x="${w / 2}" y="${h - pad * 1.6 + pad * 0.58}" text-anchor="middle" font-family="${font}" font-size="${pad * 0.4}" font-weight="800" fill="#fff">RSVP ${esc(f.hashtag)}</text>` : format === "newsletter-header" ? "" : `<text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="${font}" font-size="${meta.size * 0.8}" font-weight="700" fill="${b.accent}">${esc(f.hashtag)}</text>`}
</svg>`;
}

export const visualDataUrl = (kit: Pick<EventKit, "facts" | "brand" | "items">, format: VisualFormat) => `data:image/svg+xml;utf8,${encodeURIComponent(renderVisual(kit, format))}`;
