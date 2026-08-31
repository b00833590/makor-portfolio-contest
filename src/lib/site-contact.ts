/**
 * Coordonnées de la personne qui gère la plateforme, affichées sur la page
 * `/contact`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  TRANSMISSION DU PROJET À UN NOUVEAU STAGIAIRE
 * ─────────────────────────────────────────────────────────────────────────────
 *  C'est le SEUL fichier à modifier. Remplacer les valeurs ci-dessous, puis
 *  `git commit` + push (le déploiement Vercel est automatique).
 *
 *  - Laisser une chaîne vide ("") masque simplement la ligne sur la page.
 *  - `email` et `phone` deviennent des liens cliquables (mailto: / tel:).
 *  - `linkedinUrl` / `instagramUrl` : coller l'URL complète du profil
 *    (https://www.linkedin.com/in/…, https://www.instagram.com/…).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface SiteContact {
  /** Nom affiché de la personne responsable. */
  name: string;
  /** Fonction / rôle, ex. « Stagiaire — gestion de la plateforme ». */
  role: string;
  /** Adresse e-mail. Vide = ligne masquée. */
  email: string;
  /** URL complète du profil LinkedIn. Vide = ligne masquée. */
  linkedinUrl: string;
  /** URL complète du compte Instagram. Vide = ligne masquée. */
  instagramUrl: string;
  /** Numéro de téléphone, format lisible (ex. « +33 6 12 34 56 78 »). Vide = ligne masquée. */
  phone: string;
}

export const SITE_CONTACT: SiteContact = {
  name: "Adam Rouas",
  role: "Gestion de la plateforme Makor Concours",
  // TODO — renseigner ces 4 valeurs (voir le commentaire en haut du fichier).
  email: "",
  linkedinUrl: "",
  instagramUrl: "",
  phone: "",
};

export interface ContactMethod {
  kind: "email" | "linkedin" | "instagram" | "phone";
  label: string;
  /** Texte affiché (e-mail, numéro, ou URL nettoyée de son protocole). */
  display: string;
  /** `href` du lien, ou `null` si non cliquable. */
  href: string | null;
  /** `true` pour un lien externe (ouvre un nouvel onglet). */
  external: boolean;
}

/** Retire `https://` et le `/` final pour un affichage compact d'une URL. */
function tidyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * Liste ordonnée des moyens de contact effectivement renseignés — utilisée
 * telle quelle par la page `/contact`.
 */
export function getContactMethods(contact: SiteContact = SITE_CONTACT): ContactMethod[] {
  const methods: ContactMethod[] = [];

  if (contact.email.trim()) {
    methods.push({
      kind: "email",
      label: "E-mail",
      display: contact.email.trim(),
      href: `mailto:${contact.email.trim()}`,
      external: false,
    });
  }
  if (contact.linkedinUrl.trim()) {
    methods.push({
      kind: "linkedin",
      label: "LinkedIn",
      display: tidyUrl(contact.linkedinUrl.trim()),
      href: contact.linkedinUrl.trim(),
      external: true,
    });
  }
  if (contact.instagramUrl.trim()) {
    methods.push({
      kind: "instagram",
      label: "Instagram",
      display: tidyUrl(contact.instagramUrl.trim()),
      href: contact.instagramUrl.trim(),
      external: true,
    });
  }
  if (contact.phone.trim()) {
    methods.push({
      kind: "phone",
      label: "Téléphone",
      display: contact.phone.trim(),
      href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
      external: false,
    });
  }

  return methods;
}
