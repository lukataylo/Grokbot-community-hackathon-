"use client";
// Pictures for the first guest screens. All decorative: the words beside them carry the meaning.
import { RAYS } from "../ui";

const BURST_D = RAYS.map(([x, y]) => `M100 100L${x} ${y}`).join("");
// A stable pseudo-random shade per tile, so server and browser draw the same picture.
const shade = (c: number, r: number) => 0.28 + ((((c + 3) * 73856093) ^ ((r + 7) * 19349663)) >>> 0) % 68 / 100;

/** What each choice does to you: Show me stands in the light, Cover me has tiles (or an outline) for a face. */
export function ChoiceArt({ kind }: { kind: "show" | "tiles" | "standin" }) {
  return (
    <svg viewBox="0 0 150 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {kind === "show" && <g transform="translate(75 54) scale(1.75) translate(-100 -100)">
        <path className="rr" d={BURST_D} /><path className="ry" d="M100 100L187.8 127.5" />
      </g>}
      <path d="M33 120c0-23 18-37 42-37s42 14 42 37z" fill="#0A0A0A" />
      {kind === "show" && <circle cx="75" cy="52" r="19" fill="#0A0A0A" />}
      {kind === "tiles" && Array.from({ length: 25 }, (_, k) => {
        const c = k % 5, r = Math.floor(k / 5);
        return <rect key={k} x={53 + c * 9} y={30 + r * 9} width="8" height="8" fill="#0A0A0A" opacity={shade(c, r)} />;
      })}
      {kind === "standin" && <circle cx="75" cy="52" r="18" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeDasharray="5 4" />}
    </svg>
  );
}

// Head and shoulders on a 10px grid: the way the room sees you before your photo.
const CELL = 10, X0 = 0, Y0 = 0;
const FIGURE: Array<{ c: number; r: number }> = [];
for (let r = 0; r < 18; r++) for (let c = 0; c < 16; c++) {
  const x = X0 + c * CELL + CELL / 2, y = Y0 + r * CELL + CELL / 2;
  const head = ((x - 80) / 31) ** 2 + ((y - 84) / 40) ** 2 <= 1;
  const neck = Math.abs(x - 80) <= 16 && y > 110 && y < 140;
  const body = ((x - 80) / 56) ** 2 + ((y - 200) / 68) ** 2 <= 1;
  if (head || neck || body) FIGURE.push({ c, r });
}

/** The selfie placeholder: you, in tiles, inside a viewfinder. The tiles shimmer; they race while the photo is checked. */
export function TileFace() {
  return (
    <svg viewBox="0 0 160 200" aria-hidden="true" focusable="false">
      {FIGURE.map(({ c, r }) => (
        <rect key={`${c}-${r}`} x={X0 + c * CELL + 0.75} y={Y0 + r * CELL + 0.75} width={CELL - 1.5} height={CELL - 1.5}
          style={{ "--o": shade(c, r), "--d": `${-(c * 0.13 + r * 0.19).toFixed(2)}s` } as React.CSSProperties} />
      ))}
      <path className="vf" d="M12 30V12h18M130 12h18v18M148 170v18h-18M30 188H12v-18" />
    </svg>
  );
}
