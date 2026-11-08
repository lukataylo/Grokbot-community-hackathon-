/** Accepts LinkedIn and X post links only, normalised so the same post can't be added twice. */
export function normalisePost(raw: string): { url: string; platform: "linkedin" | "x" } | null {
  const m = raw.match(/https?:\/\/[^\s]+/);
  let u: URL;
  try { u = new URL(m ? m[0] : raw.startsWith("http") ? raw : "https://" + raw); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "linkedin.com" || host.endsWith(".linkedin.com") || host === "lnkd.in") {
    if (!/\/(posts|feed\/update|pulse)\//.test(u.pathname) && host !== "lnkd.in") return null;
    return { url: `https://www.linkedin.com${u.pathname.replace(/\/$/, "")}`.replace("https://www.linkedin.comlnkd.in", "https://lnkd.in"), platform: "linkedin" };
  }
  if (["x.com", "twitter.com"].includes(host)) {
    const s = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    return s ? { url: `https://x.com/${s[1]}/status/${s[2]}`, platform: "x" } : null;
  }
  return null;
}

