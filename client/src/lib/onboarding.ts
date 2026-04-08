const ONBOARDING_SESSION_KEY = "sc_onboarding_session_id";

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

function safeRemoveItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

export function getStoredOnboardingSessionId() {
  return safeGetItem(ONBOARDING_SESSION_KEY);
}

export function storeOnboardingSessionId(sessionId: string) {
  safeSetItem(ONBOARDING_SESSION_KEY, sessionId);
}

export function clearStoredOnboardingSessionId() {
  safeRemoveItem(ONBOARDING_SESSION_KEY);
}
