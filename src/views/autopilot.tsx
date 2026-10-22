"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, STATIC, useAppData } from "@/lib/client";
import { DEFAULT_BRAND, KIT_KEYS, KIT_LABEL, dayLabel, timeLabel } from "@/lib/kit";
import { FORMATS, renderVisual } from "@/lib/visual";
import { Loading, Nav } from "@/components/nav";
import { ActionButton } from "@/components/actions";
import { HoursSaved } from "@/components/hours";
import { Badge, GrokMark } from "@/components/ui";
import type { Brand, EventKit, KitKey, KitStatus, VisualFormat } from "@/lib/types";

const EXAMPLE = {
  idea: "AI agents breakfast for 40 founders next Wednesday at Second Home Spitalfields with pastries",
  dump: `Pastries and coffee from Gail's £180 receipt
Room hire from Second Home £250 quote
Volunteers: Aisha, Chloe, Ben
Speakers: Sofia Rossi, Kenji Tanaka
Doors on Hanbury Street, not the main entrance.`,
};

const STATUS_TONE: Record<KitStatus, "amber" | "green" | "sky"> = { draft: "amber", approved: "green", sent: "sky" };

const shareUrl: Partial<Record<KitKey, (t: string) => string>> = {
  "post:x": (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}`,
  "post:linkedin": (t) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}`,
  "post:whatsapp": (t) => `https://wa.me/?text=${encodeURIComponent(t)}`,
};

