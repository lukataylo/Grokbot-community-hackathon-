# Grokbot Event Autopilot

Built at the Grok Bot Community Engineering Hackathon, London (22 Oct 2026).

**Hackathon Track 3: Event Autopilot.** Turn one event into a run sheet, posts, visuals and a newsletter that a lead approves with one click.

Every week someone writes the event page, makes the visuals, posts everywhere, sends the newsletter and chases volunteers, all by hand. Grokbot does that work and the lead stays in control: nothing goes out until they approve it, and every approval shows up as **volunteer hours saved**.

- **Before the event (Autopilot):** drop in a one-line idea, an optional Luma link and your notes, quotes and receipts. Grokbot drafts the event page, run sheet, budget, volunteer rota, posts for LinkedIn, X, WhatsApp and Discord, a Ghost-ready newsletter, and four on-brand visuals. Approve, edit or regenerate each piece, or **Approve all & publish**.
- **Every week (Digest):** pull this week's events from a Luma calendar feed and draft the newsletter and group message.
- **On the night:** "Now / Next" from the run sheet, QR check-in, and last-minute changes that Grok writes up and pushes to the group.
- **After the event:** attendees upload photos and Grok tags the people who opted in. The sharing plan (who posts, comments and reposts, and when) reaches attendees only after the lead approves it. A points leaderboard keeps it fun.

## Run

```bash
npm install
cp .env.example .env.local   # optional: add XAI_API_KEY for real Grok
npm run dev                  # http://localhost:3000
```

Demo data is seeded into `data/db.json` on first run. Use **Reset demo** on the organiser page to start over.

## Pages

| Route | What it is |
| --- | --- |
| `/organiser/grokbot-london/autopilot` | **Event Autopilot**: idea → kit, per-piece approve / edit / regenerate, Approve all & publish, brand, Notion export |
| `/organiser/digest` | Weekly digest from a Luma calendar `.ics` feed |
| `/join/grokbot-london` | QR landing page: X sign-in, handles, appearance hint, consent |
| `/e/grokbot-london` | Shared gallery and upload, with Grok tags and consent redactions |
| `/e/grokbot-london/me` | Your photos and your share tasks |
| `/e/grokbot-london/plan` | Grokbot sharing plan in timed waves |
| `/e/grokbot-london/leaderboard` | Points, reach and prizes (live) |
| `/organiser/grokbot-london` | Organiser dashboard: hours saved, Now / Next, push a change, QR, stats, Grokbot console, live activity |

## Architecture

- **Next.js 15** App Router: server components read the store, and API routes mutate it.
- **Store** (`src/lib/store.ts`): a JSON file locally. `supabase/schema.sql` is the matching Supabase schema for production.
- **Grok** (`src/lib/grok.ts`): with `XAI_API_KEY` set, it uses xAI chat completions for vision matching (attendee self-descriptions, not face biometrics), post copy and console Q&A. Without a key, it falls back to a deterministic mock.
- **Consent is enforced in code** (`src/lib/services.ts`), after model output: opted-out people are withheld from tags, and people who refuse photos are blurred or hidden.
- **Plan generator**: up to 4 anchor posts, each by the highest-reach person in the photo, staggered 20 minutes apart. Each is followed by early comments from people in the photo and delayed reposts from high-reach people outside it, with at most 4 tasks per person.
- **Autopilot** (`src/lib/kit.ts`): parses the idea (date, time, venue, headcount, food) and the dump (`£` lines become budget lines marked receipt, quote or estimate; `Volunteers:` and `Speakers:` lines fill the rota and hosts). Grok writes the copy (`grokWriteKit` in `src/lib/grok.ts`). Run sheet timings, rota shifts and budget maths are computed in code so a lead can trust them. Every piece has a template fallback, so the demo runs with no keys.
- **Visuals** (`src/lib/visual.ts`): SVG templates driven by the brand (community name, three colours, font). Text is wrapped and shrunk until it fits, so it never overflows. Formats: square 1080×1080, story 1080×1920, banner 1600×900, newsletter header 1200×400. Served at `/api/visual/<eventId>/<format>` and downloadable as PNG.
- **Publishing** (`src/lib/services.ts`): newsletter → Ghost Admin API draft (`GHOST_ADMIN_URL`, `GHOST_ADMIN_KEY`), otherwise an HTML export. Discord → webhook (`DISCORD_WEBHOOK_URL`), otherwise copy. LinkedIn, X and WhatsApp use official share links. Notion export (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`) creates a page with the run sheet, budget and rota as tables, otherwise it downloads Markdown.
- **Luma**: `api.lu.ma/event/get` (no key) seeds the name, time, venue, hosts and description. The digest reads `api.lu.ma/ics/get`. If Luma can't be reached, Autopilot falls back to the idea and the digest uses a sample feed that is clearly labelled.
- **Points** (`src/lib/points.ts`): upload 10, tagged 2, post 25, repost 10, comment 5.

## Volunteer hours saved

A piece counts only once the lead approves or sends it (`src/lib/hours.ts`). Manual time per piece:

| Piece | Minutes |
| --- | --- |
| Event page | 45 |
| Run sheet | 60 |
| Budget | 45 |
| Volunteer rota and chasing | 60 |
| Each social post (LinkedIn, X, WhatsApp, Discord) | 20 |
| Each visual (4 formats) | 30 |
| Newsletter | 90 |
| Photo tagging | 2 per photo |
| Share coordination (approved plan) | 30 |
| Last-minute update | 10 |
| Weekly digest | 120 |

A full kit saves about 8.3 hours. With photos, the share plan and a digest it comes to more than 10 hours a week.

## 3-minute demo script

1. **Autopilot** → "Try an example" → **Regenerate everything**. One line becomes 13 drafts: run sheet, budget built from the receipts, a rota with names, four posts, a newsletter and four visuals.
2. Edit the X post, save it, approve it, and watch the hours meter move. Regenerate the WhatsApp message. Change the brand colours and watch all four visuals re-render.
3. **Approve all & publish**: everything turns to "sent", the newsletter goes to Ghost (or exports as HTML) and the hours saved jump to about 8h. Download a PNG and export to Notion.
4. **Organiser**: Now / Next from the run sheet. Push "Demos moved to 21:45" and Grok writes the update for the group.
5. **After the event**: run Grok tagging, where consent is enforced in code. Generate the share plan, which attendees can't see until you approve it. Then the leaderboard.

## Mocked for the demo

- X OAuth: "Continue with X" plus a demo "sign in as" switcher.
- Follower counts are seeded.
- Posting uses X/LinkedIn share intents, and completion is self-reported with "Mark done".
- Seeded photos are SVG scenes, so tagging is deterministic without a key.

Stretch goal: post-event replay. Photos carry `takenAt`, ready for a timeline with overlays.

## Licence

MIT, see `LICENSE`.
