export function getChatBasePath(isProfessional: boolean) {
  return isProfessional ? "/pro/chat" : "/chat";
}

export function buildConversationPath(isProfessional: boolean, conversationId?: string | null) {
  const basePath = getChatBasePath(isProfessional);
  if (!conversationId) return basePath;
  return `${basePath}/${encodeURIComponent(conversationId)}`;
}

export function getRouteSearchParam(pathname: string, search: string | undefined, key: string) {
  const browserSearchValue = new URLSearchParams((search ?? "").replace(/^\?/, "")).get(key);
  if (browserSearchValue) return browserSearchValue;

  const queryIndex = pathname.indexOf("?");
  if (queryIndex < 0) return null;

  return new URLSearchParams(pathname.slice(queryIndex + 1)).get(key);
}

export function extractConversationId(pathname: string, search?: string) {
  const pathMatch = pathname.match(/^\/(?:pro\/)?chat\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]);
  }

  return getRouteSearchParam(pathname, search, "conversationId") || "";
}
