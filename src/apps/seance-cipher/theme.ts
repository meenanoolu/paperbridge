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


/** X-Ray Rite colours. Each text colour is checked against its surface in the tests. */
export const RITE_COLORS = {
  obsidian: "#0B0D12",
  panel: "#151821",
  parchment: "#F3EBD3",
  gold: "#D4AF37",
  crimson: "#FF6B7A",
  emerald: "#34d399",
} as const;

/** The frozen X-Ray on the Game Over receipt: covered runes glow emerald, trembling ones crimson and dashed. */
export const RITE_PALETTE: XRayPalette = {
  lock: RITE_COLORS.gold,
  glow: true,
  styles: {
    filled: { ...XRAY_STYLE.filled, ring: RITE_COLORS.emerald, label: "#022c22" },
    unclear: { ...XRAY_STYLE.unclear, ring: RITE_COLORS.crimson, label: "#4c0519" },
    blank: { ...XRAY_STYLE.blank },
  },
};

/**
 * Animations for the game, scoped by class so no global stylesheet changes. The flicker has two
 * dips per 1.2 s (under 3 flashes a second) and every animation is off for reduced motion.
 */
export const RITE_CSS = `
@keyframes rite-pulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
@keyframes rite-flicker { 0%, 100% { opacity: 1; } 12% { opacity: .35; } 24% { opacity: 1; } 50% { opacity: .5; } 62% { opacity: 1; } }
@keyframes rite-burst { from { transform: scale(.6); opacity: 1; } to { transform: scale(1.9); opacity: 0; } }
.rite-pulse { animation: rite-pulse 1.1s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.rite-flicker { animation: rite-flicker 1.2s linear infinite; }
.rite-burst { animation: rite-burst .6s ease-out forwards; transform-box: fill-box; transform-origin: center; }
@keyframes rite-hold { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes rite-coach { from { transform: translateY(0); } to { transform: translateY(-3px); } }
.rite-hold { animation: rite-hold 250ms linear forwards; transform-origin: left center; }
.rite-coach { animation: rite-coach 1.8s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) { .rite-pulse, .rite-flicker, .rite-burst, .rite-hold, .rite-coach { animation: none; } }
`;
