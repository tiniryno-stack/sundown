/* Standalone entry for the landing page alone (showcase.html).
   Used to publish a shareable preview of the landing page without the rest of
   the app's routing. The deployed app still serves the same page at ?landing. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LandingApp } from "../screens/landing";
import "../theme.css";
import "./standalone.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <LandingApp />
  </StrictMode>,
);
