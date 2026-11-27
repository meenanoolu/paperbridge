/**
 * The Skeleton Home motion layer, applied on top of HOME_CSS. In the first 3 seconds: corner
 * markers snap in, the headline rises word by word, a lamp-coloured scan line sweeps the desk
 * and the three papers are dealt onto it. Afterwards the desk is lit by the pointer: a warm lamp,
 * a pencil grid that glows under the cursor, ghosts that drift against the mouse, a guide whose
 * eyes follow it, and papers that lean toward it. All of it is behind `no-preference`, so
 * reduced motion keeps HOME_CSS's calm rules (and the final state shows at once).
 */
export const HOME_MOTION_CSS = `
.home-scan { display: none; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes home-scan { from { translate: -6vw 0; opacity: 0; } 8% { opacity: 1; } 88% { opacity: 1; } to { translate: 106vw 0; opacity: 0; } }
  @keyframes home-glow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.18) drop-shadow(0 0 18px rgba(251, 191, 36, 0.8)); } }
  @keyframes guide-pop { from { opacity: 0.15; scale: 0.9; translate: -10px 0; } to { opacity: 1; scale: 1; translate: 0 0; } }
  .home-scan { display: block; position: absolute; top: 0; bottom: 0; left: 0; width: 3px; z-index: 20; pointer-events: none; opacity: 0; background: linear-gradient(to bottom, transparent, #fbbf24 12%, #fde68a 50%, #fbbf24 88%, transparent); box-shadow: 0 0 36px 10px rgba(251, 191, 36, 0.45); animation: home-scan 1.9s cubic-bezier(0.6, 0, 0.3, 1) 0.45s both; }
  .home-scan::before { content: ""; position: absolute; right: 3px; top: 0; bottom: 0; width: 32vw; background: linear-gradient(to right, transparent, rgba(251, 191, 36, 0.1)); }
  .home-cta { animation: home-glow 1.5s ease-in-out 2.2s 2 both; }
  .guide-pop { animation: guide-pop var(--spring-wobbly-ms) var(--spring-wobbly) both; }
  .home-parallax { translate: calc(var(--px, 0) * -22px) calc(var(--py, 0) * -12px); }
  .ghost-eyes { transform: translate(calc(var(--px, 0) * 2.8px), calc(var(--py, 0) * 2.2px)); }
  /* The papers are dealt when they scroll into view (data-seen), not while they are off screen. */
  .home-artifact.m-deal { animation-play-state: paused; }
  [data-seen="true"] .home-artifact.m-deal { animation-play-state: running; }
  .home-artifact { transition: transform var(--spring-snappy-ms, 400ms) var(--spring-snappy, ease-out); }
  .home-artifact[data-tilting="true"] { transition-duration: 120ms; transition-timing-function: ease-out; }
}
.home-lamp { background: radial-gradient(circle 460px at var(--mx, 50%) var(--my, 30%), rgba(251, 191, 36, 0.14), transparent 70%); mix-blend-mode: screen; }
.home-grid-glow { background-image: linear-gradient(rgba(251, 191, 36, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251, 191, 36, 0.3) 1px, transparent 1px); background-size: 44px 44px; -webkit-mask-image: radial-gradient(circle 230px at var(--mx, 50%) var(--my, 30%), #000, transparent); mask-image: radial-gradient(circle 230px at var(--mx, 50%) var(--my, 30%), #000, transparent); }
@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {
  .home-artifact { transform: perspective(1100px) rotate(var(--tilt, 0deg)) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); }
  .home-artifact:hover, .home-artifact:has(a:focus-visible) { transform: perspective(1100px) rotate(0deg) translateY(-10px) scale(1.02) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); }
}
`;

/** The headline, split so each word can spring in. The words are the same as ever. */
export const HEADLINE = [
  { t: "One" },
  { t: "Optical" },
  { t: "Engine." },
  { t: "Three", accent: true },
  { t: "Distinct", accent: true },
  { t: "Worlds.", accent: true },
] as const;
