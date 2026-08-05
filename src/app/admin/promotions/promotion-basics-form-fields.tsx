import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PromotionBasicsValues {
  name: string;
  startDate: string;
  endDate: string;
}

/** Nom + dates — les règles du concours se modifient depuis l'écran "Paramètres" dédié. */
export function PromotionBasicsFormFields({ idPrefix = "", defaults }: { idPrefix?: string; defaults: PromotionBasicsValues }) {
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <>
      <div className="col-span-2">
        <Label htmlFor={id("name")}>Nom de la promotion</Label>
        <Input id={id("name")} name="name" required placeholder="Promotion Été 2026" defaultValue={defaults.name} />
      </div>
      <div>
        <Label htmlFor={id("startDate")}>Date de début</Label>
        <Input id={id("startDate")} name="startDate" type="date" required defaultValue={defaults.startDate} />
      </div>
      <div>
        <Label htmlFor={id("endDate")}>Date de fin</Label>
        <Input id={id("endDate")} name="endDate" type="date" required defaultValue={defaults.endDate} />
      </div>
    </>
  );
}
