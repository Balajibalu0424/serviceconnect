import type { OnboardingRole } from "@shared/onboarding";

export const CUSTOMER_ONBOARDING_PATH = "/register/customer";
export const PROFESSIONAL_ONBOARDING_PATH = "/register/professional";
export const LEGACY_PRO_ONBOARDING_PATH = "/pro/onboarding";
export const RESET_PASSWORD_PATH = "/reset-password";

function normalizeSearch(search?: string) {
  if (!search) return new URLSearchParams();
  return new URLSearchParams(search.replace(/^\?/, ""));
}

function appendSearch(path: string, params: URLSearchParams) {
  const nextSearch = params.toString();
  return nextSearch ? `${path}?${nextSearch}` : path;
}

export function buildOnboardingPath(role: OnboardingRole, search?: string) {
  const params = normalizeSearch(search);
  params.delete("role");

  return appendSearch(
    role === "CUSTOMER" ? CUSTOMER_ONBOARDING_PATH : PROFESSIONAL_ONBOARDING_PATH,
    params,
  );
}

export function buildResetPasswordPath(token: string) {
  return `${RESET_PASSWORD_PATH}/${encodeURIComponent(token)}`;
}

export function extractResetToken(pathname: string, search?: string, hash?: string) {
  const pathMatch = pathname.match(/^\/reset-password\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  const searchToken = normalizeSearch(search).get("token");
  if (searchToken) return searchToken;

  const hashQueryIndex = hash?.indexOf("?") ?? -1;
  if (hash && hashQueryIndex >= 0) {
    const hashToken = new URLSearchParams(hash.slice(hashQueryIndex + 1)).get("token");
    if (hashToken) return hashToken;
  }

  return "";
}

export function normalizeLegacyHashUrl(href: string) {
  const url = new URL(href);
  if (!url.hash) return null;

  let hashPath = url.hash.slice(1) || "/";
  if (!hashPath.startsWith("/")) {
    hashPath = `/${hashPath}`;
  }

  const [rawHashPath, rawHashSearch] = hashPath.split("?");
  let changed = false;

  if (rawHashSearch) {
    const movedParams = new URLSearchParams(rawHashSearch);
    movedParams.forEach((value, key) => {
      if (url.searchParams.get(key) !== value) {
        url.searchParams.set(key, value);
        changed = true;
      }
    });
    hashPath = rawHashPath || "/";
    changed = true;
  } else {
    hashPath = rawHashPath || "/";
  }

  if (hashPath === "/register") {
    const role = url.searchParams.get("role");
    if (role === "CUSTOMER" || role === "PROFESSIONAL") {
      hashPath = role === "CUSTOMER" ? CUSTOMER_ONBOARDING_PATH : PROFESSIONAL_ONBOARDING_PATH;
      url.searchParams.delete("role");
      changed = true;
    }
  }

  if (hashPath === LEGACY_PRO_ONBOARDING_PATH) {
    hashPath = PROFESSIONAL_ONBOARDING_PATH;
    changed = true;
  }

  if (hashPath === RESET_PASSWORD_PATH) {
    const token = url.searchParams.get("token");
    if (token) {
      hashPath = buildResetPasswordPath(token);
      url.searchParams.delete("token");
      changed = true;
    }
  }

  const nextHash = `#${hashPath}`;
  if (url.hash !== nextHash) {
    url.hash = nextHash;
    changed = true;
  }

  return changed ? url.toString() : null;
}
