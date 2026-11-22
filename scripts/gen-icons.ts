/** Rasterise public/icon.svg into the PWA PNG icons. Run: npx tsx scripts/gen-icons.ts */
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("public/icon.svg", "utf8");
const png = (src: string, size: number) => new Resvg(src, { fitTo: { mode: "width", value: size } }).render().asPng();

writeFileSync("public/pwa-192.png", png(svg, 192));
writeFileSync("public/pwa-512.png", png(svg, 512));
writeFileSync("public/apple-touch-icon.png", png(svg, 180));
// Maskable: full-bleed background with the artwork inside the 80% safe zone.
const maskable = svg.replace('rx="96" ', "").replace("<rect x=\"120\"", '<g transform="translate(51.2 51.2) scale(0.8)"><rect x="120"').replace("</svg>", "</g></svg>");
writeFileSync("public/pwa-maskable-512.png", png(maskable, 512));
console.log("icons written");
