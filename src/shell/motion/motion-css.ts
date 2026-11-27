/**
 * The shared motion language. Everything here is `transform`, `translate`, `scale`, `rotate`,
 * `opacity` or `clip-path` (compositor friendly) and every animation sits behind
 * `prefers-reduced-motion: no-preference`, so reduced motion shows the final state at once.
 * Keyframes name only their `from` state, so an element lands on whatever translate, scale or
 * rotate it already has (a stamp keeps its tilt). Springs come from `--spring-*` (see spring.ts). Stagger with `style={{ "--i": n }}`.
 */
export const MOTION_CSS = `
/* ---- Page transition: the next world opens like an iris from where you pressed. ---- */
@keyframes vt-iris { from { clip-path: circle(0px at var(--vt-x, 50%) var(--vt-y, 50%)); } to { clip-path: circle(var(--vt-r, 150vmax) at var(--vt-x, 50%) var(--vt-y, 50%)); } }
@keyframes vt-recede { from { transform: scale(1); filter: brightness(1); } to { transform: scale(0.95); filter: brightness(0.5); } }
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) { animation: vt-recede var(--spring-soft-ms, 700ms) var(--spring-soft, ease-out) both; }
  ::view-transition-new(root) { animation: vt-iris var(--spring-soft-ms, 700ms) var(--spring-soft, ease-out) both; }
}

/* ---- Entrances ---- */
@keyframes m-rise { from { opacity: 0; translate: 0 26px; } }
@keyframes m-pop { from { opacity: 0; scale: 0.55; } }
@keyframes m-slam { from { opacity: 0; scale: 2.1; rotate: -9deg; } }
@keyframes m-word { from { opacity: 0; translate: 0 0.7em; rotate: 5deg; } }
@keyframes m-deal { from { opacity: 0; translate: 0 90px; scale: 0.86; rotate: 7deg; } }
@keyframes m-sweep { from { scale: 0 1; } }
@keyframes m-focus { from { outline-offset: 10px; } to { outline-offset: 3px; } }
@keyframes m-hop { 0% { translate: 0 0; scale: 1 1; } 30% { translate: 0 -14px; scale: 0.94 1.08; } 60% { translate: 0 2px; scale: 1.08 0.92; } 100% { translate: 0 0; scale: 1 1; } }

@media (prefers-reduced-motion: no-preference) {
  .m-rise { animation: m-rise var(--spring-soft-ms) var(--spring-soft) both; animation-delay: calc(var(--i, 0) * 80ms + var(--d, 0ms)); }
  .m-pop { animation: m-pop var(--spring-wobbly-ms) var(--spring-wobbly) both; animation-delay: calc(var(--i, 0) * 90ms + var(--d, 0ms)); }
  .m-slam { animation: m-slam var(--spring-slam-ms) var(--spring-slam) both; animation-delay: calc(var(--i, 0) * 110ms + var(--d, 0ms)); }
  .m-word { display: inline-block; animation: m-word var(--spring-wobbly-ms) var(--spring-wobbly) both; animation-delay: calc(var(--i, 0) * 75ms + var(--d, 0ms)); }
  .m-deal { animation: m-deal var(--spring-slam-ms) var(--spring-slam) both; animation-delay: calc(var(--i, 0) * 170ms + var(--d, 0ms)); }
  .m-sweep { transform-origin: left center; animation: m-sweep var(--spring-soft-ms) var(--spring-soft) both; animation-delay: calc(var(--i, 0) * 120ms + var(--d, 0ms)); }
  .m-hop { animation: m-hop 520ms var(--spring-snappy, ease-out) both; }
  /* The keyboard ring springs in from a little further out. It stays 4 px wide. */
  :where(a, button, summary, input, select, textarea, [role="tab"], [tabindex]):focus-visible:not([class*="animate"]):not([class*="rite-"]):not([data-rune]) { animation: m-focus var(--spring-snappy-ms, 400ms) var(--spring-snappy, ease-out) both; }
}

/* ---- Scanning: the X-Ray locks onto the 4 corners, then every bubble rings in. ---- */
@media (prefers-reduced-motion: no-preference) {
  @keyframes xray-lock { from { opacity: 0; scale: 2.2; } }
  @keyframes xray-ring { from { opacity: 0; scale: 0.3; } }
  .xray-lock { transform-box: fill-box; transform-origin: center; animation: xray-lock var(--spring-slam-ms) var(--spring-slam) both; animation-delay: calc(var(--i, 0) * 110ms); }
  .xray-ring { transform-box: fill-box; transform-origin: center; animation: xray-ring var(--spring-wobbly-ms) var(--spring-wobbly) both; animation-delay: calc(420ms + var(--i, 0) * 30ms); }
}

/* ---- Launcher: one yellow pill that glides to the open app. ---- */
.nav-pill { position: absolute; left: 0; top: 0; z-index: 0; pointer-events: none; border-radius: 9999px; background: #fde047; opacity: 0; transform: translate(var(--x, 0px), var(--y, 0px)) scale(0.6); width: var(--w, 0px); height: var(--h, 0px); }
[data-pill="on"] .nav-pill { opacity: 1; transform: translate(var(--x, 0px), var(--y, 0px)) scale(1); }
@media (prefers-reduced-motion: no-preference) {
  [data-pill-ready] .nav-pill { transition: transform var(--spring-snappy-ms) var(--spring-snappy), width var(--spring-snappy-ms) var(--spring-snappy), height var(--spring-snappy-ms) var(--spring-snappy), opacity 200ms ease-out; }
}

/* ---- Pointer-lit surfaces ---- */
.lit-layer { opacity: 0; pointer-events: none; position: absolute; inset: 0; }
@media (prefers-reduced-motion: no-preference) { .lit-layer { transition: opacity 600ms ease-out; } }
[data-lit="true"] .lit-layer { opacity: 1; }
.tilt-glare { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; mix-blend-mode: soft-light; background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,0.7), transparent 55%); }
@media (prefers-reduced-motion: no-preference) { .tilt-glare { transition: opacity 250ms ease-out; } }
[data-tilting="true"] > .tilt-glare { opacity: 0.85; }

@media (prefers-reduced-motion: reduce) {
  .m-rise, .m-pop, .m-slam, .m-word, .m-deal, .m-sweep, .m-hop { animation: none; }
}
`;
