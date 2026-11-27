import { MOTION_CSS } from "./motion-css";
import { springCss } from "./spring";

/** Publishes the spring easings and the shared motion classes. Rendered once, by the app shell. */
export function MotionStyle() {
  return <style data-motion="shared">{`${springCss()}\n${MOTION_CSS}`}</style>;
}
