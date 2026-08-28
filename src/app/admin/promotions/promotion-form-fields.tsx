import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PromotionFieldValues {
  name?: string;
  startDate?: string;
  endDate?: string;
  initialCapital: number;
  maxPositions: number;
  minPositionSize: number;
  maxPositionSize: number;
  maxCryptoPositions: number;
  changeSessionsPerWeek: number;
  maxChangesPerSession: number;
  freezeHoursBeforeEnd: number;
  initializationWindowHours: number;
}

/** Champs partagés entre création et modification d'une promotion. */
export function PromotionFormFields({ idPrefix = "", defaults }: { idPrefix?: string; defaults: PromotionFieldValues }) {
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <>
      <div className="col-span-2">
        <Label htmlFor={id("name")}>Nom de la promotion</Label>
        <Input id={id("name")} name="name" required placeholder="Promotion Été 2026" defaultValue={defaults.name} />
      </div>
      <div>
        <Label htmlFor={id("startDate")}>Début du concours (date et heure)</Label>
        <Input id={id("startDate")} name="startDate" type="datetime-local" required defaultValue={defaults.startDate} />
      </div>
      <div>
        <Label htmlFor={id("endDate")}>Fin du concours (date et heure)</Label>
        <Input id={id("endDate")} name="endDate" type="datetime-local" required defaultValue={defaults.endDate} />
      </div>
      <div>
        <Label htmlFor={id("initialCapital")}>Capital initial (€)</Label>
        <Input id={id("initialCapital")} name="initialCapital" type="number" required defaultValue={defaults.initialCapital} />
      </div>
      <div>
        <Label htmlFor={id("maxPositions")}>Nombre max de positions</Label>
        <Input id={id("maxPositions")} name="maxPositions" type="number" required defaultValue={defaults.maxPositions} />
      </div>
      <div>
        <Label htmlFor={id("minPositionSize")}>Taille min position (€)</Label>
        <Input id={id("minPositionSize")} name="minPositionSize" type="number" required defaultValue={defaults.minPositionSize} />
      </div>
      <div>
        <Label htmlFor={id("maxPositionSize")}>Taille max position (€)</Label>
        <Input id={id("maxPositionSize")} name="maxPositionSize" type="number" required defaultValue={defaults.maxPositionSize} />
      </div>
      <div>
        <Label htmlFor={id("maxCryptoPositions")}>Cryptomonnaies max / participant</Label>
        <Input
          id={id("maxCryptoPositions")}
          name="maxCryptoPositions"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaults.maxCryptoPositions}
        />
      </div>
      <div>
        <Label htmlFor={id("changeSessionsPerWeek")}>Sessions de changement / semaine</Label>
        <Input
          id={id("changeSessionsPerWeek")}
          name="changeSessionsPerWeek"
          type="number"
          required
          defaultValue={defaults.changeSessionsPerWeek}
        />
      </div>
      <div>
        <Label htmlFor={id("maxChangesPerSession")}>Changements max / session</Label>
        <Input
          id={id("maxChangesPerSession")}
          name="maxChangesPerSession"
          type="number"
          required
          defaultValue={defaults.maxChangesPerSession}
        />
      </div>
      <div>
        <Label htmlFor={id("freezeHoursBeforeEnd")}>Gel avant la fin (heures)</Label>
        <Input
          id={id("freezeHoursBeforeEnd")}
          name="freezeHoursBeforeEnd"
          type="number"
          required
          defaultValue={defaults.freezeHoursBeforeEnd}
        />
      </div>
      <div>
        <Label htmlFor={id("initializationWindowHours")}>Fenêtre de constitution (heures)</Label>
        <Input
          id={id("initializationWindowHours")}
          name="initializationWindowHours"
          type="number"
          min={0}
          step="any"
          required
          defaultValue={defaults.initializationWindowHours}
        />
      </div>
    </>
  );
}
