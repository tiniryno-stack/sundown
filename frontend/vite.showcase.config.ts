import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the landing page alone (showcase.html) into dist-showcase/ with
// relative paths and everything inlined, so scripts/build-showcase.mjs can
// fold it into one self-contained HTML file for a shareable preview link.
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    outDir: "dist-showcase",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: { input: "showcase.html", output: { inlineDynamicImports: true } },
  },
});
