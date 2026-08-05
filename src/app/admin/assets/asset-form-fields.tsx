import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AssetFormFieldsDefaults {
  symbol?: string;
  name?: string;
  type?: "STOCK" | "CRYPTO";
  sector?: string | null;
  currency?: string;
}

export interface AssetFormFieldsProps {
  idPrefix?: string;
  defaults?: AssetFormFieldsDefaults;
}

export function AssetFormFields({ idPrefix = "", defaults = {} }: AssetFormFieldsProps) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}symbol`}>Symbole</Label>
        <Input
          id={`${idPrefix}symbol`}
          name="symbol"
          required
          placeholder="AAPL"
          defaultValue={defaults.symbol}
          className="w-28 uppercase"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}name`}>Nom</Label>
        <Input id={`${idPrefix}name`} name="name" required placeholder="Apple Inc." defaultValue={defaults.name} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}type`}>Type</Label>
        <Select
          name="type"
          required
          defaultValue={defaults.type ?? "STOCK"}
          items={[
            { value: "STOCK", label: "Action" },
            { value: "CRYPTO", label: "Crypto" },
          ]}
        >
          <SelectTrigger id={`${idPrefix}type`} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STOCK">Action</SelectItem>
            <SelectItem value="CRYPTO">Crypto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}sector`}>Secteur</Label>
        <Input
          id={`${idPrefix}sector`}
          name="sector"
          placeholder="Technologie"
          defaultValue={defaults.sector ?? undefined}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}currency`}>Devise</Label>
        <Input
          id={`${idPrefix}currency`}
          name="currency"
          defaultValue={defaults.currency ?? "EUR"}
          className="w-20 uppercase"
        />
      </div>
    </>
  );
}
