# afterglow

**Every photo from tonight, found, consented and shared together.**

Built at the Grok Bot Community Engineering Hackathon, London (22 Oct 2026), for the **Weird Stuff** track. MIT licensed.

## The problem

afterglow is for London's hackathon and meetup communities: the people who run nights like this one (Hackradar, The Hack Collective, AI Agents Lab, Unicorn Mafia and friends). After every event it's the same story:

- The best photos sit in 40 different camera rolls, and the organiser spends the next three days asking "can you send me that photo?"
- Nobody is tagged, so people never see the photos of themselves.
- Some people asked not to be photographed or posted, and they get posted anyway, because nobody keeps track.
- The few posts that do go out land alone. With no replies, upvotes or reposts they reach almost nobody, and the event looks quieter than it was.

## How it works

1. **Scan and choose.** Attendees scan a QR code, add their X and LinkedIn, describe how Grok can spot them ("orange hoodie, glasses"), and choose whether they can be photographed and whether they can be tagged.
2. **Everyone uploads** to one shared gallery.
3. **Grok finds you.** Grok vision matches people to their self-descriptions (no face biometrics), works out where in the venue the photo was taken, and writes a caption. Consent is then enforced in code: anyone who said no to photos is blurred or hidden, and anyone who said no to tagging is never tagged.
4. **The night as a timeline.** Photos are grouped into moments by time and place. Attendees scroll it on their phones, and the organiser plays it on the big screen at the end.
5. **Post together.** Grok plans the sharing:
   - It picks the best photos and gives each one to the person in it with the most followers.
   - It staggers those posts 20 minutes apart.
   - It lines up early upvotes and replies from the people in the photo, plus later reposts from high-reach attendees who aren't in it.

   Replies and upvotes stay locked until the post is live. When the poster pastes their link, everyone else's "Open the post" button goes straight to it. Attendees see nothing until the organiser approves the plan.