function download(name: string, content: Blob | string, type = "text/plain") {
  const url = URL.createObjectURL(typeof content === "string" ? new Blob([content], { type }) : content);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPng(svg: string, format: VisualFormat, name: string) {
  const { w, h } = FORMATS[format];
  const img = new Image();
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) download(`${name}-${format}.png`, blob);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function AutopilotView({ eventId }: { eventId: string }) {
  const state = useAppData(0);
  if (!state) return <><Nav eventId={eventId} active="autopilot" state={state} /><Loading /></>;
  const { db } = state;
  const kit = db.kits?.[eventId];
  const plan = db.plans[eventId];
  const counts = kit ? KIT_KEYS.reduce((c, k) => ({ ...c, [kit.items[k].status]: (c[kit.items[k].status] ?? 0) + 1 }), {} as Record<KitStatus, number>) : ({} as Record<KitStatus, number>);
  const integ = state.integrations;
  return (
    <>
      <Nav eventId={eventId} active="autopilot" state={state} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-fuchsia-300">Event Autopilot</p>
            <h1 className="text-3xl font-bold">One idea in. Run sheet, visuals, posts and newsletter out.</h1>
            <p className="mt-1 text-zinc-400">Grokbot drafts everything. Nothing goes out until you approve it.</p>
          </div>
          <Link href="/organiser/digest" className="btn-ghost">Weekly digest →</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <GenerateForm eventId={eventId} kit={kit} />
          <HoursSaved db={db} eventId={eventId} big />
        </div>

        {kit && (
          <>
            <div className="sticky top-[57px] z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{kit.facts.name}</p>
                <p className="truncate text-xs text-zinc-400">
                  {dayLabel(kit.facts.startsAt)} · {timeLabel(kit.facts.startsAt)}–{timeLabel(kit.facts.endsAt)} · {kit.facts.venue} · copy by {kit.source === "grok" ? "Grok" : "templates (mock)"}
                  {kit.luma && (kit.luma.ok ? " · facts from Luma" : " · Luma unreachable, used your idea")}
                </p>
              </div>
              <div className="flex gap-1">
                {(["draft", "approved", "sent"] as KitStatus[]).map((s) => (
                  <Badge key={s} tone={STATUS_TONE[s]}>{counts[s] ?? 0} {s}</Badge>
                ))}
              </div>
              <ActionButton run={() => api.publishKit(eventId, false)} label="Publish approved" className="btn-ghost" busyLabel="Publishing…" />
              <ActionButton run={() => api.publishKit(eventId, true)} label={<><GrokMark className="h-4 w-4" /> Approve all & publish</>} busyLabel="Publishing…" />
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={integ?.ghost ? "green" : "zinc"}>Ghost {integ?.ghost ? "connected" : "· HTML export"}</Badge>
              <Badge tone={integ?.discord ? "green" : "zinc"}>Discord {integ?.discord ? "webhook" : "· copy"}</Badge>
              <Badge tone="zinc">LinkedIn · X · WhatsApp share links</Badge>
              <Badge tone={plan ? (plan.approved ? "green" : "amber") : "zinc"}>
                Share plan: {plan ? (plan.approved ? "approved" : "awaiting approval") : "not generated"}
              </Badge>
              <NotionButton eventId={eventId} connected={!!integ?.notion} />
            </div>

            <Section title="The event" sub="Run sheet, budget and rota from your idea and notes. Timings are computed in code, not guessed.">
              <KitCard kit={kit} k="page" eventId={eventId} />
              <KitCard kit={kit} k="runSheet" eventId={eventId} />
              <div className="grid gap-4 lg:grid-cols-2">
                <KitCard kit={kit} k="budget" eventId={eventId} />
                <KitCard kit={kit} k="rota" eventId={eventId} />
              </div>
            </Section>

            <Section title="Promo" sub="Posts for every channel and a Ghost-ready newsletter.">
              <div className="grid gap-4 lg:grid-cols-2">
                {(["post:linkedin", "post:x", "post:whatsapp", "post:discord"] as KitKey[]).map((k) => (
                  <KitCard key={k} kit={kit} k={k} eventId={eventId} />
                ))}
              </div>
              <KitCard kit={kit} k="newsletter" eventId={eventId} />
            </Section>

            <Section title="Visuals" sub="Rendered from a code template with your brand, so every week looks the same and text never overflows.">
              <BrandForm eventId={eventId} brand={kit.brand} />
              <div className="grid gap-4 md:grid-cols-2">
                {(["visual:square", "visual:story", "visual:banner", "visual:newsletter-header"] as KitKey[]).map((k) => (
                  <KitCard key={k} kit={kit} k={k} eventId={eventId} />
                ))}
              </div>
            </Section>
          </>
        )}
      </main>
    </>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-zinc-400">{sub}</p>
      </div>
      {children}
    </section>
  );
}

function GenerateForm({ eventId, kit }: { eventId: string; kit?: EventKit }) {
  const [f, setF] = useState({ idea: kit?.idea ?? "", luma: "", dump: kit?.dump ?? "" });
  const [msg, setMsg] = useState("");
  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="block text-sm font-medium">
        One-line idea
        <input className="input mt-1" value={f.idea} onChange={(e) => setF({ ...f, idea: e.target.value })} placeholder="AI agents breakfast for 40 founders next Wednesday at Second Home with pastries" />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="block text-sm font-medium">
          Luma event (optional)
          <input className="input mt-1" value={f.luma} onChange={(e) => setF({ ...f, luma: e.target.value })} placeholder="evt-… or lu.ma/your-event" />
          <span className="mt-1 block text-xs font-normal text-zinc-500">Pulls the real name, time, venue, hosts and description.</span>
        </label>
        <label className="block text-sm font-medium">
          Dump your notes, quotes and receipts
          <textarea className="input mt-1 h-24 font-mono text-xs" value={f.dump} onChange={(e) => setF({ ...f, dump: e.target.value })} placeholder={"Pizza from Franco Manca £420 receipt\nVolunteers: Lena, Kenji\nSpeakers: Raj Mehta"} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          run={async () => {
            setMsg("");
            const r = await api.generateKit({ eventId, ...f, brand: kit?.brand ?? DEFAULT_BRAND });
            setMsg(r.error ?? `Drafted ${KIT_KEYS.length} pieces with ${r.source === "grok" ? "Grok" : "templates"}. Review and approve below.`);
          }}
          label={<><GrokMark className="h-4 w-4" /> {kit ? "Regenerate everything" : "Generate the kit"}</>}
          busyLabel="Grokbot is drafting…"
        />
        <button type="button" className="btn-ghost" onClick={() => setF({ ...EXAMPLE, luma: "" })}>
          Try an example
        </button>
        {msg && <span className="text-sm text-zinc-400">{msg}</span>}
      </div>
    </form>
  );
}

function BrandForm({ eventId, brand }: { eventId: string; brand: Brand }) {
  const saved = JSON.stringify(brand);
  const [b, setB] = useState(brand);
  useEffect(() => setB(JSON.parse(saved)), [saved]);
  const color = (k: "primary" | "accent" | "background", label: string) => (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <input type="color" value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent" />
      {label}
    </label>
  );
  return (
    <div className="card flex flex-wrap items-center gap-4 p-3">
      <span className="text-sm font-semibold">Brand</span>
      <input className="input w-52" value={b.community} onChange={(e) => setB({ ...b, community: e.target.value })} placeholder="Community name" />
      {color("primary", "Primary")}
      {color("accent", "Accent")}
      {color("background", "Background")}
      <select className="input w-28" value={b.font} onChange={(e) => setB({ ...b, font: e.target.value as Brand["font"] })}>
        <option value="sans">Sans</option>
        <option value="serif">Serif</option>
        <option value="mono">Mono</option>
      </select>
      <ActionButton run={() => api.setBrand(eventId, b)} label="Apply brand" className="btn-primary" busyLabel="Saving" />
    </div>
  );
}

