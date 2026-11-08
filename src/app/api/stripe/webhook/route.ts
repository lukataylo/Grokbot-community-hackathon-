import type Stripe from "stripe";
import { stripe, markPaid } from "@/lib/stripe";
import { env } from "@/lib/env";
import { migrate } from "@/lib/db";

export async function POST(req: Request) {
  if (!stripe || !env.stripeWebhookSecret) return new Response("not configured", { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") || "", env.stripeWebhookSecret); }
  catch { return new Response("bad signature", { status: 400 }); }
  await migrate();
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await markPaid(event.data.object as Stripe.Checkout.Session);
  }
  return new Response("ok");
}
