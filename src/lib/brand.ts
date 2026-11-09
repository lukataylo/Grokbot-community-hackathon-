export const BURST = "M100 100L43.8 89.0M100 100L87.3 42.9M100 100L107.4 49.7M100 100L156.9 97.9M100 100L137.6 149.0M100 100L81.9 172.5M100 100L126.0 160.1M100 100L77.0 139.9M100 100L73.2 120.0M100 100L129.6 57.0";
export const YOU_RAY = "M100 100L187.8 127.5";
export const burstSvg = (size: number, ink = "#F2F0EB", bg = "#0A0A0A", pad = 0.18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-200 * pad} ${-200 * pad} ${200 * (1 + 2 * pad)} ${200 * (1 + 2 * pad)}"><rect x="${-200 * pad}" y="${-200 * pad}" width="${200 * (1 + 2 * pad)}" height="${200 * (1 + 2 * pad)}" fill="${bg}"/><path d="${BURST}" stroke="${ink}" stroke-width="6" fill="none"/><path d="${YOU_RAY}" stroke="#FFB000" stroke-width="8.5" fill="none"/></svg>`;
