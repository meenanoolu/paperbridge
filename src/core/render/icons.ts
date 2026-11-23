/**
 * Monochrome vector icons printed above column headers in Icon-Anchored print mode, for readers
 * with low literacy or memory loss. Shapes are defined in a 10 x 10 unit box (y down) as filled
 * paths only (no strokes), so the PDF (pdf-lib paths) and the SVG preview draw them identically.
 * No external assets, no fonts.
 */
import type { CardIcon } from "../types";

export type { CardIcon };

export const CARD_ICONS: readonly CardIcon[] = ["sun", "moon", "drop", "alert", "check"];

export interface IconShape {
  d: string;
  fill: "black" | "white";
}

const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** A circle as 4 cubic Beziers (every PDF and SVG path parser supports C). */
function circle(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return [
    `M${f(cx + r)} ${f(cy)}`,
    `C${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`,
    `C${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}`,
    `C${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}`,
    `C${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}`,
    "Z",
  ].join(" ");
}

const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")} Z`;

/** A thick ray from radius r0 to r1 at angle a, as a quadrilateral. */
function ray(a: number, r0: number, r1: number, half: number): string {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const px = -s * half;
  const py = c * half;
  return poly([
    [5 + c * r0 + px, 5 + s * r0 + py],
    [5 + c * r1 + px, 5 + s * r1 + py],
    [5 + c * r1 - px, 5 + s * r1 - py],
    [5 + c * r0 - px, 5 + s * r0 - py],
  ]);
}

export const ICON_SHAPES: Record<CardIcon, IconShape[]> = {
  // Morning: a disk with 8 rays.
  sun: [
    { d: circle(5, 5, 2.3), fill: "black" },
    ...Array.from({ length: 8 }, (_, i) => ({ d: ray((i * Math.PI) / 4, 3.15, 4.9, 0.48), fill: "black" as const })),
  ],
  // Night: a crescent (black disk with an offset white disk over it).
  moon: [
    { d: circle(4.6, 5.2, 4.2), fill: "black" },
    { d: circle(6.6, 3.7, 3.3), fill: "white" },
  ],
  // Water: a solid drop.
  drop: [
    {
      d: "M5 0.5 C6.7 2.8 8.5 4.9 8.5 6.6 C8.5 8.5 6.9 9.7 5 9.7 C3.1 9.7 1.5 8.5 1.5 6.6 C1.5 4.9 3.3 2.8 5 0.5 Z",
      fill: "black",
    },
  ],
  // Symptoms: a warning triangle with an exclamation mark.
  alert: [
    { d: poly([[5, 0.5], [9.8, 9.3], [0.2, 9.3]]), fill: "black" },
    { d: poly([[5, 2.9], [8.0, 8.2], [2.0, 8.2]]), fill: "white" },
    { d: poly([[4.5, 4.1], [5.5, 4.1], [5.3, 6.5], [4.7, 6.5]]), fill: "black" },
    { d: circle(5, 7.35, 0.5), fill: "black" },
  ],
  // Any other daily habit: a check mark in a ring.
  check: [
    { d: circle(5, 5, 4.7), fill: "black" },
    { d: circle(5, 5, 3.7), fill: "white" },
    { d: poly([[2.7, 5.2], [3.7, 4.2], [4.5, 5.0], [6.5, 3.0], [7.5, 4.0], [4.5, 7.0]]), fill: "black" },
  ],
};

/** Units per side of the icon box. */
export const ICON_UNITS = 10;
