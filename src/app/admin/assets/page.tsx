import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssetForm } from "./asset-form";
import { toggleAssetActive } from "./actions";

const typeLabels = { STOCK: "Action", ETF: "ETF", CRYPTO: "Crypto" } as const;

export default async function AssetsPage() {
  const assets = await db.asset.findMany({ orderBy: { symbol: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <AssetForm />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbole</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Secteur</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="font-medium">{asset.symbol}</TableCell>
              <TableCell>{asset.name}</TableCell>
              <TableCell>{typeLabels[asset.type]}</TableCell>
              <TableCell>{asset.sector ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={asset.isActive ? "default" : "secondary"}>
                  {asset.isActive ? "Actif" : "Inactif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <form action={toggleAssetActive.bind(null, asset.id, !asset.isActive)}>
                  <Button type="submit" variant="outline" size="sm">
                    {asset.isActive ? "Désactiver" : "Activer"}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
          {assets.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                Aucun actif dans l&apos;univers d&apos;investissement.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
