function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `before`/`after` on an AuditLog entry are usually full snapshots of a
 * record, but only a few fields typically change per action — diffing them
 * field by field (instead of dumping two whole JSON blobs) is what makes
 * "quel paramètre, quelle ancienne valeur, quelle nouvelle valeur" actually
 * readable at a glance, not just technically present in the data.
 */
export function formatAuditChange(before: unknown, after: unknown): string {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffs = [...keys]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => `${key} : ${formatValue(before[key])} → ${formatValue(after[key])}`);

    return diffs.join(" · ");
  }

  const parts: string[] = [];
  if (before !== null && before !== undefined) parts.push(`avant : ${JSON.stringify(before)}`);
  if (after !== null && after !== undefined) parts.push(`après : ${JSON.stringify(after)}`);
  return parts.join(" · ");
}