6. **Keep score.** A leaderboard awards points for photos, posts, replies, upvotes and reposts, and the top three win community merch. Each attendee can also have Grok draft a personal recap post from the photos they're in. It only mentions people who opted in.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: every key has a mock fallback
npm run dev                  # http://localhost:3000/organiser/grokbot-london
```

- On first run, demo data is seeded into `data/db.json`: 12 attendees, tagged photos and a share plan. Use **Reset demo** on the organiser dashboard to start over.
- Two seeded attendees show the consent rules. Ben Carter allows photos but not tagging, and Noah Williams allows neither.
- With no `XAI_API_KEY`, every Grok call uses a deterministic mock, so the demo never needs a key.
- To build a browser-only copy for GitHub Pages, run `scripts/build-static.sh`. It uses mock Grok, keeps data in the browser's localStorage, and writes the output to `./out`. Set `NEXT_PUBLIC_BASE_PATH` when hosting under a sub-path.

## Pages

**Attendee app.** This is mobile-first; on a laptop it shows inside a phone frame.

| Route | What it is |
| --- | --- |
| `/join/grokbot-london` | Join: name, email, X, LinkedIn, how Grok can spot you, and consent |
| `/e/grokbot-london` | Photos: "All photos" and "Of me" tabs, upload, Grok tags, consent redactions |
| `/e/grokbot-london/leaderboard` | Leaderboard: "Tonight" and "All time" tabs, community merch, points guide |
| `/e/grokbot-london/me` | Grok: your rank, a recap drafted from your photos, your share tasks |

**Organiser workspace.**

| Route | What it is |
| --- | --- |
| `/organiser/grokbot-london` | Dashboard: QR, checked-in count, people found, kept private, live coordination per wave, Grok console, consent list |
| `/organiser/grokbot-london/timeline` | Big-screen replay of the night, built from photo capture times and places |
| `/e/grokbot-london/plan` | Share plan in timed waves; approve it before attendees see it |
| `/organiser/grokbot-london/autopilot` | Event Autopilot (extra, see below) |
| `/organiser/digest` | Weekly digest from a Luma calendar (part of Autopilot) |

## 3-minute demo script

1. **The problem (20s).** "After every hackathon, photos sit in 40 camera rolls, nobody's tagged, and the people who said no get posted anyway."
2. **Scan (30s).** Put the dashboard QR on screen. A judge scans it with their phone, joins and sets their consent, then appears live under "Checked in".
3. **Upload (40s).** The judge uploads a real photo. Grok finds the people in it and adds a place and caption, and the photo appears in the judge's "Of me" tab. Point out the 🛡 "kept private" count.
4. **Post together (50s).** On the dashboard, click **Plan the sharing**, then **Approve & send**. On a phone, the poster sees "Post this photo", posts it and pastes the link. Another attendee's upvote and reply then unlock with "Open the post", and the wave meters fill on the dashboard.
5. **The afterglow (40s).** Click **▶ Play the timeline** on the big screen, then show the leaderboard and a Grok-drafted recap.

## Architecture

- **Next.js 15** App Router with Tailwind v4. Views are client components that read the shared state from `/api/state`, and API routes make every change. In the static build, the same pure functions in `src/lib/engine.ts` and `src/lib/kit.ts` run in the browser instead.
- **Store** (`src/lib/store.ts`): a JSON file locally. `supabase/schema.sql` is the matching Supabase schema for production.
- **Grok** (`src/lib/grok.ts`): with `XAI_API_KEY` set, it uses xAI chat completions for vision matching, post and recap copy, console Q&A, and Autopilot copy. Every function falls back to a mock when the key is missing or a call fails.
- **Consent is enforced in code, after the model** (`applyTags` in `src/lib/engine.ts`). People who said no to tagging are withheld from tags. People who said no to photos are blurred in seeded scenes, and real uploads containing them are hidden. The share plan and recaps only ever name people who opted in.
- **Share plan** (`buildPlan` in `src/lib/engine.ts`): up to 4 anchor posts, 20 minutes apart. Each is followed by replies and upvotes from people in the photo, then reposts from high-reach people outside it, with at most 4 tasks per person. Follow-up tasks unlock once the anchor post is live.
- **Points** (`src/lib/points.ts`): upload 10, tagged 2, post 25, repost 10, reply 5, upvote 3.

## Event Autopilot (extra)

Also built tonight, in the same codebase. Event Autopilot turns a one-line idea (plus an optional Luma event and a box of notes and receipts) into a run sheet, budget, rota, posts, a newsletter and visuals. The lead edits, regenerates or approves each piece, or publishes everything at once.

- **Kit** (`src/lib/kit.ts`): parses the idea (date, time, venue, headcount, food) and the notes box. Lines with `£` become budget lines marked receipt, quote or estimate. `Volunteers:` and `Speakers:` lines fill the rota and hosts. Grok writes the copy (`grokWriteKit`). Run sheet timings, rota shifts and budget maths are computed in code, so a lead can trust them.
- **Visuals** (`src/lib/visual.ts`): SVG templates driven by the brand (community name, three colours, font). Text wraps and shrinks until it fits, so it never overflows. Formats are square 1080×1080, story 1080×1920, banner 1600×900 and newsletter header 1200×400. They're served at `/api/visual/<eventId>/<format>` and can be downloaded as PNG.
- **Luma**: `api.lu.ma/event/get` (no key needed) seeds the event's name, time, venue, hosts and description. The weekly digest reads the calendar feed at `api.lu.ma/ics/get`. If Luma can't be reached, Autopilot builds the kit from the idea text alone, and the digest uses a clearly labelled sample feed.

### Optional integrations

Set these in `.env.local`. Each one has a fallback, so nothing is required.

| Env | With it | Without it |
| --- | --- | --- |
| `XAI_API_KEY` | Real Grok | Deterministic mock |
| `GHOST_ADMIN_URL`, `GHOST_ADMIN_KEY` | Newsletter created as a Ghost draft (Admin API, JWT signed in code) | HTML export |
| `DISCORD_WEBHOOK_URL` | Announcements posted to Discord | Copied to the clipboard |
| `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID` | A Notion page with the run sheet, budget and rota as tables | Markdown download |
| `NEXT_PUBLIC_PUBLIC_URL` | A join QR that phones can open (e.g. your ngrok or Vercel URL) | Uses the current origin |

LinkedIn, X and WhatsApp always use their official share links.

### Volunteer hours saved

The meter counts a piece only once the lead approves or sends it (`src/lib/hours.ts`). Manual time per piece:

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

A full kit saves about 8.3 hours. Add photo tagging, the share plan and a weekly digest, and it comes to more than 10 hours a week.

## Mocked for the demo

- X sign-in: a "Continue with X" button, plus a demo "sign in as" switcher.
- Follower counts are seeded.
- Posting goes through X and LinkedIn share intents. The poster confirms by pasting their post link, and replies, upvotes and reposts are self-reported with buttons like "Mark replied".
- Seeded photos are SVG scenes, so tagging is deterministic without a key.

## Licence

MIT, see [`LICENSE`](LICENSE).
