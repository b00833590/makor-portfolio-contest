"use client";

import { useActionState } from "react";
import { createPromotion, type PromotionFormState } from "./actions";
import { defaultPromotionRules } from "@/lib/promotion-rules";
import { Button } from "@/components/ui/button";
import { PromotionFormFields } from "./promotion-form-fields";

const initialState: PromotionFormState = {};

export function PromotionForm() {
  const [state, formAction, pending] = useActionState(createPromotion, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 rounded-xl border border-border p-6 sm:grid-cols-2">
      <PromotionFormFields
        defaults={{
          initialCapital: 1_000_000,
          ...defaultPromotionRules,
        }}
      />
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
