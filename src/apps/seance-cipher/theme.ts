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

/**
 * The Rite's fluid layer: a drifting obsidian aurora behind the stage, a lens of gold light that
 * follows the pointer across each pad, a soul and sparks on every banish, a bump on the numbers
 * and a shudder on a lost life. Springs come from the shared motion kit. Every animation is off
 * for reduced motion, and nothing flashes more than twice in a second.
 */
export const RITE_FLUID_CSS = `
.rite-lens { opacity: 0; }
[data-rune]:hover .rite-lens { opacity: 1; background: radial-gradient(circle 90px at var(--lx, 50%) var(--ly, 40%), rgba(243, 235, 211, 0.16), transparent 70%); }
.rite-soul, .rite-spark, .rite-hurt { display: none; }
.rite-aurora { display: none; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes rite-aurora-a { from { translate: -8% -4%; } to { translate: 10% 6%; } }
  @keyframes rite-aurora-b { from { translate: 8% 6%; } to { translate: -10% -6%; } }
  @keyframes rite-soul { from { opacity: 0.95; translate: 0 30%; scale: 0.7; } to { opacity: 0; translate: 0 -150%; scale: 1.15; } }
  @keyframes rite-spark { from { opacity: 1; translate: 0 0; scale: 1; } to { opacity: 0; translate: calc(cos(var(--a)) * 64px) calc(sin(var(--a)) * 64px); scale: 0.3; } }
  @keyframes rite-bump { from { scale: 1.45; } }
  @keyframes rite-shake { 0%, 100% { translate: 0 0; } 18% { translate: -5px 0; } 36% { translate: 5px 0; } 54% { translate: -3px 0; } 72% { translate: 2px 0; } }
  @keyframes rite-hurt { from { opacity: 0.9; } to { opacity: 0; } }
  .rite-aurora { display: block; }
  .rite-aurora::before, .rite-aurora::after { content: ""; position: absolute; width: 70%; height: 70%; border-radius: 9999px; filter: blur(60px); opacity: 0.55; }
  .rite-aurora::before { left: -10%; top: -20%; background: rgba(52, 211, 153, 0.16); animation: rite-aurora-a 22s ease-in-out infinite alternate; }
  .rite-aurora::after { right: -10%; bottom: -25%; background: rgba(212, 175, 55, 0.14); animation: rite-aurora-b 28s ease-in-out infinite alternate; }
  .rite-soul { display: block; animation: rite-soul 900ms ease-out both; }
  .rite-spark { display: block; animation: rite-spark 650ms ease-out both; }
  .rite-bump { display: inline-block; animation: rite-bump var(--spring-wobbly-ms) var(--spring-wobbly) both; }
  .rite-shake { animation: rite-shake 420ms ease-out both; }
  .rite-hurt { display: block; animation: rite-hurt 700ms ease-out both; }
}
@media (prefers-reduced-motion: reduce) { .rite-aurora::before, .rite-aurora::after, .rite-soul, .rite-spark, .rite-bump, .rite-shake, .rite-hurt { animation: none; } }
`;
