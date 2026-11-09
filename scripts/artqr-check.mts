// Decode a QR image the way the artistic QR scan test does.
// Usage: npx tsx scripts/artqr-check.mts <image.png> [expected-url]
import fs from "fs";
import { decodeAll } from "../src/lib/qrscan";

const [file, expected] = process.argv.slice(2);
if (!file) { console.error("Usage: npx tsx scripts/artqr-check.mts <image.png> [expected-url]"); process.exit(2); }
const found = await decodeAll(fs.readFileSync(file));
if (!found.length) { console.log("No QR code found"); process.exit(1); }
for (const f of found) console.log(f);
if (expected) {
  const ok = found.includes(expected);
  console.log(ok ? "PASS: matches expected URL" : `FAIL: expected ${expected}`);
  process.exit(ok ? 0 : 1);
}
