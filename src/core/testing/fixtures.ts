import { bubbleCenters, bubbleKey } from "../layout";
import type { CardLayout } from "../types";

/** A mid-sized card used by tests: 8x6 grid plus a 2x5 grid, similar in density to the real apps. */
export const TEST_LAYOUT: CardLayout = {
  id: "test-card",
  version: 1,
  title: "Test Card",
  subtitle: "Used by unit and property tests",
  page: "A4",
  fiducial: { sizeMm: 16, insetMm: 6 },
  groups: [
    {
      key: "grid",
      title: "Grid",
      rows: ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"],
      cols: ["c1", "c2", "c3", "c4", "c5", "c6"],
      originMm: [50, 75],
      pitchMm: [22, 22],
      radiusMm: 5,
    },
    {
      key: "scale",
      title: "Scale",
      rows: ["e1", "e2"],
      cols: ["1", "2", "3", "4", "5"],
      originMm: [50, 250],
      pitchMm: [22, 14],
      radiusMm: 4.5,
    },
  ],
};

export const TEST_LAYOUT_LETTER: CardLayout = { ...TEST_LAYOUT, id: "test-card-letter", page: "Letter" };

export const TEST_BUBBLE_KEYS: string[] = bubbleCenters(TEST_LAYOUT).map((b) => bubbleKey(b.group, b.row, b.col));
