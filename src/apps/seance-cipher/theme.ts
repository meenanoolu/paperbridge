import { XRAY_STYLE, type XRayPalette } from "../../shell/xray";

/** Glowing emerald and amber runes on obsidian. */
export const RUNE_PALETTE: XRayPalette = {
  lock: "#34d399",
  glow: true,
  styles: {
    filled: { ...XRAY_STYLE.filled, ring: "#34d399", label: "#022c22" },
    unclear: { ...XRAY_STYLE.unclear, ring: "#fbbf24", label: "#451a03" },
    blank: { ...XRAY_STYLE.blank, ring: "#94a3b8", label: "#0f172a" },
  },
};

