import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Library build loaded by the Crew dashboard. React, lucide-react and the SDK come
// from the host's import map, so they must stay external.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/App.tsx",
      formats: ["es"],
      // Crew loads ui/dist/index.mjs; pin the extension (Vite emits .js for "type": "module" packages).
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "lucide-react", /^@kirocrew\/app-sdk/],
    },
    emptyOutDir: true,
  },
});
