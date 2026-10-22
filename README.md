# afterglow

**Every photo from tonight, found, consented and shared together.**

Built at the Grok Bot Community Engineering Hackathon, London (22 Oct 2026), for the **Weird Stuff** track.

## The community and the problem

This is for London's hackathon and meetup communities: the people who run nights like this one (Hackradar, The Hack Collective, AI Agents Lab, Unicorn Mafia and friends).

After every event it's the same story:

- The best photos sit in 40 different camera rolls. The organiser spends the next three days asking "can you send me that photo?"
- Nobody is tagged, so people never see the photos of themselves.
- Some people asked not to be photographed or posted, and they get posted anyway, because nobody keeps track.
- The few posts that do go out land alone: no replies, no upvotes, no reposts, so they reach almost nobody and the event looks quieter than it was.

## What afterglow does

1. **Scan & choose.** Attendees scan a QR code, add their X and LinkedIn, describe how Grok can spot them ("orange hoodie, glasses"), and choose whether they can be photographed and tagged.
2. **Everyone uploads** to one shared gallery.
3. **Grok finds you.** Grok vision matches people to their self-descriptions (no face biometrics), works out where in the venue the photo was taken, and writes a caption. Consent is enforced in code after the model: anyone who said no to photos is blurred or hidden, and anyone who said no to tagging is never tagged.
4. **The night as a timeline.** Photos are grouped into moments by time and place. Attendees scroll it on their phones, and the organiser plays it on the big screen at the end (`/organiser/<event>/timeline`).
5. **Post together.** Grok plans the sharing. It picks the best photos, chooses who posts each one (the highest reach in the photo), and staggers the posts 20 minutes apart. Then it lines up early upvotes, replies from the people in the photo, and delayed reposts from high-reach attendees outside it. Replies and upvotes stay locked until the post is live. When the poster pastes their link, everyone else's "Open the post" button goes straight to it. Nothing reaches attendees until the organiser approves the plan.
6. **Keep score.** Points for photos, posts, replies, upvotes and reposts, with community merch for the top three. Each attendee can also have Grok draft a personal recap post from the photos they're in, mentioning only people who opted in.

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
| `/organiser/grokbot-london/timeline` | Big-screen replay of the night, built from photo capture times and places |
| `/join/grokbot-london` | Attendee app · **Join**: QR landing with name, email, X, LinkedIn, how Grok can spot you, and consent |
| `/e/grokbot-london` | Attendee app · **Photos**: all photos / photos of me, upload, Grok tags and consent redactions |
| `/e/grokbot-london/leaderboard` | Attendee app · **Leaderboard**: tonight / all time, community merch, points guide |
| `/e/grokbot-london/me` | Attendee app · **Grok**: your rank, a recap post drafted from your photos, your share tasks |
| `/e/grokbot-london/plan` | Organiser · sharing plan in timed waves, approve before attendees see it |
| `/organiser/grokbot-london` | Organiser dashboard: QR, people found, kept private, live coordination per wave, Grok console, consent list |
| `/organiser/grokbot-london/autopilot` | Extra: Event Autopilot drafts the promo kit and weekly digest for the next event |

## Design

The attendee side is a mobile app (Photos, Leaderboard and Grok tabs) with the afterglow camera mascot. On a laptop it shows as a phone frame. The organiser side (Dashboard, Autopilot, Weekly digest, Share plan) is a desktop workspace using the same palette: sky `#45b8fb`, navy `#0c1f4d` and mist `#eef5fc`, with Plus Jakarta Sans. Theme tokens live in `src/app/globals.css`.

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
- **Points** (`src/lib/points.ts`): upload 10, tagged 2, post 25, repost 10, reply 5, upvote 3.

## Event Autopilot (extra)

Also built tonight. Event Autopilot turns a one-line idea into a run sheet, budget, rota, posts, newsletter and visuals, and drafts a weekly digest from Luma. It shares the same codebase. See the routes above.

### Volunteer hours saved

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

1. **The problem (20s).** "After every hackathon, photos sit in 40 camera rolls, nobody's tagged, and the people who said no get posted anyway."
2. **Scan (30s).** Put the dashboard QR on screen. A judge scans it on their phone and joins, choosing their consent. They appear live under "Checked in".
3. **Upload (40s).** The judge uploads a real photo. Grok finds the people in it, adds a place and caption, and the photo shows up in their "Of me" tab. Point out the 🛡 "kept private" count.
4. **Post together (50s).** On the dashboard, Plan the sharing → Approve & send. On a phone, the poster sees "Post this photo", posts it, and pastes the link. Another attendee's upvote and reply unlock with "Open the post", and the wave meters fill on the dashboard.
5. **The afterglow (40s).** Play the timeline on the big screen, then show the leaderboard and a Grok-drafted recap.

## Mocked for the demo

- X OAuth: "Continue with X" plus a demo "sign in as" switcher.
- Follower counts are seeded.
- Posting uses X/LinkedIn share intents, and completion is self-reported with "Mark done".
- Seeded photos are SVG scenes, so tagging is deterministic without a key.

Stretch goal: post-event replay. Photos carry `takenAt`, ready for a timeline with overlays.

## Licence

MIT, see `LICENSE`.
