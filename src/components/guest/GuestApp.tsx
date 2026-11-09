"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Icon, useToast } from "../ui";
import { Join, Choose, FindMe } from "./Onboard";
import { Notify } from "./Notify";
import { Photos, Viewer } from "./Photos";
import { ShareFlow } from "./Share";
import { Posts } from "./Posts";
import { You } from "./You";
import { local, platform, type Feed, type Photo } from "./types";

type Tab = "photos" | "posts" | "you";
type Over = null | "choose" | "selfie" | "notify";

export default function GuestApp({ slug, initial, vapid }: { slug: string; initial: Feed; vapid: string }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [tab, setTab] = useState<Tab>("photos");
  const [focus, setFocus] = useState<string | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [view, setView] = useState<Photo | null>(null);
  const [sharing, setSharing] = useState<Photo | null>(null);
  const [standalone, setStandalone] = useState(false);
  const { toast, node } = useToast();
  const k = (s: string) => `lz:${slug}:${s}`;

  const reload = useCallback(async () => { try { setFeed(await api<Feed>(`/api/g/${slug}/feed`)); } catch { /* keep last */ } }, [slug]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setStandalone(platform().standalone);
    const q = new URLSearchParams(location.search);
    if (q.get("tab") === "posts") { setTab("posts"); setFocus(q.get("post")); }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") reload(); }, feed.event.delivered ? 60_000 : 15_000);
    const on = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", on);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", on); };
  }, [reload, feed.event.delivered]);

  const me = feed.me;
  if (!me) return <Join slug={slug} feed={feed} onDone={reload} />;
  if (!me.choice || over === "choose") return <Choose slug={slug} feed={feed} step={!me.choice} onDone={() => { setOver(null); reload(); }} />;
  if ((!me.hasFace && !local.get(k("selfieSkip"))) || over === "selfie")
    return <FindMe slug={slug} feed={feed} onDone={() => { setOver(null); reload(); }} onSkip={() => { local.set(k("selfieSkip"), "1"); setOver(null); reload(); }} />;
  const needNotify = !me.push && !me.email && !local.get(k("notifyDone"));
  if (needNotify || over === "notify")
    return <Notify slug={slug} feed={feed} vapid={vapid} standaloneStart={standalone} onDone={() => { local.set(k("notifyDone"), "1"); setOver(null); reload(); }} />;

  const showPosts = feed.event.sharing;
  return (
    <div className="shell">
      {node}
      {tab === "photos" && <Photos slug={slug} feed={feed} reload={reload} open={setView} toast={toast} />}
      {tab === "posts" && showPosts && <Posts slug={slug} feed={feed} focus={focus} />}
      {tab === "you" && <You slug={slug} feed={feed} reload={reload} toast={toast} editChoice={() => setOver("choose")} retakeSelfie={() => setOver("selfie")} setupNotify={() => setOver("notify")} />}
      <nav className="tabs" aria-label="Sections">
        <button aria-current={tab === "photos" ? "page" : undefined} onClick={() => setTab("photos")}><Icon name="photo" />Photos</button>
        {showPosts && <button aria-current={tab === "posts" ? "page" : undefined} onClick={() => setTab("posts")}><Icon name="heart" />Posts</button>}
        <button aria-current={tab === "you" ? "page" : undefined} onClick={() => setTab("you")}><Icon name="person" />You</button>
      </nav>
      {view && !sharing && <Viewer p={view} feed={feed} toast={toast} onClose={() => setView(null)} onShare={() => setSharing(view)} />}
      {sharing && <ShareFlow slug={slug} p={sharing} feed={feed} toast={toast} onClose={() => { setSharing(null); setView(null); reload(); }} />}
    </div>
  );
}
