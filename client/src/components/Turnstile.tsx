import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface PublicConfig {
  captcha?: { enabled?: boolean; siteKey?: string | null; provider?: string };
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve) => {
    window.onTurnstileLoad = () => resolve();
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return scriptLoading;
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  action?: string;
}

/**
 * Cloudflare Turnstile widget. Auto-hides (and returns a null token immediately)
 * when the server reports captcha.enabled === false. When enabled, renders the
 * invisible-if-possible challenge and feeds tokens back via `onToken`.
 */
export function Turnstile({ onToken, theme = "auto", action }: TurnstileProps) {
  const { data } = useQuery<PublicConfig>({
    queryKey: ["/api/public/config"],
    staleTime: 5 * 60 * 1000,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const enabled = Boolean(data?.captcha?.enabled);
  const siteKey = data?.captcha?.siteKey ?? "";

  useEffect(() => {
    // Not enabled — tell the parent we "have" no token but shouldn't block.
    if (data && !enabled) {
      onToken(null);
    }
  }, [data, enabled, onToken]);

  useEffect(() => {
    if (!enabled || !siteKey || !containerRef.current) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        action,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(null),
        "expired-callback": () => onToken(null),
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, siteKey]);

  if (!enabled) return null;
  return (
    <div className="flex justify-center">
      <div ref={containerRef} data-testid="turnstile-widget" />
      {!ready && <div className="text-xs text-muted-foreground">Loading verification…</div>}
    </div>
  );
}

/**
 * Hook variant: returns { token, widget, reset }. When captcha is disabled,
 * token is the sentinel empty string "" (never null) so form submit handlers
 * can treat "truthy or disabled" uniformly.
 */
export function useTurnstile(action?: string) {
  const [token, setToken] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const widget = (
    <Turnstile
      action={action}
      onToken={(t) => {
        if (t === null) {
          // If null came from "disabled" config, mark disabled
          setDisabled(true);
        }
        setToken(t);
      }}
    />
  );
  return {
    token,
    disabled,
    ready: disabled || Boolean(token),
    widget,
    reset: () => setToken(null),
  };
}

export default Turnstile;
