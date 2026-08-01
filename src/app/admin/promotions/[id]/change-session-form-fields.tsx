import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ChangeSessionFieldValues {
  weekNumber?: number;
  opensAt?: string;
  closesAt?: string;
  maxChangesPerParticipant: number;
}

/**
 * Champs partagés entre création et modification d'une session de changement.
 * `isInitializationWindow` masque semaine n° et changements max (fixés par le
 * système, non pertinents pour la fenêtre de constitution — voir rules-engine.ts)
 * tout en les soumettant tels quels via des champs cachés.
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
      {isInitializationWindow ? (
        <input type="hidden" name="weekNumber" value={defaults.weekNumber ?? 0} />
      ) : (
        <div>
          <Label htmlFor={id("weekNumber")}>Semaine n°</Label>
          <Input
            id={id("weekNumber")}
            name="weekNumber"
            type="number"
            min={1}
            required
            className="w-24"
            defaultValue={defaults.weekNumber}
          />
        </div>
      )}
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
