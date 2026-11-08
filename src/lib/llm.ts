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
