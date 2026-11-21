import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "crew-app/ui/test/**/*.test.ts"],
    // The Crew host provides @kirocrew/app-sdk at runtime; tests use a recording double.
    alias: [
      { find: /^@kirocrew\/app-sdk(\/ui)?$/, replacement: fileURLToPath(new URL("./crew-app/ui/test/mock-sdk.ts", import.meta.url)) },
    ],
    testTimeout: 120_000,
  },
});
