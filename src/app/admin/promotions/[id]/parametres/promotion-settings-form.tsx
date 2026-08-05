"use client";

import { useActionState, useRef } from "react";
import { updatePromotionSettings, type PromotionSettingsFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PromotionRules } from "@/lib/promotion-rules";

const initialState: PromotionSettingsFormState = {};

export interface PromotionSettingsFormProps {
  promotionId: string;
  initialCapital: number;
  rules: PromotionRules;
  capitalLocked: boolean;
}

export function PromotionSettingsForm({ promotionId, initialCapital, rules, capitalLocked }: PromotionSettingsFormProps) {
  const action = updatePromotionSettings.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const confirmedInputRef = useRef<HTMLInputElement>(null);

  const hasWarnings = Boolean(state.warnings && state.warnings.length > 0);

  // Any edit invalidates a pending confirmation — a different value needs a fresh impact check.
  function handleFormInput() {
    if (confirmedInputRef.current) confirmedInputRef.current.value = "false";
  }

  // Arms the hidden field synchronously (before the native form submission reads it) when the
  // admin clicks the button while warnings from a previous submit are still shown.
  function handleSubmitClick() {
    if (hasWarnings && confirmedInputRef.current) confirmedInputRef.current.value = "true";
  }

  return (
    <form action={formAction} onInput={handleFormInput} className="flex flex-col gap-6">
      <input ref={confirmedInputRef} type="hidden" name="confirmed" defaultValue="false" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="initialCapital">Capital initial (€)</Label>
          <Input
            id="initialCapital"
            name="initialCapital"
            type="number"
            required
            defaultValue={initialCapital}
            disabled={capitalLocked}
          />
          {capitalLocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              Verrouillé — des transactions existent déjà, le concours a réellement commencé.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="maxCryptoPositions">Cryptomonnaies max / participant</Label>
          <Input
            id="maxCryptoPositions"
            name="maxCryptoPositions"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={rules.maxCryptoPositions}
          />
        </div>
        <div>
          <Label htmlFor="maxPositions">Nombre max de positions</Label>
          <Input id="maxPositions" name="maxPositions" type="number" required defaultValue={rules.maxPositions} />
        </div>
        <div>
          <Label htmlFor="minPositionSize">Taille min position (€)</Label>
          <Input id="minPositionSize" name="minPositionSize" type="number" required defaultValue={rules.minPositionSize} />
        </div>
        <div>
          <Label htmlFor="maxPositionSize">Taille max position (€)</Label>
          <Input id="maxPositionSize" name="maxPositionSize" type="number" required defaultValue={rules.maxPositionSize} />
        </div>
        <div>
          <Label htmlFor="changeSessionsPerWeek">Sessions de changement / semaine</Label>
          <Input
            id="changeSessionsPerWeek"
            name="changeSessionsPerWeek"
            type="number"
            required
            defaultValue={rules.changeSessionsPerWeek}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Indicatif (affiché dans le règlement) — les sessions elles-mêmes se créent depuis la page de la
            promotion.
          </p>
        </div>
        <div>
          <Label htmlFor="maxChangesPerSession">Changements max / session (nouvelles sessions)</Label>
          <Input
            id="maxChangesPerSession"
            name="maxChangesPerSession"
            type="number"
            required
            defaultValue={rules.maxChangesPerSession}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ne s&apos;applique qu&apos;aux sessions créées après ce changement — les sessions déjà créées gardent
            leur propre limite (modifiable individuellement depuis la page de la promotion).
          </p>
        </div>
        <div>
          <Label htmlFor="freezeHoursBeforeEnd">Gel avant la fin (heures)</Label>
          <Input
            id="freezeHoursBeforeEnd"
            name="freezeHoursBeforeEnd"
            type="number"
            required
            defaultValue={rules.freezeHoursBeforeEnd}
          />
        </div>
        <div>
          <Label htmlFor="initializationWindowHours">Fenêtre de constitution (heures, prochaine activation)</Label>
          <Input
            id="initializationWindowHours"
            name="initializationWindowHours"
            type="number"
            min={0}
            step="any"
            required
            defaultValue={rules.initializationWindowHours}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Ne s&apos;applique qu&apos;au prochain passage de la promotion en statut &laquo;&nbsp;En cours&nbsp;&raquo;
            — sans effet si la fenêtre d&apos;initialisation a déjà été ouverte.
          </p>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {hasWarnings && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Ce changement crée des incohérences avec l&apos;état actuel des portefeuilles :
          </p>
          <ul className="flex flex-col gap-2">
            {state.warnings!.map((warning) => (
              <li key={warning.field}>
                <p className="text-sm font-medium">{warning.summary}</p>
                {warning.details.map((detail) => (
                  <p key={detail} className="text-xs text-muted-foreground">
                    {detail}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Rien n&apos;est modifié automatiquement pour les participants déjà concernés — cliquez à nouveau pour
            appliquer quand même, ou ajustez les valeurs ci-dessus.
          </p>
        </div>
      )}

      {state.saved && <p className="text-sm text-primary">Paramètres enregistrés.</p>}

      <div>
        <Button type="submit" onClick={handleSubmitClick} disabled={pending} variant={hasWarnings ? "destructive" : "default"}>
          {pending ? "Enregistrement..." : hasWarnings ? "Confirmer et appliquer malgré les avertissements" : "Enregistrer les paramètres"}
        </Button>
      </div>
    </form>
  );
}
