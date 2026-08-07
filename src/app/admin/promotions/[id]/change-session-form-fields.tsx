import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ChangeSessionFieldValues {
  opensAt?: string;
  closesAt?: string;
  maxChangesPerParticipant: number;
}

/**
 * Champs partagés entre création et modification d'une session de changement.
 * Aucune notion de "semaine n°" : une fenêtre est identifiée par ses horaires
 * précis, pas par un numéro séquentiel (voir actions.ts, weekNumber est
 * auto-assigné en interne, uniquement pour le tri legacy). `isInitializationWindow`
 * masque le champ changements max (fixé par le système, illimité pendant la
 * fenêtre de constitution — voir rules-engine.ts) tout en le soumettant via un
 * champ caché.
 */
export function ChangeSessionFormFields({
  idPrefix = "",
  defaults,
  isInitializationWindow = false,
}: {
  idPrefix?: string;
  defaults: ChangeSessionFieldValues;
  isInitializationWindow?: boolean;
}) {
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <>
      <div>
        <Label htmlFor={id("opensAt")}>Ouverture</Label>
        <Input id={id("opensAt")} name="opensAt" type="datetime-local" required defaultValue={defaults.opensAt} />
      </div>
      <div>
        <Label htmlFor={id("closesAt")}>Fermeture</Label>
        <Input id={id("closesAt")} name="closesAt" type="datetime-local" required defaultValue={defaults.closesAt} />
      </div>
      {isInitializationWindow ? (
        <input type="hidden" name="maxChangesPerParticipant" value={defaults.maxChangesPerParticipant} />
      ) : (
        <div>
          <Label htmlFor={id("maxChangesPerParticipant")}>Changements max / participant</Label>
          <Input
            id={id("maxChangesPerParticipant")}
            name="maxChangesPerParticipant"
            type="number"
            required
            className="w-24"
            defaultValue={defaults.maxChangesPerParticipant}
          />
        </div>
      )}
    </>
  );
}
