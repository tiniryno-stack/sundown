import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Player app. Talks to the backend GameService HTTP server (see ../API.md).
// The API base URL is configurable via VITE_API_BASE_URL (defaults to the
// local `npm run serve` server). In production set it to the deployed backend.
//
// PWA: we ship a hand-written manifest (public/manifest.webmanifest) and a
// minimal service worker (public/sw.js) that also handles Web Push. Both are
// static files copied verbatim from public/, registered in src/push.ts.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so phones can reach the dev server
    port: 5173,
    // Allow public tunnel hostnames (cloudflare/localtunnel/ngrok) to reach the
    // dev server for remote playtests. Fine for dev; not used by the prod build.
    allowedHosts: true,
  },
});
