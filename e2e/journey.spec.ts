import { test, expect, type Page, type APIRequestContext, type BrowserContext } from "@playwright/test";
import path from "path";

const SECRET = process.env.E2E_SECRET!;
const fx = (f: string) => path.join(__dirname, "fixtures", f);
const H = { "x-e2e-secret": SECRET };

async function noSideScroll(page: Page, where: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}
async function hook(req: APIRequestContext, action: string, data: unknown) {
  const r = await req.post(`/api/test/${action}`, { headers: H, data });
  expect(r.ok(), `test hook ${action}`).toBeTruthy();
  return r.json();
}
async function blockExternal(ctx: BrowserContext) {
  await ctx.route(/linkedin\.com|x\.com|twitter\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>external</title>" }));
}

test("host sets up, guests join, photos are tiled and delivered, posts are shared and cheered", async ({ browser, page, request }, info) => {
  const device = info.project.use;
  const stamp = `${info.project.name}${Date.now().toString(36)}`;

  // ---- Host signs up with a magic link and creates an event through the wizard.
  const login = await request.post("/api/host/login", { headers: H, data: { email: `e2e+${stamp}@lumzel.test` } });
  const { link } = await login.json();
  expect(link).toContain("/api/host/verify");
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click(); // the link itself never signs in (mail scanners)
  await expect(page).toHaveURL(/\/host\/new/);
  await page.getByLabel("Name").fill(`E2E Night ${stamp}`);
  await page.getByLabel("Hosted by").fill("Expedite");
  await noSideScroll(page, "setup basics");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("What's happening").fill("A hack night for London builders. Theme: voice agents. Talk from Priya Shah on latency budgets.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Hashtag").fill("E2ENight");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next" }).click();
  await noSideScroll(page, "setup share kit");
  await page.getByRole("button", { name: "Create event, free" }).click();
  await expect(page).toHaveURL(/\/host\/e\/[0-9a-f-]{36}/);
  const eventId = page.url().match(/e\/([0-9a-f-]{36})/)![1];
  const joinUrl = (await page.locator("section[aria-label='Your event code'] p.small").innerText()).trim();
  const slug = joinUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Switch on social sharing" })).toBeVisible();
  await noSideScroll(page, "host dashboard");

  // ---- Guest 1 (this device) joins, says Show me, adds a selfie, chooses email, uploads a group photo.
  const g1ctx = await browser.newContext({ ...device });
  await blockExternal(g1ctx);
  const g1 = await g1ctx.newPage();
  await g1.goto(`/${slug}`);
  await expect(g1.getByRole("heading", { name: `E2E Night ${stamp}` })).toBeVisible();
  await noSideScroll(g1, "join");
  await g1.getByLabel(/Your name/).fill("Sam Okafor");
  await g1.getByRole("button", { name: "Join" }).click();
  await expect(g1.getByRole("heading", { name: "How should you appear tonight?" })).toBeVisible();
  await g1.getByRole("button", { name: /Show me/ }).click();
  await g1.getByRole("button", { name: "Continue" }).click();
  await expect(g1.getByRole("heading", { name: "One photo of you." })).toBeVisible();
  await g1.locator("input[type=file][capture]").setInputFiles(fx("selfie.jpg"));
  await expect(g1.getByRole("heading", { name: /Want your photos/ })).toBeVisible({ timeout: 60_000 });
  await noSideScroll(g1, "notify why");
  await g1.getByRole("button", { name: "Yes, set it up" }).click();
  // iPhone/iPad in a browser tab must install first; Android/desktop go straight to choosing.
  if (/iphone|ipad/.test(info.project.name)) {
    await expect(g1.getByRole("heading", { name: /add Lumzel to your Home Screen/ })).toBeVisible();
    await g1.getByRole("button", { name: "I've added it" }).click();
    await expect(g1.getByRole("heading", { name: /open Lumzel from your Home Screen/ })).toBeVisible();
    await g1.getByRole("button", { name: /email me instead/i }).click();
  } else {
    await expect(g1.getByRole("heading", { name: "What should we tell you about?" })).toBeVisible();
    await g1.getByRole("button", { name: "Email me instead" }).click();
  }
  await g1.getByLabel("Email").fill(`sam+${stamp}@lumzel.test`);
  await g1.getByRole("button", { name: "Email my photos" }).click();
  await expect(g1.getByRole("button", { name: /Add photos/ })).toBeVisible();
  await g1.locator("input[type=file][multiple]").setInputFiles([fx("group.jpg"), fx("bench.jpg")]);
  await expect(g1.getByText(/2 photos added/)).toBeVisible({ timeout: 90_000 });
  await noSideScroll(g1, "tonight");

  // ---- Privacy: wait for processing; Sam is visible, everyone else in the group shot is tiled.
  let rows: Array<{ status: string; tiled_count: number; regions: number; matched: string[] | null }> = [];
  await expect.poll(async () => { rows = (await hook(request, "photos", { slug })).rows; return rows.every((r) => r.status !== "processing") && rows.length === 2; }, { timeout: 150_000, intervals: [2000] }).toBeTruthy();
  const group = rows.find((r) => r.regions === 5) ?? rows.sort((a, b) => b.regions - a.regions)[0];
  expect(group.regions).toBeGreaterThanOrEqual(5);
  expect(group.matched?.length ?? 0).toBe(1);
  expect(group.tiled_count).toBe(group.regions - 1);
  const bench = rows.find((r) => r !== group)!;
  expect(bench.tiled_count).toBe(bench.regions); // nobody on the bench said yes

  // ---- Host: approve anything flagged, unlock sharing (Stripe is tested separately), deliver now.
  await page.reload();
  for (const btn of await page.getByRole("button", { name: "Looks right" }).all()) await btn.click();
  await hook(request, "unlock", { eventId });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Send it now" }).click();
  await expect(page.getByRole("heading", { name: "Everyone's been notified." })).toBeVisible({ timeout: 30_000 });

  // ---- Guest 1 sees their photos, opens the one they're in, writes a post and adds the link.
  await g1.reload();
  await expect(g1.getByRole("heading", { name: "You're in 1 photo." })).toBeVisible();
  await g1.getByRole("button", { name: "Photo you're in" }).first().click();
  await expect(g1.getByRole("dialog", { name: "Photo" })).toBeVisible();
  await g1.getByRole("dialog", { name: "Photo" }).getByRole("button", { name: "Post", exact: true }).click();
  await g1.getByLabel(/Your highlight/).fill("our team demoed a voice agent");
  await g1.getByRole("button", { name: "Write my post" }).click();
  const caption = g1.getByRole("textbox", { name: "Caption" });
  await expect(caption).toBeVisible({ timeout: 120_000 });
  const text = await caption.inputValue();
  expect(text).toContain("/s/");
  expect(text).not.toMatch(/thrilled|excited to share|humbled/i);
  await noSideScroll(g1, "share sheet");
  await g1.getByRole("button", { name: "Already posted? Add the link" }).click();
  await g1.getByLabel("Your post").fill(`https://www.linkedin.com/posts/sam-okafor_e2e-${stamp}-activity-7260000000000000000-abcd`);
  await g1.getByRole("button", { name: "Add link" }).click();
  await expect(g1.getByRole("heading", { name: "You're in the burst." })).toBeVisible();
  await g1.getByRole("button", { name: "Done" }).click();

  // ---- Smart link: preview tags and image for crawlers; a click counted only for a real browser.
  const share = await hook(request, "share", { slug });
  const html = await (await request.get(`/s/${share.code}`)).text();
  expect(html).toContain('property="og:image"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  const og = await request.get(`/s/${share.code}/og`);
  expect(og.headers()["content-type"]).toBe("image/jpeg");
  const visitor = await browser.newPage();
  await visitor.goto(`/s/${share.code}`);
  await expect(visitor.getByRole("heading", { name: /Sam Okafor was at/ })).toBeVisible();
  await expect.poll(async () => (await hook(request, "share", { slug })).clicks, { timeout: 10_000 }).toBe(1);
  await visitor.close();

  // ---- Guest 2 joins after delivery, finds the post, likes it on LinkedIn and confirms.
  const g2ctx = await browser.newContext({ ...device });
  await blockExternal(g2ctx);
  const g2 = await g2ctx.newPage();
  await g2.goto(`/${slug}`);
  await g2.getByLabel(/Your name/).fill("Maya Chen");
  await g2.getByRole("button", { name: "Join" }).click();
  await g2.getByRole("button", { name: /Cover me/ }).click();
  await g2.getByRole("button", { name: "Continue" }).click();
  await g2.getByRole("button", { name: "Skip for now" }).click();
  await g2.getByRole("button", { name: "Email me instead" }).click();
  await g2.getByRole("button", { name: "Skip, I'll check back" }).click();
  await g2.getByRole("button", { name: "Posts" }).click();
  await g2.getByRole("button", { name: "Everyone" }).click();
  const popup = g2.waitForEvent("popup");
  await g2.getByRole("button", { name: /^Like/ }).first().click();
  await (await popup).close();
  await g2.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await g2.getByRole("button", { name: "Yes, liked" }).click();
  await expect(g2.getByText("Liked", { exact: true })).toBeVisible();
  await noSideScroll(g2, "posts");

  // ---- Host sees the reach.
  await page.reload();
  await expect(page.getByText("Sam Okafor")).toBeVisible({ timeout: 20_000 });

  await g1ctx.close(); await g2ctx.close();
});

test("landing: register interest, and event creation is private beta", async ({ page, request }, info) => {
  const email = `e2e+lead-${info.project.name}${Date.now().toString(36)}@lumzel.test`;
  await page.goto("/");
  await page.getByRole("link", { name: "Get beta access" }).first().click();
  await page.locator("#i-email").fill(email);
  await page.locator("#i-name").fill("Hack Night London");
  await page.locator("#i-events").fill("Monthly meetups, about 120 people");
  await page.locator("#i-go").click();
  await expect(page.locator("#i-done")).toContainText("You're in.");
  await noSideScroll(page, "landing");
  expect(await hook(request, "interest", { email })).toMatchObject({ email, name: "Hack Night London" });

  // Signing up is the beta invite: that email can now get a sign-in link and host.
  const again = await request.post("/api/interest", { headers: H, data: { email } });
  expect(again.status()).toBe(201);
  expect((await again.json()).link).toContain("/api/host/verify");
  const ok = await request.post("/api/host/login", { headers: H, data: { email } });
  expect(ok.status()).toBe(200);

  // Someone who never signed up gets no sign-in link.
  const r = await request.post("/api/host/login", { headers: H, data: { email: `outsider${Date.now()}@example.com` } });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toMatch(/beta/);
});
