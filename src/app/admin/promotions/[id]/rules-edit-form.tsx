"use client";

import { useActionState } from "react";
import { updatePromotionRulesText, type RulesTextFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: RulesTextFormState = {};

export function RulesEditForm({
  promotionId,
  rulesIntro,
  rulesCustomNotes,
}: {
  promotionId: string;
  rulesIntro: string;
  rulesCustomNotes: string;
}) {
  const action = updatePromotionRulesText.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="rulesIntro">Texte d&apos;introduction (optionnel)</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Affiché en haut du règlement. Laissez vide pour utiliser le texte par défaut généré automatiquement.
        </p>
        <Textarea id="rulesIntro" name="rulesIntro" rows={3} defaultValue={rulesIntro} />
      </div>
      <div>
        <Label htmlFor="rulesCustomNotes">Notes complémentaires (optionnel)</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Précisions, exceptions ou règles spécifiques à cette promotion — affichées en fin de règlement. Laissez
          vide pour ne rien afficher.
        </p>
        <Textarea id="rulesCustomNotes" name="rulesCustomNotes" rows={5} defaultValue={rulesCustomNotes} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
