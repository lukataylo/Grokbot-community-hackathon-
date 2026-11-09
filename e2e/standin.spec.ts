import { test, expect } from "@playwright/test";
import path from "path";

// Spends real money (about $0.07 a photo, up to two tries), so only with STANDIN_E2E=1, and on one device.
test.skip(process.env.STANDIN_E2E !== "1", "set STANDIN_E2E=1 to run the paid AI stand-in test");

const H = { "x-e2e-secret": process.env.E2E_SECRET! };
type Row = { id: string; status: string; has_standins: boolean; render_rev: number; standin: string | null };

test("host switches on AI stand-ins, a covered guest is told, and covered faces come back as labelled stand-ins", async ({ browser, page }, info) => {
  test.skip(info.project.name !== "desktop", "one paid run is enough");
  test.setTimeout(420_000);
  const stamp = Date.now().toString(36);
  const rows = async (slug: string): Promise<Row[]> => (await (await page.request.post("/api/test/photos", { headers: H, data: { slug } })).json()).rows;

  const { link } = await (await page.request.post("/api/host/login", { headers: H, data: { email: `e2e+standin${stamp}@lumzel.test` } })).json();
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/host/);
  const date = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const ev = await (await page.request.post("/api/events", { data: { name: `Stand-in Night ${stamp}`, hostedBy: "Expedite", date, start: "19:00", end: "22:00" } })).json();
  await page.goto(`/host/e/${ev.id}`);
  const slug = (await page.locator("section[aria-label='Your event code'] p.small").first().innerText()).trim().split("/").pop()!;

  // Locked until sharing is unlocked, in the UI and in the API.
  const toggle = page.getByRole("checkbox", { name: "AI stand-ins" });
  await expect(toggle).toBeDisabled();
  await expect(page.getByText("Part of social sharing")).toBeVisible();
  expect((await page.request.patch(`/api/events/${ev.id}`, { data: { faceStyle: "standins" } })).status()).toBe(403);
  expect((await page.request.patch(`/api/events/${ev.id}`, { data: { faceStyle: "faces" } })).status()).toBe(400);

  await page.request.post("/api/test/unlock", { headers: H, data: { eventId: ev.id } });
  await page.reload();
  await expect(toggle).toBeEnabled();
  await toggle.check();
  await expect(page.getByText(/AI stand-ins on/)).toBeVisible();

  // A guest is told what Cover me means here, covers, and uploads a group photo (nobody in it said Show me).
  const ctx = await browser.newContext({ ...info.project.use });
  const g = await ctx.newPage();
  await g.goto(`/${slug}`);
  await g.getByLabel(/Your name/).fill("Maya Chen");
  await g.getByRole("button", { name: "Join" }).click();
  await expect(g.getByText("Your face is replaced by an AI stand-in")).toBeVisible();
  await g.getByRole("button", { name: /Cover me/ }).click();
  await g.getByRole("button", { name: "Continue" }).click();
  await g.getByRole("button", { name: "Skip for now" }).click();
  await g.getByRole("button", { name: "Email me instead" }).click();
  await g.getByRole("button", { name: "Skip, I'll check back" }).click();
  await g.locator("input[type=file][multiple]").setInputFiles(path.join(__dirname, "fixtures", "group.jpg"));
  await expect(g.getByText(/1 photo added/)).toBeVisible({ timeout: 90_000 });

  // Tiles go out first; the stand-in version follows as a new render, unless a privacy check rejects the model's answer.
  let photo: Row | undefined;
  await expect.poll(async () => { photo = (await rows(slug))[0]; return photo?.status; }, { timeout: 150_000, intervals: [2000] }).toBe("ready");
  await expect.poll(async () => { photo = (await rows(slug))[0]; return photo.has_standins || (!!photo.standin && photo.standin !== "started" && photo.standin !== "ok"); }, { timeout: 240_000, intervals: [3000] }).toBeTruthy();
  test.skip(!photo!.has_standins, `the model's answer was rejected (${photo!.standin}), so the photo correctly kept its tiles`);

  await g.reload();
  await g.getByRole("button", { name: "Photo" }).first().click();
  const viewer = g.getByRole("dialog", { name: "Photo" });
  await expect(viewer.getByText("Covered faces are AI stand-ins")).toBeVisible();
  await viewer.getByRole("button", { name: "Close" }).click();

  // Back to tiles: re-rendered without stand-ins, and the label goes.
  await page.reload();
  await page.getByRole("checkbox", { name: "AI stand-ins" }).uncheck();
  await expect.poll(async () => (await rows(slug))[0].has_standins, { timeout: 60_000, intervals: [1000] }).toBe(false);
  await g.reload();
  await g.getByRole("button", { name: "Photo" }).first().click();
  await expect(g.getByRole("dialog", { name: "Photo" }).getByText("Covered faces are AI stand-ins")).toHaveCount(0);
  await ctx.close();
});
