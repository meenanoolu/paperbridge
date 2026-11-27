import type { CSSProperties } from "react";

/**
 * The Trick or Treat night: a cartoon scene drawn for Skeleton Home. Three trick-or-treaters walk
 * a path up a hill to a haunted house on a dark red night, and something nefarious waits in the
 * doorway. A neon "Trick or Treat" sign hangs at the gate, bats cross the moon, and a flashlight
 * follows the pointer.
 *
 * It is all original inline SVG plus CSS, so it works offline and adds no image requests. It is
 * decorative (`aria-hidden`); the real "Trick or Treat" control is `TrickOrTreatButton`. Every
 * animation sits behind `prefers-reduced-motion: no-preference`, so reduced motion shows the
 * still scene.
 */
export const TOT_CSS = `
.tot-sign-text { font-family: "Creepster", "Chiller", "Impact", fantasy; letter-spacing: 0.06em; }
.tot-btn { font-family: "Creepster", "Chiller", "Impact", fantasy; letter-spacing: 0.08em; }
.tot-flash { background: radial-gradient(circle 260px at var(--mx, 50%) var(--my, 60%), transparent 0, rgba(4, 2, 10, 0.12) 55%, rgba(4, 2, 10, 0.62) 100%); }
@media (prefers-reduced-motion: no-preference) {
  @keyframes tot-bat-a { from { transform: translate(-140px, 140px); } 50% { transform: translate(760px, -40px); } to { transform: translate(1640px, 120px); } }
  @keyframes tot-bat-b { from { transform: translate(1640px, 60px); } 50% { transform: translate(700px, 150px); } to { transform: translate(-140px, 10px); } }
  @keyframes tot-flap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.3); } }
  @keyframes tot-flicker { 0%, 100% { opacity: 1; } 8% { opacity: 0.55; } 12% { opacity: 1; } 52% { opacity: 0.8; } 56% { opacity: 1; } 78% { opacity: 0.65; } 82% { opacity: 1; } }
  @keyframes tot-neon { 0%, 100% { opacity: 1; } 3% { opacity: 0.3; } 6% { opacity: 1; } 47% { opacity: 1; } 49% { opacity: 0.4; } 51% { opacity: 1; } }
  @keyframes tot-peek { 0%, 50% { transform: translateY(14px) scale(0.96); } 60%, 86% { transform: translateY(0) scale(1.05); } 100% { transform: translateY(14px) scale(0.96); } }
  @keyframes tot-scare { 0%, 56% { transform: translateY(0); } 61% { transform: translateY(-20px); } 66% { transform: translateY(0); } 71% { transform: translateY(-9px); } 76%, 100% { transform: translateY(0); } }
  @keyframes tot-walk { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-5px) rotate(2deg); } }
  @keyframes tot-blink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.08); } }
  @keyframes tot-moon { from { transform: scale(1); opacity: 0.55; } to { transform: scale(1.06); opacity: 0.9; } }
  @keyframes tot-sway { from { transform: rotate(-1.4deg); } to { transform: rotate(1.4deg); } }
  @keyframes tot-glitch {
    0%, 92%, 100% { text-shadow: 2px 0 0 rgba(255, 255, 255, 0); translate: 0 0; clip-path: inset(0 0 0 0); }
    93% { text-shadow: -3px 0 0 #ef4444, 3px 0 0 #67e8f9; translate: 2px 0; clip-path: inset(10% 0 55% 0); }
    95% { text-shadow: 3px 0 0 #ef4444, -3px 0 0 #67e8f9; translate: -2px 0; clip-path: inset(55% 0 8% 0); }
    97% { text-shadow: -2px 0 0 #ef4444, 2px 0 0 #67e8f9; translate: 1px 0; clip-path: inset(0 0 0 0); }
  }
  .tot-bat-a { animation: tot-bat-a 19s linear infinite; }
  .tot-bat-b { animation: tot-bat-b 14s linear 3s infinite; }
  .tot-bat-c { animation: tot-bat-a 27s linear 8s infinite; }
  .tot-wings { transform-box: fill-box; transform-origin: 50% 100%; animation: tot-flap 0.42s ease-in-out infinite; }
  .tot-window { animation: tot-flicker 5s steps(1, end) infinite; animation-delay: var(--d, 0s); }
  .tot-neon { animation: tot-neon 6s steps(1, end) infinite; }
  .tot-creature { transform-box: fill-box; transform-origin: 50% 100%; animation: tot-peek 11s ease-in-out infinite; }
  .tot-kid { animation: tot-scare 11s ease-out infinite; animation-delay: var(--d, 0s); }
  .tot-kid-body { transform-box: fill-box; transform-origin: 50% 100%; animation: tot-walk 0.6s ease-in-out infinite alternate; animation-delay: var(--d, 0s); }
  .tot-eye { transform-box: fill-box; transform-origin: 50% 50%; animation: tot-blink 5.5s ease-in-out infinite; }
  .tot-moon-halo { transform-box: fill-box; transform-origin: 50% 50%; animation: tot-moon 4.5s ease-in-out infinite alternate; }
  .tot-lantern { transform-box: fill-box; transform-origin: 50% 0%; animation: tot-sway 3.2s ease-in-out infinite alternate; }
  .tot-btn:hover .tot-btn-text, .tot-btn:focus-visible .tot-btn-text { animation: tot-glitch 1.1s steps(1, end) infinite; display: inline-block; }
}
`;

