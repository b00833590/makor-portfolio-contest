import Link from "next/link";
import { Trophy } from "lucide-react";

export function ContestEndedBanner() {
  return (
    <Link
      href="/resultats"
      className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
    >
      <Trophy className="size-5 shrink-0 text-primary" />
      <span className="flex-1">
        <span className="font-medium text-foreground">Le concours est terminé.</span>{" "}
        <span className="text-muted-foreground">Le classement final est publié — consultez les résultats.</span>
      </span>
      <span className="shrink-0 font-medium text-primary">Résultats →</span>
    </Link>
  );
}
