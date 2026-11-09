import { test, expect } from "@playwright/test";
import { decodeAll } from "../src/lib/qrscan";

// Spends real money (about $0.42 a run), so only with QR_ART_E2E=1, and on one device.
test.skip(process.env.QR_ART_E2E !== "1", "set QR_ART_E2E=1 to run the paid artistic QR test");

test("host turns the event QR into scan-tested art and uses it on the screen", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one paid run is enough");
  test.setTimeout(300_000);
  const H = { "x-e2e-secret": process.env.E2E_SECRET! };
  const stamp = Date.now().toString(36);

  const { link } = await (await page.request.post("/api/host/login", { headers: H, data: { email: `e2e+art${stamp}@lumzel.test` } })).json();
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/host/);
  const date = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const r = await page.request.post("/api/events", { data: { name: `Art Night ${stamp}`, hostedBy: "Expedite", venue: "A rooftop in Shoreditch", date, start: "19:00", end: "22:00",
    description: "A summer rooftop party for London founders, with lanterns and a DJ at sunset." } });
  expect(r.ok()).toBeTruthy();
  const ev = await r.json();

  await page.goto(`/host/e/${ev.id}`);
  const joinUrl = (await page.locator("section[aria-label='Your event code'] p.small").first().innerText()).trim();
  await page.getByRole("button", { name: "Make it artistic" }).click();
  await expect(page.getByText(/30 to 60 seconds/)).toBeVisible();
  const designs = page.getByRole("button", { name: /QR design/ });
  await expect(designs.first().or(page.getByText("None scanned reliably. Try again."))).toBeVisible({ timeout: 240_000 });
  test.skip(!(await designs.count()), "no candidate passed the scan test this run");

  await designs.first().click();
  await expect(page.getByRole("button", { name: "Use plain QR" })).toBeVisible();
  await page.goto(`/host/e/${ev.id}/screen`);
  const src = await page.locator("main img").getAttribute("src");
  expect(src).toMatch(new RegExp(`^/api/events/${ev.id}/qr-art/[0-9a-f-]{36}$`));
  // The chosen image is host-only, and scans to the join link.
  const res = await page.request.fetch(src!);
  expect(res.ok()).toBeTruthy();
  expect((await page.request.fetch(src!, { headers: { cookie: "" } })).status()).not.toBe(200);
  const found = await decodeAll(Buffer.from(await res.body()));
  expect(found.some((u) => u.replace(/^https?:\/\//, "") === joinUrl), `decoded ${found.join(", ")}`).toBeTruthy();
});
