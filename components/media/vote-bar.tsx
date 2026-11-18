import { summarizeTally, type Tally } from "@/lib/services/tally";
import { VOTE_LABELS } from "@/lib/services/labels";

const SEGMENTS = [
  { key: "uses_ai", className: "bg-vote-ai" },
  { key: "unsure", className: "bg-vote-unsure" },
  { key: "no_ai", className: "bg-vote-no-ai" },
] as const;

/** Three-part bar: uses gen AI / not sure / no gen AI. */
export function VoteBar({ tally, size = "sm", showLegend = false }: { tally: Tally; size?: "sm" | "lg"; showLegend?: boolean }) {
  const s = summarizeTally(tally);
  const label =
    s.total === 0
      ? "No counted votes yet"
      : `${s.percent.uses_ai}% ${VOTE_LABELS.uses_ai}, ${s.percent.unsure}% ${VOTE_LABELS.unsure}, ${s.percent.no_ai}% ${VOTE_LABELS.no_ai}, from ${s.total} vote${s.total === 1 ? "" : "s"}`;
  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={label}
        className={`flex w-full overflow-hidden rounded-full bg-zinc-100 ${size === "lg" ? "h-4" : "h-2"}`}
      >
        {s.total > 0
          ? SEGMENTS.map(({ key, className }) =>
              s.percent[key] > 0 ? <span key={key} className={className} style={{ width: `${s.percent[key]}%` }} /> : null,
            )
          : null}
      </div>
      {showLegend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-700">
          {SEGMENTS.map(({ key, className }) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${className}`} />
              {VOTE_LABELS[key]} <span className="font-semibold">{tally[key]}</span>
              {s.total > 0 ? <span className="text-zinc-500">({s.percent[key]}%)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
