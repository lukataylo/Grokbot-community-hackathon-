import { NextResponse } from "next/server";
import { clearHostSession } from "@/lib/auth";
import { env } from "@/lib/env";
/** Posted by the sign-out form; lands back on the sign-in screen. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(env.baseUrl).origin && origin !== new URL(req.url).origin) return new Response("forbidden", { status: 403 });
  await clearHostSession();
  return NextResponse.redirect(`${env.baseUrl}/host`, 303);
}