/** One cartoon bat, centred on 0,0. The wings flap together; the body stays still. */
function Bat() {
  return (
    <g>
      <g className="tot-wings">
        <path d="M0 0C-8-14-26-16-42-4C-34-5-28 1-24 7C-18 2-9 3 0 9Z" fill="#05030a" />
        <path d="M0 0C8-14 26-16 42-4C34-5 28 1 24 7C18 2 9 3 0 9Z" fill="#05030a" />
      </g>
      <ellipse cx="0" cy="4" rx="5" ry="8" fill="#05030a" />
      <path d="M-4-3L-6-11L-1-5ZM4-3L6-11L1-5Z" fill="#05030a" />
      <circle cx="-2" cy="1" r="1.1" fill="#fde047" />
      <circle cx="2" cy="1" r="1.1" fill="#fde047" />
    </g>
  );
}

/** A trick-or-treater: a body in a costume, a bucket, and a bob while walking. */
function Kid({ x, d, kind }: { x: number; d: string; kind: "ghost" | "witch" | "pumpkin" }) {
  return (
    <g transform={`translate(${x} 40)`}>
      <g className="tot-kid" style={{ "--d": d } as CSSProperties}>
        <g className="tot-kid-body" style={{ "--d": d } as CSSProperties}>
          {kind === "ghost" && (
            <g>
              <path d="M-17 438V404C-17 388-9 378 0 378S17 388 17 404V438L11 432L5.5 438L0 432L-5.5 438L-11 432Z" fill="#f4efe6" />
              <ellipse cx="-6" cy="398" rx="3" ry="4.4" fill="#16081a" />
              <ellipse cx="6" cy="398" rx="3" ry="4.4" fill="#16081a" />
              <ellipse cx="0" cy="409" rx="2.6" ry="3.2" fill="#16081a" />
            </g>
          )}
          {kind === "witch" && (
            <g>
              <path d="M-14 438L-9 400H9L14 438Z" fill="#2a1346" />
              <circle cx="0" cy="392" r="9" fill="#a3d977" />
              <path d="M-16 387H16L4 358L-4 358Z" fill="#3b1c63" />
              <rect x="-16" y="385" width="32" height="4" rx="2" fill="#fb923c" />
              <circle cx="-3" cy="392" r="1.3" fill="#16081a" />
              <circle cx="3" cy="392" r="1.3" fill="#16081a" />
            </g>
          )}
          {kind === "pumpkin" && (
            <g>
              <path d="M-13 438L-9 404H9L13 438Z" fill="#7f1d1d" />
              <ellipse cx="0" cy="392" rx="15" ry="13" fill="#f97316" />
              <path d="M-1 379C-1 374 2 372 5 371" stroke="#4d7c0f" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M-8 388L-4 384L-1 389ZM8 388L4 384L1 389ZM-6 396L-3 399L0 396L3 399L6 396" fill="#16081a" stroke="#16081a" strokeWidth="1.2" strokeLinejoin="round" />
            </g>
          )}
          <rect x="-24" y="412" width="12" height="2.4" rx="1.2" fill="#e5e7eb" transform="rotate(-18 -18 413)" />
          <path d="M-30 418H-18L-20 430H-28Z" fill="#fb923c" />
          <ellipse cx="-24" cy="418" rx="6" ry="1.8" fill="#9a3412" />
        </g>
      </g>
    </g>
  );
}

