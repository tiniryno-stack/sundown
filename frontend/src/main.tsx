/* App entry. Mounts React, loads the theme, and registers the service worker
   (production only — in dev the SW would cache aggressively and fight HMR).
   Web Push is wired in push.ts and can be enabled from the app later. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerSW } from "./push";
import "./theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) {
  window.addEventListener("load", () => { void registerSW(); });
}
