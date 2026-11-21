import type { BubbleGroup, CardLayout, PageSize } from "./types";

export const PAGE_SIZE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

/** The card ID is printed as a strip of this many bubbles in the header. */
export const ID_BIT_COUNT = 10;
export const ID_BUBBLE_RADIUS_MM = 3;
export const ID_BUBBLE_PITCH_MM = 7;
/** Group key used for the ID strip in readings and tests. */
export const ID_GROUP_KEY = "_id";

/** Fiducial modules: 7x7 black square, 5x5 white square, 3x3 black square. */
export const FIDUCIAL_MODULES = 7;

export interface BubbleCenter {
  group: string;
  row: string;
  col: string;
  x: number;
  y: number;
  r: number;
}

export function bubbleKey(group: string, row: string, col: string): string {
  return `${group}/${row}/${col}`;
}

export function pageSizeMm(layout: CardLayout): { width: number; height: number } {
  return PAGE_SIZE_MM[layout.page];
}

/** Fiducial centres in card space, ordered TL, TR, BR, BL. */
export function fiducialCenters(layout: CardLayout): [number, number][] {
  const { width, height } = pageSizeMm(layout);
  const { sizeMm, insetMm } = layout.fiducial;
  const half = sizeMm / 2;
  const left = insetMm + half;
  const top = insetMm + half;
  const right = width - insetMm - half;
  const bottom = height - insetMm - half;
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
}

export function groupCenters(group: BubbleGroup): BubbleCenter[] {
  const out: BubbleCenter[] = [];
  group.rows.forEach((row, i) => {
    group.cols.forEach((col, j) => {
      out.push({
        group: group.key,
        row,
        col,
        x: group.originMm[0] + j * group.pitchMm[0],
        y: group.originMm[1] + i * group.pitchMm[1],
        r: group.radiusMm,
      });
    });
  });
  return out;
}

/** Every user-fillable bubble. Printer, synthetic renderer and decoder all read this. */
export function bubbleCenters(layout: CardLayout): BubbleCenter[] {
  return layout.groups.flatMap(groupCenters);
}

/** 10-bit FNV-1a style checksum of `id@version`. Printed in the header as bubbles. */
export function idCode(layout: CardLayout): number {
  const text = `${layout.id}@${layout.version}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h >>> 12) ^ h) & ((1 << ID_BIT_COUNT) - 1);
}

/** ID bits, most significant first. */
export function idBits(layout: CardLayout): boolean[] {
  const code = idCode(layout);
  const bits: boolean[] = [];
  for (let i = ID_BIT_COUNT - 1; i >= 0; i--) bits.push(((code >> i) & 1) === 1);
  return bits;
}

/** Centres of the ID strip bubbles, left to right, in the header's top-right. */
export function idBubbleCenters(layout: CardLayout): BubbleCenter[] {
  const { width } = pageSizeMm(layout);
  const { sizeMm, insetMm } = layout.fiducial;
  const rightEdge = width - insetMm - sizeMm - 4;
  const first = rightEdge - (ID_BIT_COUNT - 1) * ID_BUBBLE_PITCH_MM - ID_BUBBLE_RADIUS_MM;
  const y = insetMm + sizeMm / 2;
  return Array.from({ length: ID_BIT_COUNT }, (_, i) => ({
    group: ID_GROUP_KEY,
    row: "id",
    col: String(i),
    x: first + i * ID_BUBBLE_PITCH_MM,
    y,
    r: ID_BUBBLE_RADIUS_MM,
  }));
}

/** Returns a list of human-readable problems. Empty means the layout is printable and decodable. */
export function validateLayout(layout: CardLayout): string[] {
  const problems: string[] = [];
  const { width, height } = pageSizeMm(layout);
  const { sizeMm, insetMm } = layout.fiducial;
  const keys = new Set<string>();
  const fids = fiducialCenters(layout);
  const clear = sizeMm / 2 + 3; // keep bubbles out of the fiducial quiet zone

  for (const g of layout.groups) {
    if (keys.has(g.key)) problems.push(`duplicate group key "${g.key}"`);
    keys.add(g.key);
    if (g.key === ID_GROUP_KEY) problems.push(`group key "${ID_GROUP_KEY}" is reserved`);
    if (g.rows.length === 0 || g.cols.length === 0) problems.push(`group "${g.key}" is empty`);
    if (g.pitchMm[0] < 2.2 * g.radiusMm && g.cols.length > 1)
      problems.push(`group "${g.key}" columns are too close for its radius`);
    if (g.pitchMm[1] < 2.2 * g.radiusMm && g.rows.length > 1)
      problems.push(`group "${g.key}" rows are too close for its radius`);
  }

  for (const b of [...bubbleCenters(layout), ...idBubbleCenters(layout)]) {
    const label = `${b.group}/${b.row}/${b.col}`;
    if (b.x - b.r < insetMm || b.x + b.r > width - insetMm || b.y - b.r < insetMm || b.y + b.r > height - insetMm)
      problems.push(`bubble ${label} is outside the printable area`);
    for (const [fx, fy] of fids) {
      if (Math.abs(b.x - fx) < clear + b.r && Math.abs(b.y - fy) < clear + b.r)
        problems.push(`bubble ${label} overlaps a fiducial quiet zone`);
    }
  }
  return problems;
}
