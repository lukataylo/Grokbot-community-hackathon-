// Server-only configuration. Missing optional services degrade gracefully (logged), never crash.
export const env = {
  baseUrl: (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/lumzel",
  sessionSecret: process.env.SESSION_SECRET || "dev-only-secret-change-me-dev-only-secret",
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "auto",
    bucket: process.env.S3_BUCKET || "",
    key: process.env.S3_ACCESS_KEY_ID || "",
    secret: process.env.S3_SECRET_ACCESS_KEY || "",
    // Railway buckets use virtual-host URLs; MinIO and some others need path style.
    pathStyle: (process.env.S3_URL_STYLE || "virtual-host") === "path",
  },
  localStore: process.env.LOCAL_STORE_DIR || ".data/store",
  stripeSecret: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  priceAmount: 5000,
  currency: "gbp",
  openrouterKey: process.env.OPENROUTER_API_KEY || "",
  visionModel: process.env.VISION_MODEL || "openai/gpt-6-luna",
  textModel: process.env.TEXT_MODEL || "deepseek/deepseek-v4.1-flash",
  agentDebug: !!process.env.AGENT_DEBUG,
  resendKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "Lumzel <hello@lumzel.com>",
  notifyEmail: process.env.NOTIFY_EMAIL || "", // gets an email for every new register-interest sign-up
  vapidPublic: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivate: process.env.VAPID_PRIVATE_KEY || "",
  testSecret: process.env.E2E_SECRET || "",
  isProd: process.env.NODE_ENV === "production",
  // Private beta: who may create events. Comma-separated emails, or "@domain" for a whole domain.
  betaEmails: (process.env.BETA_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
};

/** In beta, only listed hosts create events. Unset means open in development, closed in production. */
export function inBeta(email: string) {
  const e = email.toLowerCase();
  if (!env.betaEmails.length) return !env.isProd;
  return env.betaEmails.some((b) => (b.startsWith("@") ? e.endsWith(b) : e === b));
}

/** Production must never run on the dev session secret or on local disk (wiped on every deploy). */
export function assertProductionConfig() {
  if (!env.isProd) return;
  const missing = [
    !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 ? "SESSION_SECRET (32+ chars)" : "",
    !process.env.DATABASE_URL ? "DATABASE_URL" : "",
    // Local disk only when asked for explicitly (local production builds and tests).
    !(env.s3.endpoint && env.s3.bucket && env.s3.key && env.s3.secret) && !process.env.LOCAL_STORE_DIR ? "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (or LOCAL_STORE_DIR)" : "",
    !process.env.PUBLIC_URL ? "PUBLIC_URL" : "",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing production config: ${missing.join("; ")}`);
}
