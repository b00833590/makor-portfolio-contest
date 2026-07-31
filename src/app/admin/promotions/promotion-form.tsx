"use client";

import { useActionState } from "react";
import { createPromotion, type PromotionFormState } from "./actions";
import { defaultPromotionRules } from "@/lib/promotion-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PromotionFormState = {};

export function PromotionForm() {
  const [state, formAction, pending] = useActionState(createPromotion, initialState);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="col-span-2">
        <Label htmlFor="name">Nom de la promotion</Label>
        <Input id="name" name="name" required placeholder="Promotion Été 2026" />
      </div>
      <div>
        <Label htmlFor="startDate">Date de début</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="endDate">Date de fin</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="initialCapital">Capital initial (€)</Label>
        <Input
          id="initialCapital"
          name="initialCapital"
          type="number"
          defaultValue={1_000_000}
          required
        />
      </div>
      <div>
        <Label htmlFor="maxPositions">Nombre max de positions</Label>
        <Input
          id="maxPositions"
          name="maxPositions"
          type="number"
          defaultValue={defaultPromotionRules.maxPositions}
          required
        />
      </div>
      <div>
        <Label htmlFor="minPositionSize">Taille min position (€)</Label>
        <Input
          id="minPositionSize"
          name="minPositionSize"
          type="number"
          defaultValue={defaultPromotionRules.minPositionSize}
          required
        />
      </div>
      <div>
        <Label htmlFor="maxPositionSize">Taille max position (€)</Label>
        <Input
          id="maxPositionSize"
          name="maxPositionSize"
          type="number"
          defaultValue={defaultPromotionRules.maxPositionSize}
          required
        />
      </div>
      <div>
        <Label htmlFor="maxCryptoAllocationPct">Plafond crypto (%)</Label>
        <Input
          id="maxCryptoAllocationPct"
          name="maxCryptoAllocationPct"
          type="number"
          defaultValue={defaultPromotionRules.maxCryptoAllocationPct}
          required
        />
      </div>
      <div>
        <Label htmlFor="changeSessionsPerWeek">Sessions de changement / semaine</Label>
        <Input
          id="changeSessionsPerWeek"
          name="changeSessionsPerWeek"
          type="number"
          defaultValue={defaultPromotionRules.changeSessionsPerWeek}
          required
        />
      </div>
      <div>
        <Label htmlFor="maxChangesPerSession">Changements max / session</Label>
        <Input
          id="maxChangesPerSession"
          name="maxChangesPerSession"
          type="number"
          defaultValue={defaultPromotionRules.maxChangesPerSession}
          required
        />
      </div>
      <div>
        <Label htmlFor="freezeHoursBeforeEnd">Gel avant la fin (heures)</Label>
        <Input
          id="freezeHoursBeforeEnd"
          name="freezeHoursBeforeEnd"
          type="number"
          defaultValue={defaultPromotionRules.freezeHoursBeforeEnd}
          required
        />
      </div>
      {state.error && (
        <p className="col-span-2 text-sm text-destructive">{state.error}</p>
      )}
      <div className="col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer la promotion"}
        </Button>
      </div>
    </form>
  );
}
