export type Photo = { id: string; v: number; mine: boolean; with_me: boolean };
export type Me = { name: string; choice: "show" | "cover" | null; taggable: boolean; email: string | null; hasFace: boolean; push: boolean; prefs: { post: boolean; roundup: boolean; likes: boolean }; resume: string };
export type Feed = {
  event: { name: string; hostedBy: string; startsAt: string; endsAt: string; deliverAt: string; delivered: boolean; sharing: boolean; uploads: string; timezone: string };
  me: Me | null; guests: number; pending: number; photos: Photo[]; total: number;
};
export const local = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export function platform() {
  if (typeof navigator === "undefined") return { ios: false, android: false, standalone: false, push: false, inApp: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const push = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const inApp = /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Twitter|GSA\//.test(ua);
  return { ios, android: /Android/.test(ua), standalone, push, inApp };
}
export const fmtTime = (d: string, tz: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
