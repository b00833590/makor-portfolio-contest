import { ChangeSessionStatus } from "@/generated/prisma/enums";

export type ChangeSessionEffectiveStatus = "SCHEDULED" | "OPEN" | "CLOSED";

export interface ChangeSessionWindow {
  status: ChangeSessionStatus;
  opensAt: Date;
  closesAt: Date;
}

/**
 * Statut réel d'une session de changement, calculé à chaque lecture plutôt
 * que dépendant d'une bascule manuelle admin — l'ouverture/fermeture suit
 * automatiquement l'horloge. Le champ `status` en base ne sert plus qu'à
 * représenter une dérogation explicite de l'admin : "Ouvrir maintenant" avant
 * l'heure prévue (status=OPEN) ou "Fermer maintenant" avant l'heure prévue
 * (status=CLOSED) — dans le cas normal, `status` reste `SCHEDULED` en
 * permanence et c'est la fenêtre [opensAt, closesAt] qui décide.
 */
export function computeChangeSessionStatus(session: ChangeSessionWindow, now: Date): ChangeSessionEffectiveStatus {
  if (session.status === ChangeSessionStatus.CLOSED) return "CLOSED";
  if (session.status === ChangeSessionStatus.OPEN) {
    return now > session.closesAt ? "CLOSED" : "OPEN";
  }
  if (now < session.opensAt) return "SCHEDULED";
  if (now > session.closesAt) return "CLOSED";
  return "OPEN";
}

/**
 * Deux fenêtres qui se touchent exactement (la fermeture de l'une = l'ouverture
 * de l'autre) ne sont pas considérées comme un chevauchement — des sessions
 * bout à bout restent valides.
 */
export function sessionsOverlap(a: { opensAt: Date; closesAt: Date }, b: { opensAt: Date; closesAt: Date }): boolean {
  return a.opensAt < b.closesAt && b.opensAt < a.closesAt;
}
