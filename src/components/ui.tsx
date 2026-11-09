"use client";
import { useCallback, useEffect, useState } from "react";

const BURST = "M100 100L43.8 89.0M100 100L87.3 42.9M100 100L107.4 49.7M100 100L156.9 97.9M100 100L137.6 149.0M100 100L81.9 172.5M100 100L126.0 160.1M100 100L77.0 139.9M100 100L73.2 120.0M100 100L129.6 57.0";
export function Burst({ size = 22, ink = "currentColor", you = true, width = 10 }: { size?: number; ink?: string; you?: boolean | "ink"; width?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      <path d={BURST} stroke={ink} strokeWidth={width} fill="none" />
      {you && <path d="M100 100L187.8 127.5" stroke={you === "ink" ? ink : "#FFB000"} strokeWidth={you === "ink" ? width : width * 1.15} fill="none" />}
    </svg>
  );
}
export function Logo({ href = "/" }: { href?: string }) {
  return <a className="mark" href={href} aria-label="lumzel home"><Burst size={22} you="ink" />lumzel</a>;
}

const paths: Record<string, string> = {
  person: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1-3.8 4-5.6 7.5-5.6s6.5 1.8 7.5 5.6",
  plus: "M12 5v14M5 12h14",
  camera: "M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  share: "M12 3v12M7.5 7.5L12 3l4.5 4.5M5 11v9h14v-9",
  check: "M5 12.5L10 17L19 7",
  close: "M6 6l12 12M18 6L6 18",
  copy: "M8 8h11v11H8zM5 15V5h10",
  down: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  ext: "M8 16L16 8M9 8h7v7",
  clock: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 7.5V12l3 2",
  heart: "M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19z",
  photo: "M4 5h16v14H4zM8.5 13.5l2.5-3 4 5M15 10.5a1.5 1.5 0 1 0 0-3",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4",
  home: "M4 4h16v16H4zM12 8v8M8 12h8",
  lock: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3",
  back: "M15 5l-7 7 7 7",
};
export function Icon({ name, size = 22, color = "currentColor", width = 1.7, label }: { name: keyof typeof paths | string; size?: number; color?: string; width?: number; label?: string }) {
  const isClose = name === "close";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {name === "cover" ? (<><rect x="7.5" y="4" width="9" height="9.5" rx="2" fill={color} /><path d="M4.5 20c1-3.8 4-5.6 7.5-5.6s6.5 1.8 7.5 5.6" stroke={color} strokeWidth={width} fill="none" /></>)
        : <path d={paths[name] ?? ""} stroke={color} strokeWidth={isClose || name === "check" ? width + 0.4 : width} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...(init?.headers || {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data as { error?: string }).error || "Something went wrong"), { status: r.status });
  return data as T;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  const node = msg ? <div className="toast" role="status"><Icon name="check" size={14} color="#FFB000" />{msg}</div> : null;
  return { toast: useCallback((m: string) => setMsg(m), []), node };
}

/** Downscale on the phone before upload: faster on venue Wi-Fi, and HEIC arrives as JPEG. */
export async function shrink(file: File, max = 2560): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.88));
  } catch { return file; }
}

export const img = (id: string, v: number | string, w = 480) => `/img/${id}?w=${w}&v=${v}`;