function NotionButton({ eventId, connected }: { eventId: string; connected: boolean }) {
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <ActionButton
        className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-zinc-200 hover:bg-white/20"
        run={async () => {
          const r = await api.exportNotion(eventId);
          if (r.ok && r.url) {
            window.open(r.url, "_blank");
            setMsg("Exported to Notion");
          } else if (r.markdown) {
            await navigator.clipboard?.writeText(r.markdown).catch(() => {});
            download("event-workspace.md", r.markdown, "text/markdown");
            setMsg(r.error ? `${r.error}. Downloaded Markdown instead` : "Copied as Markdown, ready to paste into Notion");
          } else setMsg(r.error ?? "Nothing to export");
        }}
        label={connected ? "Export to Notion" : "Notion · copy as Markdown"}
        busyLabel="Exporting"
      />
      {msg && <span className="text-zinc-400">{msg}</span>}
    </span>
  );
}

function KitCard({ kit, k, eventId }: { kit: EventKit; k: KitKey; eventId: string }) {
  const item = kit.items[k];
  const [draft, setDraft] = useState<unknown>(item.data);
  const [copied, setCopied] = useState(false);
  const saved = JSON.stringify(item.data);
  // Reset the local draft only when the stored item really changes, not on every refresh.
  useEffect(() => setDraft(JSON.parse(saved)), [saved]);
  const dirty = JSON.stringify(draft) !== saved;
  const text = (draft as { text?: string }).text;
  const share = shareUrl[k];
  return (
    <div className={`card space-y-3 p-4 ${item.status === "approved" ? "ring-1 ring-emerald-400/40" : item.status === "sent" ? "opacity-90 ring-1 ring-sky-400/30" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{KIT_LABEL[k]}</h3>
        <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
        {item.edited && <Badge tone="zinc">edited</Badge>}
        {item.sentVia && <span className="text-xs text-zinc-500">→ {item.sentVia}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {dirty && <ActionButton run={() => api.kitItem(eventId, k, "edit", draft)} label="Save edit" className="btn-primary px-3 py-1 text-xs" busyLabel="Saving" />}
          {item.status !== "sent" && <ActionButton run={() => api.kitItem(eventId, k, "regenerate")} label="↻ Regenerate" className="btn-ghost px-3 py-1 text-xs" busyLabel="Rewriting" />}
          {item.status === "draft" && !dirty && <ActionButton run={() => api.kitItem(eventId, k, "approve")} label="✓ Approve" className="btn-grok px-3 py-1 text-xs" busyLabel="Saving" />}
          {item.status === "approved" && <ActionButton run={() => api.kitItem(eventId, k, "unapprove")} label="Undo" className="btn-ghost px-3 py-1 text-xs" busyLabel="Saving" />}
        </div>
      </div>
      <ItemBody kit={kit} k={k} draft={draft} setDraft={setDraft} />
      {(text !== undefined || k === "newsletter" || k.startsWith("visual:")) && (
        <div className="flex flex-wrap gap-2">
          {text !== undefined && (
            <button
              className="btn-ghost px-3 py-1 text-xs"
              onClick={async () => {
                await navigator.clipboard?.writeText(text).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
          {share && text !== undefined && item.status !== "draft" && (
            <a href={share(text)} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1 text-xs">
              Open {k === "post:x" ? "X" : k === "post:linkedin" ? "LinkedIn" : "WhatsApp"} ↗
            </a>
          )}
          {k === "newsletter" && (
            <button className="btn-ghost px-3 py-1 text-xs" onClick={() => download(`${slug(kit.facts.name)}-newsletter.html`, kit.items.newsletter.data.html, "text/html")}>
              Export HTML
            </button>
          )}
          {k.startsWith("visual:") && (
            <button className="btn-ghost px-3 py-1 text-xs" onClick={() => downloadPng(renderVisual(kit, k.slice(7) as VisualFormat), k.slice(7) as VisualFormat, slug(kit.facts.name))}>
              Download PNG
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const th = "px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500";
const td = "px-2 py-1.5 align-top";

function ItemBody({ kit, k, draft, setDraft }: { kit: EventKit; k: KitKey; draft: unknown; setDraft: (d: unknown) => void }) {
  if (k.startsWith("post:")) {
    const d = draft as { text: string };
    return (
      <div>
        <textarea className="input h-40 text-sm leading-relaxed" value={d.text} onChange={(e) => setDraft({ text: e.target.value })} />
        {k === "post:x" && <p className={`mt-1 text-right text-xs ${d.text.length > 280 ? "text-rose-400" : "text-zinc-500"}`}>{d.text.length}/280</p>}
      </div>
    );
  }
  if (k === "page") {
    const d = draft as EventKit["items"]["page"]["data"];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input text-base font-semibold" value={d.title} onChange={(e) => setDraft({ ...d, title: e.target.value })} />
        <input className="input" value={d.tagline} onChange={(e) => setDraft({ ...d, tagline: e.target.value })} />
        <textarea className="input h-24 sm:col-span-2" value={d.description} onChange={(e) => setDraft({ ...d, description: e.target.value })} />
        <ol className="flex flex-wrap gap-2 text-xs sm:col-span-2">
          {d.agenda.map((a, i) => (
            <li key={i} className="rounded-full bg-white/5 px-2 py-1 text-zinc-300">{i + 1}. {a}</li>
          ))}
        </ol>
      </div>
    );
  }
  if (k === "runSheet")
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Time</th><th className={th}>Item</th><th className={th}>Owner</th><th className={th}>Notes</th></tr></thead>
          <tbody>
            {kit.items.runSheet.data.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className={`${td} font-mono text-fuchsia-300`}>{timeLabel(r.time)}</td>
                <td className={`${td} font-medium`}>{r.item}</td>
                <td className={td}>{r.owner}</td>
                <td className={`${td} text-zinc-400`}>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (k === "budget") {
    const rows = kit.items.budget.data;
    const total = rows.reduce((s, b) => s + b.cost, 0);
    return (
      <table className="w-full text-sm">
        <thead><tr><th className={th}>Item</th><th className={th}>Supplier</th><th className={`${th} text-right`}>Cost</th><th className={th}>Source</th></tr></thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className={td}>{b.item}</td>
              <td className={`${td} text-zinc-400`}>{b.supplier}</td>
              <td className={`${td} text-right font-mono`}>£{b.cost.toFixed(2)}</td>
              <td className={td}><Badge tone={b.source === "receipt" ? "green" : b.source === "quote" ? "sky" : "zinc"}>{b.source}</Badge></td>
            </tr>
          ))}
          <tr className="border-t border-white/20 font-semibold">
            <td className={td} colSpan={2}>Total · £{(total / Math.max(1, kit.facts.headcount)).toFixed(2)} per head</td>
            <td className={`${td} text-right font-mono`}>£{total.toFixed(2)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    );
  }
  if (k === "rota") {
    const rows = kit.items.rota.data;
    const open = rows.filter((r) => !r.person).length;
    return (
      <div>
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Role</th><th className={th}>Shift</th><th className={th}>Person</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className={td}>{r.role}</td>
                <td className={`${td} font-mono text-xs text-zinc-400`}>{timeLabel(r.start)}–{timeLabel(r.end)}</td>
                <td className={td}>{r.person ?? <span className="text-amber-300">needs a volunteer</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open > 0 && <p className="mt-2 text-xs text-amber-300">{open} open slot{open > 1 ? "s" : ""}. The WhatsApp and Discord posts already ask for volunteers.</p>}
      </div>
    );
  }
  if (k === "newsletter") {
    const d = draft as EventKit["items"]["newsletter"]["data"];
    return (
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input font-semibold" value={d.subject} onChange={(e) => setDraft({ ...d, subject: e.target.value })} placeholder="Subject" />
          <input className="input" value={d.preheader} onChange={(e) => setDraft({ ...d, preheader: e.target.value })} placeholder="Preheader" />
        </div>
        <iframe title="Newsletter preview" srcDoc={`<body style="margin:0;padding:20px;background:#fff">${d.html}</body>`} className="h-96 w-full rounded-xl bg-white" sandbox="" />
      </div>
    );
  }
  // Visuals
  const format = k.slice(7) as VisualFormat;
  const d = draft as { headline: string };
  const preview = { ...kit, items: { ...kit.items, [k]: { ...kit.items[k], data: d } } } as EventKit;
  const { w, h } = FORMATS[format];
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(renderVisual(preview, format))}`}
        alt={`${format} visual`}
        className="mx-auto rounded-xl border border-white/10"
        style={{ aspectRatio: `${w} / ${h}`, maxHeight: format === "story" ? 420 : 300, width: "auto", maxWidth: "100%" }}
      />
      <input className="input" value={d.headline} onChange={(e) => setDraft({ headline: e.target.value })} placeholder="Headline" />
      {STATIC && <p className="text-xs text-zinc-500">Rendered in your browser from the brand template.</p>}
    </div>
  );
}
