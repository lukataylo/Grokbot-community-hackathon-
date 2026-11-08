import { env } from "./env";

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!env.cfAccountId || !env.cfEmailToken) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${text}`);
    return false;
  }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.cfAccountId}/email/sending/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.cfEmailToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.mailFrom, to, subject, text, html: html ?? textToHtml(text) }),
  });
  if (!r.ok) { console.error("[email] failed", r.status, (await r.text()).slice(0, 300)); return false; }
  return true;
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!); }
export function textToHtml(text: string) {
  const body = esc(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#0A0A0A">$1</a>').split("\n\n").map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.45;color:#0A0A0A;max-width:520px;margin:0 auto;padding:24px">${body}<p style="margin:32px 0 0;color:#8A8A8A;font-size:13px">lumzel</p></div>`;
}
