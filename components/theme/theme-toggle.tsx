"use client";

import { useState } from "react";
import { THEME_CHOICES, themeCookie, type ThemeChoice } from "@/lib/theme";

const LABEL: Record<ThemeChoice, string> = { system: "Auto", light: "Light", dark: "Dark" };

function apply(choice: ThemeChoice) {
  document.cookie = themeCookie(choice, window.location.protocol === "https:");
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

/** Footer switch: Auto (follow the device), Light or Dark. Remembered in a cookie. */
export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState(initial);
  function pick(next: ThemeChoice) {
    setChoice(next);
    apply(next);
  }
  return (
    <div role="group" aria-label="Colour theme" className="inline-flex rounded-md border border-zinc-300 p-0.5">
      {THEME_CHOICES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={choice === c}
          onClick={() => pick(c)}
          className={`rounded px-2 py-0.5 text-xs ${choice === c ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
        >
          {LABEL[c]}
        </button>
      ))}
    </div>
  );
}
