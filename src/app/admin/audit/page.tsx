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

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });
const AUDIT_LOG_LIMIT = 200;

function formatChange(before: unknown, after: unknown): string {
  const parts: string[] = [];
  if (before !== null && before !== undefined) parts.push(`avant : ${JSON.stringify(before)}`);
  if (after !== null && after !== undefined) parts.push(`après : ${JSON.stringify(after)}`);
  return parts.join(" · ");
}

export default async function AuditLogPage() {
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: AUDIT_LOG_LIMIT,
    include: { admin: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Journal d&apos;audit</h2>
        <p className="text-sm text-muted-foreground">
          Les {AUDIT_LOG_LIMIT} actions administrateur les plus récentes — création/suppression de participants,
          modifications de transactions, changements de promotion, etc.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune action enregistrée pour le moment.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">{dateFormatter.format(entry.createdAt)}</TableCell>
                <TableCell>{entry.admin.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{entry.action}</Badge>
                </TableCell>
                <TableCell className="max-w-40 truncate font-mono text-xs" title={entry.target}>
                  {entry.target}
                </TableCell>
                <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={formatChange(entry.before, entry.after)}>
                  {formatChange(entry.before, entry.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
