# Rôle "Directeur" — espace de suivi en lecture seule

**Date :** 2026-09-09
**Statut :** validé, prêt pour le plan d'implémentation

## Problème

Le directeur de Makor (Stéphane Chouffan) doit pouvoir suivre les concours en direct —
classement, portefeuilles de tous les participants, badges, statistiques, Hall of Fame,
règlement — sans jamais pouvoir modifier quoi que ce soit (ni trading, ni administration).
Aujourd'hui, seuls deux rôles existent : `ADMIN` (gestion complète) et `PARTICIPANT` (son
propre portefeuille uniquement). Aucun rôle de consultation transversale n'existe.

## Contexte technique (état actuel)

- `UserRole` = `PARTICIPANT | ADMIN`. `proxy.ts` ne connaît qu'une garde de rôle : les
  routes `/admin/*` exigent `ADMIN`.
- Une seule promotion `ACTIVE` à la fois (contrainte métier déjà actée, voir
  `2026-09-03-promotion-participant-selection-design.md`) — le "concours en cours" est
  singulier, pas une liste.
- Le flux mot de passe temporaire → changement obligatoire → invalidation existe déjà et
  est générique : `User.mustChangePassword`, forcé par `proxy.ts` (redirection vers
  `/change-password` tant que vrai), `generateTempPassword()` /
  `createParticipantWithTempPassword()` génèrent un mot de passe aléatoire, jamais choisi
  par l'admin. Après changement, l'ancien hash est remplacé et
  `destroyOtherSessionsForUser` coupe les sessions existantes. **Rien à réinventer ici.**
- Les fonctions de lecture des données (`getCachedPortfolioView(userId)`,
  `getCachedLeaderboard(promotionId)`, `getBadgeBoard(userId, promotionId?)`,
  `getCachedContestStats(promotionId, leaderboard)`,
  `getCachedParticipantStats(portfolioId, promotionId, row)`, `getHallOfFame(userId)`,
  `getTransactionHistory(portfolioId)`, `getPerformanceHistory(portfolioId)`) prennent
  déjà des identifiants explicites en paramètre, **pas** `session.user.*` — elles sont
  déjà réutilisables pour consulter les données d'un participant arbitraire. Seules les
  *pages* (`dashboard`, `leaderboard`, `badges`, `statistiques`, `reglement`) codent en dur
  `session.user.id` / `session.user.promotionId`.
- `PositionCard` masque déjà les actions d'achat/vente via une prop `contestClosed` (utilisée
  aujourd'hui quand la promotion est clôturée) — c'est exactement le mécanisme de lecture
  seule dont le Directeur a besoin, sans rien y changer.
- `/hall-of-fame` et `/contact` sont déjà des pages génériques, sans redirection par rôle —
  utilisables telles quelles par le Directeur.
- `AutoRefresh` (sans argument) applique déjà la cadence de rafraîchissement standard du
  site (horaires de marché, voir `src/lib/refresh-schedule.ts`) — pas de logique à dupliquer
  pour le "temps réel".

## Approche retenue

