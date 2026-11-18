import type { ComponentProps, ReactNode } from "react";

/** Small shared form primitives. Plain Tailwind, no component library. */
export const inputClass =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 disabled:bg-zinc-100";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-400",
    secondary: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 disabled:text-zinc-400",
    ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-zinc-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-zinc-200 bg-zinc-50 text-zinc-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}
