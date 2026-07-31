import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ChangeSessionFieldValues {
  weekNumber?: number;
  opensAt?: string;
  closesAt?: string;
  maxChangesPerParticipant: number;
}

/** Champs partagés entre création et modification d'une session de changement. */
export function ChangeSessionFormFields({
  idPrefix = "",
  defaults,
}: {
  idPrefix?: string;
  defaults: ChangeSessionFieldValues;
}) {
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <>
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
      <div>
        <Label htmlFor={id("opensAt")}>Ouverture</Label>
        <Input id={id("opensAt")} name="opensAt" type="datetime-local" required defaultValue={defaults.opensAt} />
      </div>
      <div>
        <Label htmlFor={id("closesAt")}>Fermeture</Label>
        <Input id={id("closesAt")} name="closesAt" type="datetime-local" required defaultValue={defaults.closesAt} />
      </div>
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
    </>
  );
}
