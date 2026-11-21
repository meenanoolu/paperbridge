import { pageSizeMm } from "../layout";
import type { CardLayout } from "../types";
import { cardPrimitives } from "./primitives";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** One-page printable SVG. Units are millimetres, so it prints at true size. */
export function renderCardSvg(layout: CardLayout): string {
  const { width, height } = pageSizeMm(layout);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" viewBox="0 0 ${n(width)} ${n(height)}" font-family="Arial, Helvetica, sans-serif">`,
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" fill="#fff"/>`,
  ];
  for (const p of cardPrimitives(layout)) {
    if (p.kind === "rect") {
      parts.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill === "black" ? "#000" : "#fff"}"/>`);
    } else if (p.kind === "circle") {
      const fill = p.fill ? "#000" : "#fff";
      const stroke = p.strokeMm ? ` stroke="#000" stroke-width="${n(p.strokeMm)}"` : "";
      parts.push(`<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${fill}"${stroke}/>`);
    } else {
      const anchor = p.anchor ?? "start";
      const weight = p.bold ? ' font-weight="bold"' : "";
      parts.push(`<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.sizeMm)}" text-anchor="${anchor}"${weight} fill="#000">${esc(p.text)}</text>`);
    }
  }
  parts.push("</svg>");
  return parts.join("\n");
}