1. Ajouter `DIRECTEUR` à `UserRole`.
2. Généraliser le mécanisme de création/reset de mot de passe temporaire existant
   (aujourd'hui spécifique aux participants) pour qu'il accepte un rôle, et l'exposer dans
   une petite UI admin dédiée aux comptes Directeur.
3. Construire un espace `/directeur/*` dédié (nouvelles pages fines), qui **réutilise** les
   fonctions de données et les composants d'affichage existants plutôt que de les dupliquer.
   Deux extractions de composants sont nécessaires pour permettre cette réutilisation (le
   classement et le bloc portefeuille sont aujourd'hui écrits en JSX directement dans les
   pages participant existantes) ; tout le reste s'importe sans modification.

Approche écartée : réutiliser les URLs participant existantes (`/dashboard?userId=...`) en
mode lecture seule. Rejetée après clarification avec l'utilisateur — il veut un espace de
suivi pensé pour un directeur (navigation en entonnoir Concours → Classement → Participant →
Portefeuille → Badges), pas un compte participant restreint.

## Modèle de données

```prisma
enum UserRole {
  PARTICIPANT
  ADMIN
  DIRECTEUR
}
```

Migration Prisma pure (ajout de valeur d'enum), aucune donnée existante affectée. Un compte
Directeur n'a **jamais** de `promotionId` ni de `Portfolio` — il ne joue pas.

## Auth & permissions

- `src/proxy.ts` :
  - `/directeur` ajouté à `protectedPrefixes` (même traitement que `/admin`).
  - Nouvelle garde : `isDirecteurRoute && user.role !== "DIRECTEUR"` → redirection vers la
    page d'accueil de son propre rôle. Miroir exact de la garde `/admin` actuelle.
- `src/lib/dal.ts` : `requireDirecteur()` (cache), miroir de `requireAdmin()`.
- `src/app/login/actions.ts` et `src/app/change-password/actions.ts` : branche
  `DIRECTEUR → "/directeur"` ajoutée aux ternaires existants (deviennent des petits
  switches sur les 3 rôles).
- `src/components/site-header.tsx` :
  - `role` élargi à `"ADMIN" | "PARTICIPANT" | "DIRECTEUR"`.
  - `directeurNavLinks` = Concours (`/directeur`) · Hall of Fame (`/hall-of-fame`) · Contact
    (`/contact`) — le classement/stats/règlement d'un concours se navigue *depuis* la page
    de ce concours, pas depuis la barre du haut.
  - `homeHref` et le libellé de rôle dans le menu ("Directeur") étendus en conséquence.
- Pages participant qui redirigent aujourd'hui l'admin (`dashboard`, `leaderboard`,
  `statistiques`, `badges`, `resultats`) : condition `role === "ADMIN"` →
  `role !== "PARTICIPANT"`, pour exclure aussi `DIRECTEUR` (aucun portefeuille personnel).
- `src/app/profil/page.tsx` : libellé de rôle étendu (3 valeurs au lieu de 2).

Aucune modification de `src/app/dashboard/actions.ts` (achat/vente) : ces server actions
opèrent sur `session.user.id`, qui pour un Directeur n'a jamais de portefeuille — même si
elles étaient atteintes, `executeOrder` échouerait. Le vrai contrôle est que **rien** dans
`/directeur/*` ne les importe ni ne rend de bouton qui les déclenche.

## Création du compte & cycle de vie du mot de passe

- `src/lib/participants/create-participant.ts` : `createParticipantWithTempPassword`
  généralisé en `createUserWithTempPassword({ name, role })` (défaut `PARTICIPANT`),
  réutilisé à l'identique par la création participant existante. Même chose pour le reset
  de mot de passe (aujourd'hui `resetParticipantPassword` dans
  `admin/participants/actions.ts`) : extrait en helper partagé `resetUserPassword(userId)`.
- Nouvel onglet admin **"Comptes Directeur"** (`/admin/directeurs`, ajouté à
  `admin/layout.tsx`), calqué sur `/admin/participants` mais sans assignation de promotion :
  formulaire de création (nom seul) + liste des comptes `DIRECTEUR` existants + bouton
  "Réinitialiser le mot de passe" par ligne. Réutilise `ParticipantForm`/`ParticipantRowActions`
  comme référence de patron, pas par import direct (formulaire plus simple).
- Création immédiate du compte de Stéphane Chouffan avec le mot de passe **littéral "1234"**
  (demande explicite, le temps des vérifications d'Adam) via un script one-off
  (`scripts/create-directeur.ts`, idempotent, même patron que `prisma/seed-admin.ts`) :
  `role: DIRECTEUR`, `mustChangePassword: true`, hash du mot de passe fourni littéralement
  (pas `generateTempPassword()`, puisque la valeur est imposée). Une fois les vérifications
  faites, Adam utilise le bouton "Réinitialiser le mot de passe" de la nouvelle UI admin —
  qui, lui, génère un vrai mot de passe aléatoire à transmettre à Stéphane, conformément au
  point 1 de la demande. Première connexion → `/change-password` forcé → choix de son propre
  mot de passe → ancien hash mort.

## Espace `/directeur/*`

- `src/app/directeur/layout.tsx` : `requireDirecteur()` + `<SiteHeader>`.
- `src/app/directeur/page.tsx` (accueil / vue d'ensemble) :
  - Le(s) concours `ACTIVE` mis en avant (au plus un aujourd'hui, contrainte métier — la
    requête reste un `findMany` non bornée à 1 pour dégrader proprement si cette règle
    change un jour) : nombre de participants, temps restant avant clôture, capital initial —
    carte vers `/directeur/promotions/[id]`.
  - Section "Historique" : promotions `CLOSED`, triées par date, même carte simplifiée →
    même page hub (qui adapte son contenu au statut clôturé, voir plus bas).
  - `<ParticipantQuickSelect>` (nouveau petit composant client, liste + filtre texte) listant
    tous les participants ayant un portefeuille actif → lien direct vers
    `/directeur/participants/[userId]`.
  - `<AutoRefresh />`.
- `src/app/directeur/promotions/[promotionId]/page.tsx` (hub d'un concours) :
  - Indicateurs clés (participants, temps restant, capital moyen investi).
  - Bloc "Leader / Meilleure progression / Sous-performance" calculé depuis
    `getCachedLeaderboard` (déjà chargé pour la page) : `rank === 1` pour le leader, meilleur
    et pire `weeklyReturnPct` pour la progression/sous-performance — aucune nouvelle requête.
  - Liste des participants de la promotion (`PromotionParticipant` + `User`), chacun →
    `/directeur/participants/[userId]`.
  - Sous-navigation (liens simples, patron identique à `admin/layout.tsx`) : Vue d'ensemble ·
    Classement · Statistiques · Règlement.
  - Si la promotion est `CLOSED` : mêmes indicateurs figés, classement = `FrozenStandings`
    (déjà utilisé par `/leaderboard` pour ce cas), pas d'`AutoRefresh`.
- `src/app/directeur/promotions/[promotionId]/classement/page.tsx` : réutilise
  `getCachedLeaderboard`/`getFrozenLeaderboard`/`computeLeaderboardGaps` +
  `getCachedPromotionPerformanceSeries`, via un composant **extrait**
  `src/components/leaderboard/leaderboard-board.tsx` regroupant le rendu aujourd'hui interne
  à `leaderboard/page.tsx` (podium, tableau desktop, cartes mobile, `FrozenStandings`),
  paramétré par `selfUserId: string | null` (`null` ⇒ pas de badge "Vous", c'est le seul
  changement de comportement). `leaderboard/page.tsx` est mis à jour pour consommer ce même
  composant (aucune régression visuelle attendue, refactor pur).
- `src/app/directeur/promotions/[promotionId]/statistiques/page.tsx` : réutilise
  `getCachedContestStats` + `<ContestStatsSection>` tel quel (un seul onglet, pas de "Mes
  statistiques" puisque le Directeur n'a pas de portefeuille).
- `src/app/directeur/promotions/[promotionId]/reglement/page.tsx` : réutilise
  `<RulesDocument>` tel quel, avec le `promotionId` de la route au lieu de
  `session.user.promotionId`.
- `src/app/directeur/participants/[userId]/page.tsx` :
  - Bandeau "Vous consultez le portefeuille de {name} en lecture seule" + lien retour vers
    le hub du concours.
  - Réutilise `getCachedPortfolioView(userId)`, `getPerformanceHistory`,
    `getTransactionHistory` + un composant **extrait**
    `src/app/dashboard/portfolio-summary.tsx` regroupant le bloc JSX aujourd'hui inline dans
    `dashboard/page.tsx` (cartes indicateurs, `PerformanceChart`, liste de `PositionCard`,
    historique de transactions), paramétré par `readOnly: boolean`. En mode `readOnly`,
    `BuyForm` n'est pas rendu et `PositionCard` reçoit `contestClosed={true}` (le mécanisme
    de masquage des boutons d'achat/vente existe déjà, aucune modification de
    `PositionCard`/`BuyForm`). `dashboard/page.tsx` consomme ce même composant avec
    `readOnly={false}` (refactor pur, pas de changement de comportement participant).
  - Onglet Badges : réutilise `getBadgeBoard(userId)` + les composants de `/badges`
    (`BadgesTabs`/`BadgeGrid`), sans les records personnels (propres au participant lui-même).
  - Portefeuille "en direct" uniquement (promotion active de l'utilisateur) — cohérent avec
    ce que voit un participant lui-même : un concours clôturé n'a plus de vue portefeuille
    live côté participant non plus (`/resultats` + Hall of Fame couvrent ce cas). Pas de
    régression de périmètre.

Nav directeur globale (`site-header.tsx`) : Concours → (dans la page) Classement /
Statistiques / Règlement / Participants → (sélection d'un participant) Portefeuille → Badges
→ Hall of Fame (lien direct, page existante, aucune duplication) → Règlement (par concours,
déjà couvert).

## Hors scope (explicitement déféré)

Alertes/évènements (changement de leader, forte variation, nouveau badge débloqué) —
nécessite un historique d'évènements à stocker et un mécanisme de diff entre deux états, pas
juste de la lecture. Itération séparée si le besoin se confirme à l'usage.

## Tests

- `hashPassword`/`verifyPassword`/flux `mustChangePassword` déjà couverts — aucun nouveau
  cas, le rôle ne change pas ce flux.
- Nouveau : `createUserWithTempPassword` avec `role: "DIRECTEUR"` crée bien un compte sans
  `promotionId`.
- Nouveau : `leaderboard-board.tsx` avec `selfUserId: null` ne rend aucun badge "Vous" (test
  de rendu léger ou vérification manuelle, selon ce que couvre déjà `leaderboard`).
- Vérification manuelle navigateur (comme pour toute UI) : connexion Directeur, navigation
  complète de l'entonnoir, confirmation qu'aucun bouton d'achat/vente/édition n'apparaît nulle
  part dans `/directeur/*`, et qu'un accès direct à `/admin/*` redirige.
