import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParticipantForm } from "./participant-form";
import { ParticipantRowActions } from "./participant-row-actions";

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
            <TableHead>Identifiant</TableHead>
            <TableHead>Promotion</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>
                {user.promotion ? (
                  user.promotion.name
                ) : (
                  <Badge variant="secondary">Aucune</Badge>
                )}
              </TableCell>
              <TableCell>
                <ParticipantRowActions
                  userId={user.id}
                  currentPromotionId={user.promotionId}
                  promotions={promotions}
                />
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                Aucun participant pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
