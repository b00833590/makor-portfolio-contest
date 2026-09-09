-- Ajoute le rôle "Directeur" : consultation globale en lecture seule de tous
-- les concours et portefeuilles, sans accès trading ni administration. Voir
-- docs/superpowers/specs/2026-09-09-directeur-role-design.md.

ALTER TYPE "UserRole" ADD VALUE 'DIRECTEUR';
