import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** App chrome colour (Tailwind slate-950), used for the PWA theme and splash screen. */
export const THEME_COLOR = "#020617";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline-first: every built asset (app shell, lazy pdf-lib chunk, sample photos, icons)
    // is precached, so printing, scanning, samples, history and CSV export work with no network.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      // globPatterns below already covers public/ icons; don't list them twice.
      includeManifestIcons: false,
      manifest: {
        name: "PaperBridge",
        short_name: "PaperBridge",
        description: "Paper cards in, structured data out. Deterministic, offline optical scanning for care cards and quiz sheets.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#fafaf9",
        theme_color: THEME_COLOR,
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // The plugin adds manifest.webmanifest itself.
        globPatterns: ["**/*.{js,css,html,svg,png,jpg}"],
        // The app is a single page with hash routes; any navigation gets the cached shell.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "crew-app/ui/test/**/*.test.ts", "scripts/**/*.test.ts", "mcp/**/*.test.ts"],
    // The Crew host provides @kirocrew/app-sdk at runtime; tests use a recording double.
    alias: [
      { find: /^@kirocrew\/app-sdk(\/ui)?$/, replacement: fileURLToPath(new URL("./crew-app/ui/test/mock-sdk.ts", import.meta.url)) },
    ],
    testTimeout: 120_000,
  },
});
