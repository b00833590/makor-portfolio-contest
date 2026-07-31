/**
 * Construit un lien mailto: pré-rempli pour transmettre un mot de passe
 * temporaire — ouvre le client mail par défaut de l'admin (Gmail, Outlook...),
 * sans passer par un service d'envoi tiers (pas de domaine à vérifier).
 */
export function buildCredentialsMailto(params: { email: string; name: string; tempPassword: string }): string {
  const subject = "Vos identifiants — Concours de portefeuille Makor";
  const body = [
    `Bonjour ${params.name},`,
    "",
    "Voici vos identifiants pour vous connecter au concours de portefeuille Makor :",
    `Identifiant : ${params.name}`,
    `Mot de passe temporaire : ${params.tempPassword}`,
    "",
    "Vous devrez choisir un nouveau mot de passe dès votre première connexion.",
  ].join("\n");

  // encodeURIComponent, pas URLSearchParams : mailto: (RFC 6068) attend %20 pour
  // les espaces, pas "+" (convention des formulaires) — sinon certains clients
  // mail affichent des "+" littéraux dans le sujet/corps.
  return `mailto:${encodeURIComponent(params.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
