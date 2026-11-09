import { sql } from "./db";
import { env, inBeta } from "./env";
import { token, sha256 } from "./ids";
import { sendEmail } from "./email";

/** Who may host: the BETA_EMAILS list, anyone who signed up on the landing page, or a host who already runs events. */
export async function canHost(email: string) {
  if (inBeta(email)) return true;
  const [r] = await sql`select 1 from interest where email = ${email}
    union all select 1 from hosts h join events e on e.host_id = h.id where h.email = ${email} limit 1`;
  return !!r;
}

/** Emails a one-time sign-in link (20 minutes). Returns the link and whether the email went out. */
export async function sendSignInLink(email: string, welcome = false) {
  const t = token();
  await sql`insert into login_tokens (token_hash, email, expires_at) values (${sha256(t)}, ${email}, now() + interval '20 minutes')`;
  const link = `${env.baseUrl}/api/host/verify?t=${t}`;
  const sent = welcome
    ? await sendEmail(email, "You're in: your Lumzel sign-in link",
        `You're in the Lumzel beta.\n\nSign in and set up your first event (it takes a couple of minutes):\n\n${link}\n\nThe link works once, for 20 minutes. You can get a new one any time at ${env.baseUrl}/host.\n\nQuestions or feedback? Just reply to this email.`)
    : await sendEmail(email, "Your Lumzel sign-in link", `Tap to sign in to Lumzel:\n\n${link}\n\nThe link works once, for 20 minutes. If you didn't ask for it, ignore this email.`);
  return { link, sent };
}
