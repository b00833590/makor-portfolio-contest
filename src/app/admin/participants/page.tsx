import Link from "next/link";
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
import { ParticipantRowActions } from "./participant-row-actions";

export default async function ParticipantsPage() {
  const [promotions, users] = await Promise.all([
    db.promotion.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { role: "PARTICIPANT" },
      orderBy: { createdAt: "desc" },
      include: {
        promotion: { select: { name: true } },
        portfolios: { select: { id: true, promotionId: true } },
      },
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
          {users.map((user) => {
            const currentPortfolio = user.portfolios.find((p) => p.promotionId === user.promotionId);
            return (
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
                  <div className="flex justify-end gap-2">
                    {currentPortfolio && (
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/portfolios/${currentPortfolio.id}`} />}
                      >
                        Portefeuille
                      </Button>
                    )}
                    <ParticipantRowActions
                      userId={user.id}
                      name={user.name}
                      currentPromotionId={user.promotionId}
                      promotions={promotions}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
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
