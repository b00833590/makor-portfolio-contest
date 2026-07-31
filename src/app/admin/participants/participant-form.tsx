"use client";

import { useActionState } from "react";
import { createParticipant, type ParticipantFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialsResult } from "@/components/credentials-result";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ParticipantFormState = {};

interface PromotionOption {
  id: string;
  name: string;
}

export function ParticipantForm({ promotions }: { promotions: PromotionOption[] }) {
  const [state, formAction, pending] = useActionState(createParticipant, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="name">Identifiant (Prénom Nom)</Label>
          <Input id="name" name="name" required placeholder="Adam Dupont" />
        </div>
        <div>
          <Label htmlFor="email">Email (optionnel)</Label>
          <Input id="email" name="email" type="email" placeholder="adam.dupont@makorgroup.com" />
        </div>
        <div>
          <Label htmlFor="promotionId">Promotion</Label>
          <Select
            name="promotionId"
            required
            items={promotions.map((promotion) => ({ value: promotion.id, label: promotion.name }))}
          >
            <SelectTrigger id="promotionId" className="w-56">
              <SelectValue placeholder="Choisir une promotion" />
            </SelectTrigger>
            <SelectContent>
              {promotions.map((promotion) => (
                <SelectItem key={promotion.id} value={promotion.id}>
                  {promotion.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Ajout..." : "Ajouter le participant"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.created && (
        <CredentialsResult name={state.created.name} tempPassword={state.created.tempPassword} email={state.created.email} />
      )}
    </form>
  );
}
