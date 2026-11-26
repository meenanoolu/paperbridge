/**
 * The 12 spooky runes as monochrome vector pictures in a 10 x 10 unit box (y down), like the
 * core's column icons: filled paths only, so the PDF (pdf-lib paths) and the SVG preview draw
 * them identically. "black" shapes are ink; "white" shapes are cut-outs drawn over the ink.
 * Nothing here touches the decoder: the pictures are printed outside the bubbles.
 */
export interface GlyphShape {
  d: string;
  fill: "black" | "white";
}

export const GLYPH_UNITS = 10;

type Pt = [number, number];

const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** A closed polygon. */
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;

/** An ellipse as 4 cubic Beziers (every PDF and SVG path parser supports C). */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const kx = 0.5523 * rx;
  const ky = 0.5523 * ry;
  return [
    `M${f(cx + rx)} ${f(cy)}`,
    `C${f(cx + rx)} ${f(cy + ky)} ${f(cx + kx)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}`,
    `C${f(cx - kx)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ky)} ${f(cx - rx)} ${f(cy)}`,
    `C${f(cx - rx)} ${f(cy - ky)} ${f(cx - kx)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}`,
    `C${f(cx + kx)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ky)} ${f(cx + rx)} ${f(cy)}`,
    "Z",
  ].join(" ");
}

const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
const rect = (x0: number, y0: number, x1: number, y1: number) =>
  poly([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [10 - x, y]);
const rotate = ([x, y]: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const dx = x - 5;
  const dy = y - 5;
  return [5 + dx * Math.cos(a) - dy * Math.sin(a), 5 + dx * Math.sin(a) + dy * Math.cos(a)];
};

/** A thick line through `pts`: one quad per segment plus a disc at every joint. */
function stroke(pts: Pt[], half: number): string {
  const parts: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * half;
    const ny = ((x1 - x0) / len) * half;
    parts.push(
      poly([
        [x0 + nx, y0 + ny],
        [x1 + nx, y1 + ny],
        [x1 - nx, y1 - ny],
        [x0 - nx, y0 - ny],
      ]),
    );
  }
  for (const [x, y] of pts) parts.push(circle(x, y, half));
  return parts.join(" ");
}

/** An n-pointed star with outer radius R and inner radius r, one point straight up. */
function star(cx: number, cy: number, R: number, r: number, n = 5): string {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return poly(pts);
}

const black = (d: string): GlyphShape => ({ d, fill: "black" });
const white = (d: string): GlyphShape => ({ d, fill: "white" });

// Bat wing (right side); the left wing is its mirror image.
const WING: Pt[] = [
  [5.6, 3.9],
  [7.2, 2.3],
  [9.8, 2.4],
  [9.3, 4.0],
  [9.5, 6.2],
  [8.1, 5.3],
  [7.2, 7.0],
  [6.3, 5.5],
  [5.6, 6.0],
];

// Spider legs (left side); the right legs are mirror images.
const LEGS: Pt[][] = [
  [
    [4.3, 4.3],
    [2.3, 2.2],
    [0.8, 3.6],
  ],
  [
    [4.0, 5.0],
    [1.7, 4.4],
    [0.6, 6.0],
  ],
  [
    [4.0, 5.9],
    [1.7, 6.6],
    [0.8, 8.6],
  ],
  [
    [4.4, 6.9],
    [3.0, 8.2],
    [2.4, 9.6],
  ],
];

// Bone: a shaft and four knobs, turned 40 degrees.
const TURN = -40;
const BONE_SHAFT: Pt[] = [
  [2.4, 4.1],
  [7.6, 4.1],
  [7.6, 5.9],
  [2.4, 5.9],
].map((p) => rotate(p as Pt, TURN));
const BONE_KNOBS: Pt[] = ([
  [2.3, 3.6],
  [2.3, 6.4],
  [7.7, 3.6],
  [7.7, 6.4],
] as Pt[]).map((p) => rotate(p, TURN));

