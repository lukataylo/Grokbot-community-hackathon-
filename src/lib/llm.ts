import { env } from "./env";

type Msg = { role: "system" | "user" | "assistant"; content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> };

export async function chat(model: string, messages: Msg[], opts: { json?: boolean; maxTokens?: number; temperature?: number; timeoutMs?: number; reasoning?: "low" | "medium" | "off" } = {}): Promise<string> {
  if (!env.openrouterKey) throw new Error("OPENROUTER_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${env.openrouterKey}`, "Content-Type": "application/json", "HTTP-Referer": env.baseUrl, "X-Title": "Lumzel" },
      body: JSON.stringify({
        model, messages,
        max_tokens: opts.maxTokens ?? 900,
        reasoning: opts.reasoning === "off" ? { enabled: false } : { effort: opts.reasoning ?? "low" },
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return String(j.choices?.[0]?.message?.content ?? "");
  } finally { clearTimeout(timer); }
}

export function parseJson<T>(s: string): T | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

export const dataUrl = (jpeg: Buffer) => `data:image/jpeg;base64,${jpeg.toString("base64")}`;

const MAX_IMAGE_RESPONSE = 20 * 1024 * 1024;

/** Reads a response body, aborting as soon as it passes `max` bytes (a Content-Length can be missing or wrong). */
async function readCapped(res: Response, max: number): Promise<Buffer> {
  if (Number(res.headers.get("content-length") || 0) > max) throw new Error("response too large");
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) { await reader.cancel(); throw new Error("response too large"); }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/** Image-to-image via OpenRouter. Returns the first generated image, or null when the model answered without one. */
export async function editImage(model: string, prompt: string, image: string, timeoutMs = 150_000): Promise<Buffer | null> {
  if (!env.openrouterKey) throw new Error("OPENROUTER_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${env.openrouterKey}`, "Content-Type": "application/json", "HTTP-Referer": env.baseUrl, "X-Title": "Lumzel" },
      body: JSON.stringify({
        model, modalities: ["image", "text"],
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }],
      }),
    });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = JSON.parse((await readCapped(r, MAX_IMAGE_RESPONSE)).toString("utf8"));
    const url: string | undefined = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const m = url?.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/);
    if (m) return Buffer.from(m[1], "base64");
    // Some providers return a hosted URL instead: only fetch from known image hosts, and cap the size.
    if (url && /^https:\/\/([a-z0-9-]+\.)*(openrouter\.ai|googleusercontent\.com|googleapis\.com|openai\.com)\//.test(url)) {
      const f = await fetch(url, { signal: ctrl.signal, redirect: "error" }); // an allowlisted host must not bounce us elsewhere
      return f.ok ? await readCapped(f, MAX_IMAGE_RESPONSE) : null;
    }
    return null;
  } finally { clearTimeout(timer); }
}
