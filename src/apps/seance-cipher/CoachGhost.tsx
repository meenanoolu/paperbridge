import type { CoachMood } from "./riteCoach";

/**
 * The little ghost that coaches the player. One body, six faces, so its mood matches what it is
 * saying: hello (idle), cheer (banished), worry (trembling), scold (too slow, or no paper),
 * gloat (game over) and sleepy (paused). Decorative: the words beside it carry the meaning.
 */
const BODY = "M6 70V32C6 15 17 4 32 4s26 11 26 28v38l-6.5-6.5L45 70l-6.5-6.5L32 70l-6.5-6.5L19 70l-6.5-6.5z";
const INK = "#090C14";

function Face({ mood }: { mood: CoachMood }) {
  const eye = { fill: INK };
  switch (mood) {
    case "cheer":
      return (
        <>
          <path d="M16 33q7-9 14 0M34 33q7-9 14 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M20 42q12 14 24 0z" fill={INK} />
        </>
      );
    case "worry":
      return (
        <>
          <ellipse cx="23" cy="30" rx="5.4" ry="7.4" {...eye} />
          <ellipse cx="41" cy="30" rx="5.4" ry="7.4" {...eye} />
          <path d="M21 49q3-5 5.5 0t5.5 0 5.5 0 5.5 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "scold":
      return (
        <>
          <ellipse cx="23" cy="32" rx="4.4" ry="5.2" {...eye} />
          <ellipse cx="41" cy="32" rx="4.4" ry="5.2" {...eye} />
          <path d="M15 22l16 5M49 22l-16 5" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M24 49h16" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      );
    case "gloat":
      return (
        <>
          <path d="M16 32h14M34 32h14" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M20 42q14 12 26-3" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M16 33q7 6 14 0M34 33q7 6 14 0" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="32" cy="47" rx="3.2" ry="2.6" {...eye} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx="23" cy="30" rx="4.4" ry="6" {...eye} />
          <ellipse cx="41" cy="30" rx="4.4" ry="6" {...eye} />
          <path d="M23 43c3 6 15 6 18 0" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          <ellipse cx="15" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.85" />
          <ellipse cx="49" cy="40" rx="4" ry="2.6" fill="#f9a8d4" opacity="0.85" />
        </>
      );
  }
}

export function CoachGhost({ mood, className = "h-11 w-11" }: { mood: CoachMood; className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={`rite-coach ${className}`} data-mood={mood} aria-hidden="true" focusable="false">
      <path d={BODY} fill="#F3EBD3" />
      <Face mood={mood} />
    </svg>
  );
}
