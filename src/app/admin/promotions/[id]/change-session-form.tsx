"use client";

import { useActionState } from "react";
import { createChangeSession, type ChangeSessionFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ChangeSessionFormState = {};

export function ChangeSessionForm({
  promotionId,
  defaultMaxChanges,
}: {
  promotionId: string;
  defaultMaxChanges: number;
}) {
  const action = createChangeSession.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div>
        <Label htmlFor="weekNumber">Semaine n°</Label>
        <Input id="weekNumber" name="weekNumber" type="number" min={1} required className="w-24" />
      </div>
      <div>
        <Label htmlFor="opensAt">Ouverture</Label>
        <Input id="opensAt" name="opensAt" type="datetime-local" required />
      </div>
      <div>
        <Label htmlFor="closesAt">Fermeture</Label>
        <Input id="closesAt" name="closesAt" type="datetime-local" required />
      </div>
      <div>
        <Label htmlFor="maxChangesPerParticipant">Changements max / participant</Label>
        <Input
          id="maxChangesPerParticipant"
          name="maxChangesPerParticipant"
          type="number"
          defaultValue={defaultMaxChanges}
          required
          className="w-24"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Création..." : "Créer la session"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
