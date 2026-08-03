import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "positive" && "text-gain",
          tone === "negative" && "text-loss",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function AllocationList({ slices, emptyLabel }: { slices: { key: string; valuePct: number }[]; emptyLabel: string }) {
  if (slices.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {slices.map((slice) => (
        <div key={slice.key} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-foreground">{slice.key}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${slice.valuePct}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {slice.valuePct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}
