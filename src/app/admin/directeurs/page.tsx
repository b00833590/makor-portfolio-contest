import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DirecteurForm } from "./directeur-form";
import { DirecteurRowActions } from "./directeur-row-actions";

export default async function DirecteursPage() {
  const directeurs = await db.user.findMany({
    where: { role: "DIRECTEUR" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <DirecteurForm />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Identifiant</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {directeurs.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-sm text-muted-foreground">
                Aucun compte Directeur pour le moment.
              </TableCell>
            </TableRow>
          )}
          {directeurs.map((directeur) => (
            <TableRow key={directeur.id}>
              <TableCell className="font-medium">{directeur.name}</TableCell>
              <TableCell>
                <DirecteurRowActions userId={directeur.id} name={directeur.name} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
