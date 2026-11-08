#!/usr/bin/env node
// Domain research: checks whether candidate names are registrable, straight from the registry (RDAP).
//
//   node scripts/domain-research.mjs lumzel glint snapd            # check names as .com
//   node scripts/domain-research.mjs --tld com,app,co lumzel glint  # several TLDs
//   node scripts/domain-research.mjs --file names.txt               # one name per line
//   node scripts/domain-research.mjs --gen                          # built-in generator (short brandables)
//   add --available to print only registrable domains, --json for machine output
//
// RDAP 404 from the authoritative registry = not registered = can be hand-registered at normal price.
// 200 = taken. Anything else = unknown (rate limit / error), retried, then reported as "?".

import { readFileSync } from "node:fs";

const RDAP = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
  app: "https://pubapi.registry.google/rdap/domain/",
  dev: "https://pubapi.registry.google/rdap/domain/",
  io: "https://rdap.identitydigital.services/rdap/domain/",
  co: "https://rdap.registry.co/co/domain/",
  ai: "https://rdap.identitydigital.services/rdap/domain/",
};
const FALLBACK = "https://rdap.org/domain/";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const tlds = opt("--tld", "com").split(",");
const consumed = new Set(["--tld", opt("--tld"), "--file", opt("--file")]);
let names = args.filter((a) => !a.startsWith("--") && !consumed.has(a));
if (opt("--file")) names.push(...readFileSync(opt("--file"), "utf8").split(/\s+/));
if (flag("--gen")) names.push(...generate());
names = [...new Set(names.map((n) => n.trim().toLowerCase().replace(/\.[a-z.]+$/, "")).filter(Boolean))];

if (!names.length) {
  console.error("usage: domain-research.mjs [--tld com,app] [--file f] [--gen] [--available] [--json] name...");
  process.exit(1);
}

async function check(domain, tld, tries = 4) {
  const url = (RDAP[tld] ?? FALLBACK) + domain;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(10000) });
      if (r.status === 404) return "available";
      if (r.status === 200) return "taken";
    } catch {}
    await new Promise((s) => setTimeout(s, 500 * 2 ** i));
  }
  return "?";
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// Short, pronounceable, brandable: CV patterns plus light/glow/together roots fit for an event-photo product.
function generate() {
  const roots = ["lum", "glo", "lux", "snap", "pix", "fot", "nox", "vib", "kin", "mo", "zo", "rae", "lio", "aur", "nyx"];
  const ends = ["a", "o", "i", "io", "ly", "ra", "va", "zo", "ix", "en", "el", "ee", "ya", "ka"];
  const out = [];
  for (const r of roots) for (const e of ends) out.push(r + e);
  return out.filter((n) => n.length >= 4 && n.length <= 6);
}

const jobs = names.flatMap((n) => tlds.map((t) => ({ name: n, tld: t, domain: `${n}.${t}` })));
const results = await pool(jobs, 8, async (j) => ({ ...j, status: await check(j.domain, j.tld) }));
const shown = flag("--available") ? results.filter((r) => r.status === "available") : results;

if (flag("--json")) console.log(JSON.stringify(shown, null, 2));
else {
  const icon = { available: "✅", taken: "❌", "?": "⚠️ " };
  for (const r of shown.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)))
    console.log(`${icon[r.status]} ${r.domain.padEnd(18)} ${r.status}  (${r.name.length} letters)`);
  const a = results.filter((r) => r.status === "available").length;
  console.error(`\n${a}/${results.length} registrable · source: registry RDAP · ${new Date().toISOString()}`);
}
