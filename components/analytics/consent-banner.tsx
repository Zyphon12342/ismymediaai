"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { CONSENT_EVENT, CONSENT_OPEN_EVENT, consentCookie, type ConsentChoice, type ConsentState } from "@/lib/analytics/consent";

function choose(choice: ConsentChoice) {
  document.cookie = consentCookie(choice, window.location.protocol === "https:");
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}

/** Asks before PostHog stores anything or records sessions. */
export function ConsentBanner({ initial }: { initial: ConsentState }) {
  const [open, setOpen] = useState(initial === "pending");
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, show);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, show);
  }, []);
  if (!open) return null;
  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-700">
          We use PostHog to see how the site is used and to replay sessions with all text and inputs hidden. It stores a
          cookie only if you allow it. <Link href="/privacy" className="underline">Privacy policy</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={() => { choose("denied"); setOpen(false); }}>
            Reject
          </Button>
          <Button type="button" onClick={() => { choose("granted"); setOpen(false); }}>
            Accept
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner so a choice can be changed. */
export function CookieSettingsButton() {
  return (
    <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
