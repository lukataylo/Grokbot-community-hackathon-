# Lumzel

**Every photo from your event, pooled, consented and delivered to the people in them.**

Guests scan a QR code, choose whether they want to appear, and upload. Anyone who isn't a matched "Show me" guest is tiled out before a photo is shown to anyone. The next morning at 07:30, each guest gets the photos they're in. Hosts can unlock a sharing agent that drafts posts and smart links so the event's photos actually travel.

## How it works

1. **Join.** Guests scan the event QR, pick *Show me* or *Cover me*, and (optionally) take a selfie. Only the face embedding is kept; the selfie image is never stored.
2. **Upload.** Everyone adds photos to one pool from the installable PWA.
3. **Consent tiling.** Faces and pose-based heads are detected on the server. Anyone not matched to a *Show me* guest is burned in as soft tiles. A vision model double-checks the fully tiled copy and flags possible misses for host review.
4. **Delivery.** At 07:30 the next day each guest gets their photos by push notification (iOS-aware setup) or email fallback, to save and share.
5. **Sharing (£50 per event).** A sharing agent writes scenes and captions from tiled photos, checks them against rules, and produces smart links with OG cards, click tracking and a cheer feed and leaderboard.

## Stack

Next.js 15 (standalone) · Postgres · S3-compatible bucket · tfjs-node + Human for detection · OpenRouter for the agent · Web Push · Cloudflare Email Sending · Stripe Checkout. Deployed on Railway from the `Dockerfile`.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in what you have; everything is optional in dev
createdb lumzel                 # schema in db/schema.sql is applied on boot
npm run dev                     # http://localhost:3000
```

Without email configured, host sign-in shows a dev link. Without a bucket, photos go to `.data/store`.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/host` | Host sign-in (magic link) and event list |
| `/host/new` | Six-step event setup |
| `/host/e/<id>` | Dashboard: QR, review queue, delivery, reach, leaderboard, sharing unlock |
| `/host/e/<id>/screen` | Big-screen mode |
| `/host/e/<id>/poster` | Printable QR poster |
| `/<slug>` | Guest PWA for an event |
| `/s/<code>` | Smart share link with OG/Twitter card |

## Tests

```bash
npm run test:e2e      # Playwright guest + host journey on iPhone, iPad, Pixel and desktop (needs E2E_SECRET)
npm run eval:agent    # sharing-agent eval against OpenRouter
```

## History

Started at the Grok Bot Community Engineering Hackathon, London (22 Oct 2026) as *afterglow*, then rebuilt as Lumzel.

## License

MIT