/** Glyph shapes by rune index (0 Skull ... 11 Star), matching `RITE_RUNE_NAMES`. */
export const RUNE_GLYPHS: GlyphShape[][] = [
  // 1. Skull: cranium, jaw, eye sockets, nose and tooth gaps.
  [
    black(ellipse(5, 4.4, 3.8, 3.5)),
    black(rect(3.2, 6.9, 6.8, 9.3)),
    white(circle(3.65, 4.6, 1.05)),
    white(circle(6.35, 4.6, 1.05)),
    white(poly([[5, 5.7], [4.5, 6.6], [5.5, 6.6]])),
    white(rect(4.27, 7.7, 4.43, 9.3)),
    white(rect(4.92, 7.7, 5.08, 9.3)),
    white(rect(5.57, 7.7, 5.73, 9.3)),
  ],
  // 2. Bat: two scalloped wings, a body, a head and two ears.
  [
    black(poly(WING)),
    black(poly(mirror(WING))),
    black(ellipse(5, 5.3, 0.95, 1.9)),
    black(circle(5, 3.6, 0.95)),
    black(poly([[4.2, 3.0], [4.1, 1.5], [4.85, 2.7]])),
    black(poly([[5.8, 3.0], [5.9, 1.5], [5.15, 2.7]])),
  ],
  // 3. Ghost: a dome, a ragged hem, two eyes and an open mouth.
  [
    black(poly([[1.8, 9.4], [1.8, 4.8], [2.2, 3.0], [3.3, 1.6], [5, 0.9], [6.7, 1.6], [7.8, 3.0], [8.2, 4.8], [8.2, 9.4], [7.1, 8.4], [6, 9.4], [5, 8.4], [4, 9.4], [2.9, 8.4]])),
    white(ellipse(3.9, 4.1, 0.75, 0.95)),
    white(ellipse(6.1, 4.1, 0.75, 0.95)),
    white(ellipse(5, 6.2, 0.6, 0.8)),
  ],
  // 4. Pumpkin: a wide body, a stem and a carved face.
  [
    black(ellipse(5, 6, 4.3, 3.3)),
    black(rect(4.4, 1.0, 5.8, 3.0)),
    white(poly([[2.9, 5.5], [4.3, 5.5], [3.6, 4.2]])),
    white(poly([[5.7, 5.5], [7.1, 5.5], [6.4, 4.2]])),
    white(poly([[5, 5.7], [4.6, 6.4], [5.4, 6.4]])),
    white(poly([[3, 7.1], [4, 7.8], [5, 7.1], [6, 7.8], [7, 7.1], [6.5, 8.3], [5, 8.7], [3.5, 8.3]])),
  ],
  // 5. Eye: an almond, a white iris and a black pupil.
  [
    black("M0.7 5 C2.2 2 7.8 2 9.3 5 C7.8 8 2.2 8 0.7 5 Z"),
    white(circle(5, 5, 2.1)),
    black(circle(5, 5, 1.05)),
  ],
  // 6. Moon: a crescent (a black disc with a white disc over it).
  [black(circle(4.6, 5.2, 4.2)), white(circle(6.6, 3.7, 3.3))],
  // 7. Candle: flame, wick, wax, a highlight and a dish.
  [
    black("M5 0.4 C5.9 1.5 6.5 2.3 6.5 3.1 C6.5 3.9 5.8 4.4 5 4.4 C4.2 4.4 3.5 3.9 3.5 3.1 C3.5 2.3 4.1 1.5 5 0.4 Z"),
    black(rect(4.88, 4.3, 5.12, 5.1)),
    black(rect(3.4, 5.0, 6.6, 9.0)),
    white(rect(4.1, 5.8, 4.5, 8.2)),
    black(rect(2.2, 9.0, 7.8, 9.8)),
  ],
  // 8. Cross: a Latin cross.
  [black(poly([[4.1, 0.6], [5.9, 0.6], [5.9, 2.8], [8.2, 2.8], [8.2, 4.6], [5.9, 4.6], [5.9, 9.4], [4.1, 9.4], [4.1, 4.6], [1.8, 4.6], [1.8, 2.8], [4.1, 2.8]]))],
  // 9. Spider: a body, a head and 8 jointed legs.
  [
    black(circle(5, 6.2, 1.9)),
    black(circle(5, 3.9, 1.1)),
    ...LEGS.map((leg) => black(stroke(leg, 0.2))),
    ...LEGS.map((leg) => black(stroke(mirror(leg), 0.2))),
  ],
  // 10. Bone: a shaft with a knob pair at each end.
  [black(poly(BONE_SHAFT)), ...BONE_KNOBS.map(([x, y]) => black(circle(x, y, 1.35)))],
  // 11. Coffin: six sides with a white cross.
  [
    black(poly([[3.9, 0.6], [6.1, 0.6], [7.6, 3.3], [6.3, 9.4], [3.7, 9.4], [2.4, 3.3]])),
    white(rect(4.65, 2.2, 5.35, 6.8)),
    white(rect(3.9, 3.5, 6.1, 4.2)),
  ],
  // 12. Star: five points.
  [black(star(5, 5.4, 4.7, 1.9))],
];
