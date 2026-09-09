import type { UserRole } from "@/generated/prisma/enums";

/** Page d'accueil de chaque rôle — utilisé après connexion, après changement de mot de passe, et pour rediriger hors d'un espace qui ne concerne pas ce rôle. */
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "DIRECTEUR":
      return "/directeur";
    default:
      return "/dashboard";
  }
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrateur";
    case "DIRECTEUR":
      return "Directeur";
    default:
      return "Participant";
  }
}
