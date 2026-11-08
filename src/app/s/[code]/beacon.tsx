"use client";
import { useEffect } from "react";
/** Counts a click only in a real browser that runs scripts; link-preview crawlers never do. */
export function Beacon({ code }: { code: string }) {
  useEffect(() => { const t = setTimeout(() => navigator.sendBeacon?.(`/api/s/${code}/click`) ?? fetch(`/api/s/${code}/click`, { method: "POST", keepalive: true }), 600); return () => clearTimeout(t); }, [code]);
  return null;
}
