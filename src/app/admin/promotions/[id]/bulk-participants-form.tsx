"use client";

import { useActionState, useRef, useState } from "react";
import { createParticipantsBulk, type BulkParticipantsFormState } from "./participants-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialsResult } from "@/components/credentials-result";
import { XIcon } from "lucide-react";

const initialState: BulkParticipantsFormState = {};

export function BulkParticipantsForm({ promotionId }: { promotionId: string }) {
  const action = createParticipantsBulk.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [rowKeys, setRowKeys] = useState<number[]>([0, 1, 2]);
  const nextKeyRef = useRef(3);

  function addRow() {
    setRowKeys((prev) => [...prev, nextKeyRef.current++]);
  }

  function removeRow(key: number) {
    setRowKeys((prev) => prev.filter((existing) => existing !== key));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {rowKeys.map((key, index) => (
          <div key={key} className="flex items-end gap-2">
            <div className="flex-1">
              {index === 0 && <Label htmlFor={`name-${key}`}>Prénom Nom</Label>}
              <Input id={`name-${key}`} name="name" placeholder="Adam Dupont" />
            </div>
            <div className="flex-1">
              {index === 0 && <Label htmlFor={`email-${key}`}>Email (optionnel)</Label>}
              <Input id={`email-${key}`} name="email" type="email" placeholder="adam.dupont@makorgroup.com" />
            </div>
            {rowKeys.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Retirer cette ligne"
                onClick={() => removeRow(key)}
              >
                <XIcon />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          + Ajouter un participant
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer les comptes"}
        </Button>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.results && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {state.results.map((result) =>
            result.status === "created" ? (
              <CredentialsResult
                key={result.name}
                name={result.name}
                tempPassword={result.tempPassword}
                email={result.email}
              />
            ) : (
              <p key={result.name} className="text-sm text-destructive">
                « {result.name} » existe déjà — compte non créé.
              </p>
            ),
          )}
        </div>
      )}
    </form>
  );
}
