import type { BadgeCode } from "./badge-criteria";

interface BadgeDefinition {
  code: BadgeCode;
  name: string;
  description: string;
  icon: string;
}

export const badgeDefinitions: BadgeDefinition[] = [
  {
    code: "DIVERSIFICATEUR",
    name: "Diversificateur",
    description: "Aucune position ne dépasse 20% du portefeuille.",
    icon: "🧩",
  },
  {
    code: "SNIPER",
    name: "Sniper",
    description: "Une position affiche un gain latent d'au moins 30%.",
    icon: "🎯",
  },
  {
    code: "MAIN_DE_FER",
    name: "Main de fer",
    description: "Aucun changement depuis 14 jours, avec une performance positive.",
    icon: "🖐️",
  },
  {
    code: "COMEBACK",
    name: "Comeback",
    description: "Progression d'au moins 3 places au classement en une semaine.",
    icon: "🚀",
  },
];
