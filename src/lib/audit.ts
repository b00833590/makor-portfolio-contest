import "server-only";
import { db } from "@/lib/db";

interface LogAuditInput {
  adminId: string;
  action: string;
  target: string;
  before?: unknown;
  after?: unknown;
}

export async function logAudit({ adminId, action, target, before, after }: LogAuditInput) {
  await db.auditLog.create({
    data: {
      adminId,
      action,
      target,
      before: before === undefined ? undefined : (before as object),
      after: after === undefined ? undefined : (after as object),
    },
  });
}
