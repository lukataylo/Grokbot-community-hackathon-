import sharp from "sharp";
const BURST = "M100 100L43.8 89.0M100 100L87.3 42.9M100 100L107.4 49.7M100 100L156.9 97.9M100 100L137.6 149.0M100 100L81.9 172.5M100 100L126.0 160.1M100 100L77.0 139.9M100 100L73.2 120.0M100 100L129.6 57.0";
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-200*pad} ${-200*pad} ${200*(1+2*pad)} ${200*(1+2*pad)}"><rect x="${-200*pad}" y="${-200*pad}" width="${200*(1+2*pad)}" height="${200*(1+2*pad)}" fill="#0A0A0A"/><path d="${BURST}" stroke="#F2F0EB" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M100 100L187.8 127.5" stroke="#FFB000" stroke-width="13" stroke-linecap="round" fill="none"/></svg>`;
for (const [n, s, pad] of [["192", 192, 0.2], ["512", 512, 0.2], ["maskable-512", 512, 0.42], ["apple-touch-icon", 180, 0.22], ["favicon-32", 32, 0.1]])
  await sharp(Buffer.from(svg(pad))).resize(s, s).png().toFile(`public/icons/${n}.png`);
console.log("icons ok");
