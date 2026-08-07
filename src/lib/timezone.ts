import { z } from "zod";

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

// Forme exacte produite par <input type="datetime-local"> : "YYYY-MM-DDTHH:mm" ou
// "YYYY-MM-DDTHH:mm:ss" — rejeté sinon. Le constructeur Date natif est trop
// permissif (il "parse" avec succès des chaînes qui n'ont pas ce format) pour
// qu'on puisse s'y fier seul face à une requête forgée à la main.
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** `value` doit ressembler à "2026-07-31T21:38" (sortie native d'un input datetime-local, sans secondes). */
export function parseParisDateTimeLocal(value: string): Date {
  if (!DATETIME_LOCAL_PATTERN.test(value)) return new Date(NaN);

  const hasSeconds = value.length > 16;
  const naiveUtc = new Date(`${value}${hasSeconds ? "" : ":00"}Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, PARIS_TIME_ZONE);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}

/** Inverse de {@link parseParisDateTimeLocal} — pour préremplir un <input type="datetime-local"> en heure de Paris. */
export function toParisDateTimeLocalValue(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Affiche une date en heure de Paris, quel que soit le fuseau du serveur qui
 * exécute ce code — `date.toLocaleString("fr-FR")` sans `timeZone` explicite
 * dépend du fuseau du processus Node (correct en dev local si la machine est
 * réglée sur Paris, faux en production sur Vercel qui tourne en UTC).
 */
export function formatParisDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Comme {@link formatParisDateTime} mais sans l'heure — pour les dates de début/fin de promotion. */
export function formatParisDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Schéma Zod réutilisable pour un champ <input type="datetime-local"> interprété en heure de Paris. */
export const parisDateTimeLocalSchema = z.string().transform((value, ctx) => {
  const date = parseParisDateTimeLocal(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "Date invalide" });
    return z.NEVER;
  }
  return date;
});
