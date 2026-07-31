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
import { ParticipantForm } from "./participant-form";
import { removeParticipant } from "./actions";

export default async function ParticipantsPage() {
  const [promotions, users] = await Promise.all([
    db.promotion.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "PARTICIPANT" },
      orderBy: { createdAt: "desc" },
      include: { promotion: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <ParticipantForm promotions={promotions} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Promotion</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name ?? "—"}</TableCell>
              <TableCell>
                {user.promotion ? (
                  user.promotion.name
                ) : (
                  <Badge variant="secondary">Aucune</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {user.promotionId && (
                  <form action={removeParticipant.bind(null, user.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Retirer
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                Aucun participant pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
