# Grokbot Event Share

Built at the Grok Bot Community Engineering Hackathon, London (22 Oct 2026).

Attendees scan a QR code, sign in with X, add their LinkedIn and set consent (OK to be photographed, OK to be tagged). Everyone uploads event photos. Grok matches the people who opted in, tags them and delivers "your photos" to each person. Grokbot then builds a timed sharing plan across X and LinkedIn (who posts, who comments, who reposts whom, with ready-to-post copy) and gamifies it with a points leaderboard and prizes. Organisers run it all from a dashboard with a Grokbot command console.

## Run

```bash
npm install
cp .env.example .env.local   # optional: add XAI_API_KEY for real Grok
npm run dev                  # http://localhost:3000
```

Demo data is seeded into `data/db.json` on first run. Use **Reset demo** on the organiser page to start over.

### Static preview (GitHub Pages)

`./scripts/build-static.sh` builds a browser-only version into `out/`: mock Grok, seeded data kept in localStorage, and the same consent, plan and points logic (`src/lib/engine.ts`). `.github/workflows/pages.yml` publishes it to the `gh-pages` branch on every push to `main`. One-time setup: **Settings → Pages → Deploy from a branch → `gh-pages` / root**. The site is then served at `https://<owner>.github.io/<repo>/`.

## Pages

| Route | What it is |
| --- | --- |
| `/join/grokbot-london` | QR landing page: X sign-in, handles, appearance hint, consent |
| `/e/grokbot-london` | Shared gallery and upload, with Grok tags and consent redactions |
| `/e/grokbot-london/me` | Your photos and your share tasks |
| `/e/grokbot-london/plan` | Grokbot sharing plan in timed waves |
| `/e/grokbot-london/leaderboard` | Points, reach and prizes (live) |
| `/organiser/grokbot-london` | Organiser dashboard: QR, stats, actions, Grokbot console, live activity |

## Architecture

- **Next.js 15** App Router: server components read the store, and API routes mutate it.
- **Store** (`src/lib/store.ts`): a JSON file locally. `supabase/schema.sql` is the matching Supabase schema for production.
- **Grok** (`src/lib/grok.ts`): with `XAI_API_KEY` set, it uses xAI chat completions for vision matching (attendee self-descriptions, not face biometrics), post copy and console Q&A. Without a key, it falls back to a deterministic mock.
- **Consent is enforced in code** (`src/lib/services.ts`), after model output: opted-out people are withheld from tags, and people who refuse photos are blurred or hidden.
- **Plan generator**: up to 4 anchor posts, each by the highest-reach person in the photo, staggered 20 minutes apart. Each is followed by early comments from people in the photo and delayed reposts from high-reach people outside it, with at most 4 tasks per person.
- **Points** (`src/lib/points.ts`): upload 10, tagged 2, post 25, repost 10, comment 5.

## Mocked for the demo

- X OAuth: "Continue with X" plus a demo "sign in as" switcher.
- Follower counts are seeded.
- Posting uses X/LinkedIn share intents, and completion is self-reported with "Mark done".
- Seeded photos are SVG scenes, so tagging is deterministic without a key.

Stretch goal: post-event replay. Photos carry `takenAt`, ready for a timeline with overlays.
