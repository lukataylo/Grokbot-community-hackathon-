import Stripe from "stripe";
import { env } from "./env";
import { sql } from "./db";
import { HttpError } from "./api";

export const stripe = env.stripeSecret ? new Stripe(env.stripeSecret) : null;

/** Per-event unlock of social sharing. Promotion codes are enabled for discounts. */
export async function checkoutForEvent(event: { id: string; name: string }, hostEmail: string) {
  if (!stripe) throw new HttpError(503, "Payments aren't switched on yet. Try again later.");
  const line = { price_data: { currency: env.currency, unit_amount: env.priceAmount, product_data: { name: "Lumzel social sharing, one event" } }, quantity: 1 };
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [line],
    allow_promotion_codes: true,
    customer_email: hostEmail,
    client_reference_id: event.id,
    metadata: { event_id: event.id },
    payment_intent_data: { description: `Lumzel sharing: ${event.name}`, metadata: { event_id: event.id } },
    invoice_creation: { enabled: true, invoice_data: { description: `Social sharing for ${event.name}` } },
    success_url: `${env.baseUrl}/host/e/${event.id}?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.baseUrl}/host/e/${event.id}?cancelled=1`,
  });
}

/** Called by the webhook and on return from Checkout (whichever comes first). Idempotent. */
export async function markPaid(session: Stripe.Checkout.Session) {
  const eventId = session.metadata?.event_id || session.client_reference_id;
  // A 100%-off promotion code completes as no_payment_required: that unlocks too.
  if (!eventId || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) return false;
  await sql`update events set sharing_unlocked = true, paid_at = coalesce(paid_at, now()), amount_paid = ${session.amount_total ?? 0},
    currency = ${session.currency ?? env.currency}, stripe_session_id = ${session.id} where id = ${eventId}`;
  return true;
}
