const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  cross: "M6 6l12 12M18 6L6 18",
  alert: "M12 3l10 18H2L12 3zm0 7v4m0 3.5v.5",
  question: "M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.2-1.5 2.4m0 3.5v.5",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  upload: "M12 16V4m0 0l-5 5m5-5l5 5M4 15v5h16v-5",
  printer: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7v-7z",
  sparkle: "M12 3v6m0 6v6M3 12h6m6 0h6",
  drop: "M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  pill: "M8.5 15.5l7-7m-9.9 9.9a4.95 4.95 0 0 1 0-7l5-5a4.95 4.95 0 1 1 7 7l-5 5a4.95 4.95 0 0 1-7 0z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zm0 16a2 2 0 0 1 2-2h13",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  calendar: "M4 6h16v14H4V6zm0 4h16M8 3v4m8-4v4",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6L7 7m10 10l1.4 1.4M5.6 18.4L7 17m10-10l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  speaker: "M4 9h4l5-4v14l-5-4H4V9zm12.5-.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  mute: "M4 9h4l5-4v14l-5-4H4V9zm12 0l5 6m0-6l-5 6",
  xray: "M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  gauge: "M4 18a8 8 0 1 1 16 0M12 18l4-6M7 13.5l1 .6M12 9v1.2m5 3.3l-1 .6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-6 w-6", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
