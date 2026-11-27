import { RITE_RUNE_NAMES } from "./layout";
import { announceEvents, type RiteEvent } from "./riteEngine";

/**
 * The ghosts' voice. The engine's own sentences (`announceEvents`) stay plain and exact; this
 * wraps them with a joke when a Trembling Hand starts, because that is when a player most needs
 * to be told, kindly, what to do: press down firmly on the rune. Pure, so it is unit tested.
 */
export const TREMBLE_LINES: ((rune: string) => string)[] = [
  (n) => `Your hand is shaking! Press down firmly on the ${n} to break the curse!`,
  (n) => `The ${n} giggles at your wobbly hand. Press down firmly and hold!`,
  (n) => `Spooky shakes! The ${n} is only half covered. Press down on all of it!`,
  (n) => `Boo! A trembling hand. Hold the ${n} steady and the curse breaks.`,
  (n) => `The ghosts are tickling your fingers. Press firmly on the ${n}, all the way!`,
];

/** Said (and shown) the whole time a target trembles. The numbers are the engine's rules. */
export const TREMBLE_HINT = "Trembling hand! The ghosts slow the clock by 40%, but your combo stays locked until the rune is fully covered.";

/** The same rune and wave always get the same joke, so a replay reads the same. */
export const trembleLine = (rune: number, wave: number): string => TREMBLE_LINES[(rune + wave) % TREMBLE_LINES.length](RITE_RUNE_NAMES[rune]);

/** The status line for a tick: ghostly while a tremble starts, plain otherwise. Null when nothing happened. */
export function ghostlyStatus(events: readonly RiteEvent[], wave: number): string | null {
  const shake = events.find((e) => e.type === "tremble");
  if (!shake || shake.type !== "tremble") return announceEvents(events);
  const rest = announceEvents(events.filter((e) => e.type !== "tremble"));
  return [trembleLine(shake.rune, wave), rest].filter(Boolean).join(" ");
}
