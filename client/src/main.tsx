import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import "./index.css";
import App from "./App";
import { getClerkPublishableKey } from "@/lib/clerk";
import { normalizeLegacyHashUrl } from "@/lib/publicRoutes";

const normalizedUrl = normalizeLegacyHashUrl(window.location.href);
if (normalizedUrl) {
  window.history.replaceState(window.history.state, "", normalizedUrl);
}

const clerkPublishableKey = getClerkPublishableKey();
const clerkAfterSignOutUrl = `${window.location.origin}/#/login`;
const appTree = (
  <Router hook={useHashLocation}>
    <App />
  </Router>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl={clerkAfterSignOutUrl}>
        {appTree}
      </ClerkProvider>
    ) : (
      appTree
    )}
  </StrictMode>
);
