import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import "./index.css";
import App from "./App";
import { normalizeLegacyHashUrl } from "@/lib/publicRoutes";

const normalizedUrl = normalizeLegacyHashUrl(window.location.href);
if (normalizedUrl) {
  window.history.replaceState(window.history.state, "", normalizedUrl);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <App />
    </Router>
  </StrictMode>
);
