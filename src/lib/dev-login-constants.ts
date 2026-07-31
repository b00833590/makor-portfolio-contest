/**
 * Domaine réservé aux comptes de démonstration créés par `npm run db:seed`.
 * Utilisé à la fois par le script de seed et par la page de connexion pour
 * lister dynamiquement les comptes disponibles, sans dupliquer les emails.
 */
export const DEMO_EMAIL_DOMAIN = "demo.makor.local";

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}