/** A leaning gravestone, with a cross on top as an option. */
function Grave({ x, y, h = 46, cross = false }: { x: number; y: number; h?: number; cross?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M-14 0V${-h + 12}C-14 ${-h} 14 ${-h} 14 ${-h + 12}V0Z`} fill="#1a0d17" stroke="#3a1a2a" strokeWidth="2" />
      {cross && <path d={`M0 ${-h + 8}V${-h + 26}M-6 ${-h + 14}H6`} stroke="#4a2236" strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
}

/** A jack-o'-lantern with a lit face. */
function Jack({ x, y, s = 1, delay = "0s" }: { x: number; y: number; s?: number; delay?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="-16" rx="22" ry="17" fill="#ea580c" />
      <path d="M-8-32C-8-38-3-40 3-41" stroke="#4d7c0f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g className="tot-window" style={{ "--d": delay } as CSSProperties}>
        <path d="M-12-22L-6-28L-2-21ZM12-22L6-28L2-21ZM-11-10L-6-6L-2-10L2-6L6-10L11-6" fill="#fde047" stroke="#fde047" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** The scene. Place it as the first child of a `relative overflow-hidden` stage. */
export function TrickOrTreatScene() {
  const stars = [
    [90, 60], [210, 120], [340, 40], [470, 100], [610, 50], [760, 110], [840, 30], [1180, 70], [1290, 130], [1380, 50], [60, 190], [1330, 220],
  ];
  return (
    <div aria-hidden="true" data-scene="trick-or-treat" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[min(66vh,560px)]">
      <style>{TOT_CSS}</style>
      <svg viewBox="0 0 1440 520" preserveAspectRatio="xMaxYMax slice" className="h-full w-full" focusable="false">
        <defs>
          <linearGradient id="tot-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#450a0a" stopOpacity="0" />
            <stop offset="0.55" stopColor="#7f1d1d" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3b0a12" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="tot-moon" cx="0.38" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#fdba74" />
            <stop offset="0.6" stopColor="#f97316" />
            <stop offset="1" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id="tot-door" cx="0.5" cy="0.6" r="0.7">
            <stop offset="0" stopColor="#fde047" />
            <stop offset="1" stopColor="#ea580c" />
          </radialGradient>
          <filter id="tot-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1440" height="520" fill="url(#tot-sky)" />
        {stars.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#fecaca" opacity="0.7" />
        ))}

        {/* The moon with ringed halos. */}
        <circle className="tot-moon-halo" cx="1010" cy="170" r="190" fill="none" stroke="#fb923c" strokeOpacity="0.18" strokeWidth="26" />
        <circle className="tot-moon-halo" cx="1010" cy="170" r="150" fill="none" stroke="#fb923c" strokeOpacity="0.28" strokeWidth="18" />
        <circle cx="1010" cy="170" r="118" fill="url(#tot-moon)" />
        <circle cx="968" cy="140" r="14" fill="#c2410c" opacity="0.5" />
        <circle cx="1056" cy="204" r="20" fill="#c2410c" opacity="0.4" />
        <circle cx="1030" cy="116" r="8" fill="#c2410c" opacity="0.45" />

        {/* Clouds. */}
        <g fill="#2a0d18" opacity="0.8">
          <ellipse cx="640" cy="230" rx="170" ry="30" />
          <ellipse cx="740" cy="214" rx="110" ry="30" />
          <ellipse cx="1260" cy="250" rx="160" ry="28" />
          <ellipse cx="180" cy="260" rx="150" ry="26" />
        </g>

        {/* Hills and the path. */}
        <path d="M0 400C180 360 360 420 640 400S1080 350 1440 400V520H0Z" fill="#1d0a14" />
        <path d="M0 460C220 430 460 470 720 452S1160 420 1440 458V520H0Z" fill="#12060c" />
        <path d="M520 520C640 480 760 470 850 452S980 446 1010 440" fill="none" stroke="#3a1a26" strokeWidth="58" strokeLinecap="round" />
        <path d="M520 520C640 480 760 470 850 452S980 446 1010 440" fill="none" stroke="#5a2a36" strokeWidth="30" strokeLinecap="round" strokeDasharray="2 34" />

        {/* Graves. */}
        <Grave x={70} y={470} cross />
        <Grave x={130} y={482} h={36} />
        <Grave x={1240} y={452} h={52} cross />
        <Grave x={1330} y={466} h={40} />

        {/* The neon sign at the gate. */}
        <g transform="translate(250 0)">
          <path d="M-70 468V300M70 468V300" stroke="#24101a" strokeWidth="8" strokeLinecap="round" />
          <path d="M-70 310H70" stroke="#24101a" strokeWidth="6" strokeLinecap="round" />
          <g className="tot-neon" filter="url(#tot-glow)">
            <rect x="-150" y="226" width="300" height="84" rx="16" fill="#1a0a12" stroke="#fb923c" strokeWidth="4" />
            <text className="tot-sign-text" x="0" y="278" textAnchor="middle" fontSize="42" fill="#fdba74">
              Trick or Treat
            </text>
            <text className="tot-sign-text" x="0" y="302" textAnchor="middle" fontSize="16" fill="#fb923c" letterSpacing="3">
              if you dare
            </text>
          </g>
        </g>

        {/* The haunted house. */}
        <g>
          <path d="M860 440V232L900 196L940 232V440Z" fill="#0a0410" />
          <path d="M850 236L900 170L950 236Z" fill="#14091d" />
          <path d="M900 170V152" stroke="#0a0410" strokeWidth="4" />
          <path d="M930 440V282H1140V440Z" fill="#0c0612" />
          <path d="M916 290L1035 214L1154 290Z" fill="#14091d" />
          <path d="M1100 236V196L1118 196V248Z" fill="#0a0410" />
          <g className="tot-window" style={{ "--d": "0.4s" } as CSSProperties}>
            <rect x="887" y="262" width="26" height="38" rx="13" fill="#fde047" />
            <rect x="962" y="316" width="30" height="44" rx="4" fill="#fb923c" />
            <rect x="1078" y="316" width="30" height="44" rx="4" fill="#fde047" />
          </g>
          <g className="tot-window" style={{ "--d": "2.2s" } as CSSProperties}>
            <path d="M1022 254L1035 238L1048 254V274H1022Z" fill="#fde047" />
          </g>
          <path d="M1002 318H1066V440H1002Z" fill="url(#tot-door)" />
          <path d="M1002 318H1066V440" fill="none" stroke="#0a0410" strokeWidth="6" />
          {/* The nefarious creature in the doorway. */}
          <g className="tot-creature">
            <path d="M1013 440C1013 400 1018 372 1034 360C1050 372 1056 400 1056 440Z" fill="#05030a" />
            <ellipse cx="1034" cy="346" rx="19" ry="23" fill="#05030a" />
            <path d="M1016 336L1008 312L1024 328ZM1052 336L1060 312L1044 328Z" fill="#05030a" />
            <g className="tot-eye">
              <ellipse cx="1027" cy="341" rx="4.6" ry="6" fill="#a3e635" />
              <ellipse cx="1041" cy="341" rx="4.6" ry="6" fill="#a3e635" />
            </g>
            <path d="M1020 354Q1034 368 1048 354L1044 361L1040 354L1036 362L1032 354L1028 362L1024 355Z" fill="#f5f5f4" />
            <path d="M1016 376C1000 380 990 392 980 410M1052 376C1068 380 1078 392 1088 410" fill="none" stroke="#05030a" strokeWidth="5" strokeLinecap="round" />
            <path d="M980 410L974 420M980 410L984 421M1088 410L1082 421M1088 410L1094 420" stroke="#05030a" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          {/* A swaying lantern on the porch. */}
          <g className="tot-lantern">
            <path d="M1084 318V336" stroke="#05030a" strokeWidth="2" />
            <rect x="1076" y="336" width="16" height="22" rx="4" fill="#fb923c" filter="url(#tot-glow)" />
          </g>
        </g>

        {/* Jack-o'-lanterns on the porch steps and the lawn. */}
        <Jack x={1160} y={450} delay="1s" />
        <Jack x={940} y={456} s={0.8} delay="3s" />
        <Jack x={1350} y={480} s={1.2} delay="0.5s" />

        {/* The trick-or-treaters, walking up the path. */}
        <Kid x={640} d="0s" kind="ghost" />
        <Kid x={710} d="0.2s" kind="witch" />
        <Kid x={780} d="0.4s" kind="pumpkin" />

        {/* Bats. The outer group sets the resting spot (and size) for reduced motion. */}
        <g transform="translate(760 70) scale(1.1)">
          <g className="tot-bat-a"><Bat /></g>
        </g>
        <g transform="translate(300 150) scale(0.8)">
          <g className="tot-bat-b"><Bat /></g>
        </g>
        <g transform="translate(1180 60) scale(0.6)">
          <g className="tot-bat-c"><Bat /></g>
        </g>
      </svg>
    </div>
  );
}

/** The real, focusable control: an orange pill that takes you to the three worlds. */
export function TrickOrTreatButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Trick or Treat: jump to the three worlds"
      className="tot-btn inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-orange-400 px-8 py-3 text-2xl text-slate-950 shadow-[0_10px_36px_-8px_rgba(249,115,22,0.8)] transition-[filter] hover:brightness-110"
    >
      <span className="tot-btn-text">Trick or Treat</span>
    </button>
  );
}
