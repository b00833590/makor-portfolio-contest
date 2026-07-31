"use client";

import { useActionState } from "react";
import { createChangeSession, type ChangeSessionFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { ChangeSessionFormFields } from "./change-session-form-fields";

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
    <form action={formAction} className="flex flex-wrap items-end gap-4 rounded-xl border border-border p-6">
      <ChangeSessionFormFields defaults={{ maxChangesPerParticipant: defaultMaxChanges }} />
      <Button type="submit" disabled={pending}>
        {pending ? "Création..." : "Créer la session"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
