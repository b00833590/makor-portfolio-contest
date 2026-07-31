/**
 * Convertit une chaîne d'un `<input type="datetime-local">` (ex.
 * "2026-07-31T21:38", sans fuseau) en Date UTC, en l'interprétant comme
 * heure de Paris — quel que soit le fuseau du serveur qui exécute ce code
 * (Vercel tourne en UTC). Sans cette conversion, l'heure saisie par l'admin
 * est prise au pied de la lettre comme UTC, ce qui décale les ouvertures/
 * fermetures de session de changement de 1h ou 2h selon l'heure d'été.
 */
const PARIS_TIME_ZONE = "Europe/Paris";

function getTimeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** `value` doit ressembler à "2026-07-31T21:38" (sortie native d'un input datetime-local, sans secondes). */
export function parseParisDateTimeLocal(value: string): Date {
  const hasSeconds = value.length > 16;
  const naiveUtc = new Date(`${value}${hasSeconds ? "" : ":00"}Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, PARIS_TIME_ZONE);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}
