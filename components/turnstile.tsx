"use client";

import { useEffect, useRef } from "react";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile bot check. Renders nothing when no site key is set
 * (local development and CI), in which case Supabase Auth has CAPTCHA off too.
 * Bump `resetSignal` after a failed submit: each token works only once.
 */
export function Turnstile({
  siteKey,
  action,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string | undefined;
  action: string;
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);

  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !el.current) return;
    let cancelled = false;
    const node = el.current;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widget.current = window.turnstile.render(node, {
          sitekey: siteKey,
          action,
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetSignal && widget.current && window.turnstile) {
      window.turnstile.reset(widget.current);
      cb.current(null);
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div ref={el} className="min-h-[65px]" />;
}
