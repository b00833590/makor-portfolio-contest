"use client";

import { useActionState, useMemo, useState } from "react";
import { addExistingParticipants, type AddParticipantsFormState } from "./participants-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Candidate {
  id: string;
  name: string;
  lastPromotionName: string | null;
}

const initialState: AddParticipantsFormState = {};

export function AddExistingParticipantsForm({
  promotionId,
  candidates,
}: {
  promotionId: string;
  candidates: Candidate[];
}) {
  const action = addExistingParticipants.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => candidate.name.toLowerCase().includes(q));
  }, [candidates, query]);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tous les participants existants sont déjà inscrits à cette promotion.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {candidates.length > 12 && (
        <Input
          type="search"
          placeholder="Filtrer par nom…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-xs"
        />
      )}

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {filtered.map((candidate) => (
          <label
            key={candidate.id}
            className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/50"
          >
            <input type="checkbox" name="userId" value={candidate.id} className="size-4 accent-primary" />
            <span className="font-medium">{candidate.name}</span>
            {candidate.lastPromotionName && (
              <span className="ml-auto text-xs text-muted-foreground">
                dernière : {candidate.lastPromotionName}
              </span>
            )}
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Aucun nom ne correspond.</p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inscription…" : "Inscrire les participants cochés"}
        </Button>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.results && state.results.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          {state.results.map((result) => (
            <li key={result.userId}>
              {result.status === "registered" && (
                <span className="text-gain">✓ {result.name} inscrit·e</span>
              )}
              {result.status === "already-registered" && (
                <span className="text-muted-foreground">• {result.name} était déjà inscrit·e</span>
              )}
              {result.status === "blocked-active-elsewhere" && (
                <span className="text-destructive">
                  ✕ {result.name} — déjà dans « {result.promotionName} » (promotion active)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
