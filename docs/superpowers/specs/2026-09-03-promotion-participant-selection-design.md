# Sélection de participants existants à la création d'une promotion

**Date :** 2026-09-03
**Statut :** validé, prêt pour le plan d'implémentation

## Problème

Le terminal admin ne permet que de **créer de nouveaux comptes participants** pour une
promotion (formulaire groupé sur la page détail `/admin/promotions/[id]`). Réutiliser un
participant d'une saison passée se fait aujourd'hui un par un depuis `/admin/participants`
via `reassignParticipantPromotion`, qui **déplace** le FK unique `User.promotionId`.

Conséquences :

- Pas de vue « qui participait à la promotion X » une fois les participants passés à la
  suivante — le roster d'une ancienne promotion disparaît (la page détail affiche
  `promotion.users`, la back-relation du FK).
- La participation est un pointeur mutable, pas une donnée tracée — exactement la « dérive
  non tracée » que l'app a été conçue pour remplacer.
- Aucune UI pour sélectionner en lot des participants existants au moment de constituer une
  nouvelle promotion.

## Contexte technique (état actuel)

- `User.promotionId` (FK nullable) = « la promotion que ce participant joue actuellement ».
  Résolu par tout le front participant : `dashboard`, `leaderboard`, `execute-order`,
  badges (`evaluate-badges`, `badge-actions`), `portfolio-view`.
- `Portfolio` a déjà `@@unique([userId, promotionId])`. `getLeaderboard`,
  `PerformanceSnapshot`, `UserBadge`, `get-contest-stats` sont **tous** indexés par
  `Portfolio.promotionId` ou un `promotionId` explicite — **pas** par `User.promotionId`
  directement. Portefeuille / classement / perfs / progression par promotion sont donc
  **déjà** structurellement supportés.
- `provisionPortfolios(promotionId)` lit `db.user.findMany({ where: { promotionId } })` —
  **seul** endroit où l'appartenance pilote un comportement. Idempotent (`skipDuplicates`).
- `provisionPortfolioIfPromotionActive` : ne provisionne que si la promotion est `ACTIVE`
  (une `DRAFT` est provisionnée à l'activation).
- Historique des concours terminés : figé dans `HallOfFameEntry` à la clôture, jamais
  recalculé. Conservé indépendamment de `User.promotionId`.
- Contrainte métier confirmée par le client : **une seule promotion non clôturée à la
  fois** (une promotion par mois, séquentielles, jamais deux `ACTIVE` en parallèle). Aucun
  besoin de sélecteur de promotion côté participant.

## Approche retenue

Table de liaison `PromotionParticipant` = **registre d'inscription** (une ligne par couple
participant × promotion, écrite à l'inscription, jamais mutée destructivement).
`User.promotionId` **reste** le pointeur dénormalisé « promotion active », tenu à jour à
l'inscription. Le front participant n'est pas touché → **risque nul pour les promotions
existantes**. Une migration de backfill recopie les `User.promotionId` actuels → l'état
courant est identique après migration.

Approche écartée : batch-set de `User.promotionId` sans table. Plus petit mais laisse la
participation en pointeur mutable et ne restaure pas les rosters passés.

## Modèle de données

```prisma
model PromotionParticipant {
  id          String   @id @default(cuid())
  userId      String
  promotionId String
  createdAt   DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([userId, promotionId])
  @@index([promotionId])
}
```

- Back-relations : `User.promotionParticipations PromotionParticipant[]`,
  `Promotion.participants PromotionParticipant[]`.
- `onDelete: Cascade` des deux côtés : c'est un enregistrement de liaison. Supprimer une
  promotion supprime déjà ses `Portfolio` / `HallOfFameEntry` (Cascade) ; supprimer un
  compte supprime déjà ses `Portfolio` (Cascade). Cohérent.
- `User.promotionId` : **inchangé** (garde `onDelete: SetNull`). Commentaire `ponytail:` à
  ajouter dans le schéma : pointeur « promotion active » dénormalisé, synchronisé avec
  `PromotionParticipant` à l'inscription ; à fusionner si l'app passe un jour à du vrai
  multi-promotion simultané.

### Migration

Répertoire `prisma/migrations/20260903120000_promotion_participant/` (timestamp manuel,
convention du repo). `migration.sql` :

1. `CREATE TABLE "PromotionParticipant"` + index unique `(userId, promotionId)` + index
   `(promotionId)` + les deux FK (`ON DELETE CASCADE`).
2. Backfill :
   ```sql
   INSERT INTO "PromotionParticipant" ("id", "userId", "promotionId", "createdAt")
   SELECT gen_random_uuid(), "id", "promotionId", CURRENT_TIMESTAMP
   FROM "User"
   WHERE "promotionId" IS NOT NULL;
   ```
   `gen_random_uuid()` est natif Postgres 13+ (Neon est en PG15+). L'`id` n'a aucune
   contrainte de format côté DB, seulement la PK — un UUID convient.

## Logique — nouveau module `src/lib/participants/promotion-membership.ts`

Point d'entrée unique de l'inscription, `import "server-only"` :

```ts
type RegisterResult =
  | { userId: string; name: string; status: "registered" }
  | { userId: string; name: string; status: "already-registered" }
  | { userId: string; name: string; status: "blocked-active-elsewhere"; promotionName: string };

async function registerParticipants(
  promotionId: string,
  userIds: string[],
): Promise<RegisterResult[]>;
```

Pour chaque `userId` :

1. Charger l'utilisateur avec sa promotion courante (`promotion: { select: { status, name } }`).
2. **Garde** : si `user.promotionId` pointe une promotion `ACTIVE` **différente** de
   `promotionId` → `blocked-active-elsewhere`, ne rien écrire. (Le client dit que ça
   n'arrive jamais ; garde-fou peu coûteux contre la perte d'accès à un concours en cours.)
3. `upsert` de la ligne `PromotionParticipant` (`@@unique([userId, promotionId])`). Déjà
   présente → `already-registered`.
4. `user.update({ promotionId })` — synchronise le pointeur actif.
5. Après la boucle, si ≥ 1 inscription effective →
   `provisionPortfolioIfPromotionActive(promotionId)` (une fois, idempotent).

`unregisterParticipant(promotionId, userId)` :

- Autorisé **uniquement** si la promotion est `DRAFT` (aucun `Portfolio` encore créé).
  Sinon lève / renvoie une erreur (« retirer un participant d'une promotion active/clôturée
  fausserait l'historique »).
- Supprime la ligne `PromotionParticipant`. Si `user.promotionId === promotionId`, le
  remettre à `null`.

## Provisioning — `src/lib/portfolio-provisioning.ts`

`provisionPortfolios` lit désormais la table de liaison :

```ts
const participants = await db.promotionParticipant.findMany({
  where: { promotionId },
  select: { userId: true },
});
// createMany Portfolio { userId, promotionId }, skipDuplicates — inchangé
```

Résultat identique après backfill. `provisionPortfolioIfPromotionActive` inchangé.

## Création de nouveaux participants — routage via le module

- `src/lib/participants/create-participant.ts` (`createParticipantWithTempPassword`) :
  devient responsable du **seul compte** (nom + mot de passe temporaire). On retire
  `promotionId` de son input et de `db.user.create`. Le résultat `"created"` expose l'`id`
  du compte créé pour que l'appelant enchaîne `registerParticipants`.
- `src/app/admin/participants/actions.ts` `createParticipant` : après création, si
  `promotionId` fourni → `registerParticipants(promotionId, [newUserId])`. Retire l'appel
  direct à `provisionPortfolioIfPromotionActive` (fait par le module).
- `src/app/admin/promotions/[id]/participants-actions.ts` `createParticipantsBulk` : idem,
  collecte les `userId` créés puis un seul `registerParticipants(promotionId, ids)`.
- Tests existants (`create-participant.test.ts`, `portfolio-provisioning.test.ts`,
  `participants` schema tests) : à adapter aux nouveaux appels.

## UI admin

### Page détail promotion `/admin/promotions/[id]/page.tsx`

- **Roster** : remplacer `promotion.users` par `promotion.participants` (via
  `PromotionParticipant`, `include: { user: { select: { id, name } } }`, tri par
  `user.name`). Les anciennes promotions gardent leur liste.
- Chaque ligne du roster : bouton **« Retirer »** rendu **uniquement si
  `promotion.status === "DRAFT"`**, appelant une action `unregisterParticipantAction`.
- Nouvelle carte **« Ajouter des participants existants »** (nouveau composant client
  `add-existing-participants-form.tsx`) :
  - Props : liste des candidats = tous les `User` `role: "PARTICIPANT"` **non déjà
    inscrits** à cette promotion, chacun avec `{ id, name, lastPromotionName }`
    (`lastPromotionName` = nom de la promotion la plus récente de ce user via ses
    `promotionParticipations` triées, ou `null`).
  - Rendu : liste de cases à cocher, une par candidat, `label` = nom + `lastPromotionName`
    en muted (« — dernière : Concours Août 2026 »). Case « tout cocher / décocher ».
    Recherche texte simple si > ~20 candidats (filtre client sur le nom).
  - Submit → nouvelle action `addExistingParticipants(promotionId, formData)` →
    `registerParticipants`. Affiche le compte-rendu (`RegisterResult[]`) : inscrits /
    déjà là / bloqués.
- La carte « créer de nouveaux comptes » (`BulkParticipantsForm`) reste, routée via le
  module.

### Nouvelles actions `src/app/admin/promotions/[id]/participants-actions.ts`

- `addExistingParticipants(promotionId, _prev, formData)` : `requireAdmin`, parse
  `formData.getAll("userId")` (zod : array de strings non vides, ≥ 1), appelle
  `registerParticipants`, `logAudit` (`action: "promotion.participants.add"`, `after: { userIds }`),
  `revalidatePath` détail + `/admin/participants`. Renvoie `{ results }` ou `{ error }`.
- `unregisterParticipantAction(promotionId, userId)` : `requireAdmin`, appelle
  `unregisterParticipant`, `logAudit` (`action: "promotion.participants.remove"`),
  `revalidatePath`.

### Page `/admin/participants/page.tsx` + `participant-row-actions.tsx`

- Colonne « Promotion » : afficher **toutes** les promotions du participant (badges) via
  `user.promotionParticipations.promotion.name`, plutôt que le seul `user.promotion.name`.
  La promotion active (`user.promotionId`) mise en avant (badge `default` vs `secondary`).
- Dialogue « Modifier » : le `<form>` de reassignation devient **« Ajouter à une
  promotion »** → nouvelle action `addParticipantToPromotion(_prev, formData)` (userId +
  promotionId) qui appelle `registerParticipants(promotionId, [userId])`. Remplace
  `reassignParticipantPromotion`.
- `reassignParticipantPromotion` : supprimée (ou conservée en délégant au module si un
  autre appelant existe — à vérifier dans le plan). `reassignPromotionSchema` renommé
  `addToPromotionSchema` (mêmes champs).
- `removeParticipant` (action existante, met `promotionId = null`) : **inchangée** — ne
  touche qu'au pointeur actif, ne supprime aucune ligne `PromotionParticipant`
  (l'inscription tracée + le portefeuille restent pour l'historique). Retirer un
  participant d'une promotion `DRAFT` se fait via la page détail (`unregisterParticipant`).

## Vérification des exigences

| Exigence | Couverture |
|---|---|
| Anciens participants non sélectionnés : pas d'accès à la nouvelle promotion | `user.promotionId` reste sur leur ancienne promo ; `dashboard`/`leaderboard` résolvent via ce champ |
| Non sélectionnés : absents du classement | Pas de ligne `PromotionParticipant` → pas de `Portfolio` provisionné → absents de `getLeaderboard` (indexé `Portfolio.promotionId`) |
| Un participant dans plusieurs promotions, portefeuille/classement/perfs/progression propres | `Portfolio` unique `(userId, promotionId)` ; snapshots par portefeuille ; `UserBadge` par `(userId, promotionId)` — déjà en place |
| Historique des anciennes promotions conservé | Table de liaison purement additive ; `HallOfFameEntry` inchangé ; aucun `Portfolio`/snapshot supprimé |
| Sélection simple et claire | Carte à cases à cocher sur la page détail, label = nom + dernière promotion |
| Ne pas casser les promotions existantes | Backfill = état identique ; front participant non touché ; `provisionPortfolios` lit une donnée équivalente |
| Propre et évolutif | La participation devient une entité de première classe, tracée (audit), non mutée destructivement |

## Hors périmètre

- Suppression de `User.promotionId` (gardé comme pointeur synchronisé — chemin sûr et
  minimal ; un futur passage au multi-promotion simultané le reverrait).
- UI participant « changer de promotion » (client : une seule promotion active à la fois).
- Sélection de participants **dans le formulaire de création** de promotion (client :
  sur la page détail après création).
- Modification du comportement du dashboard figé pour un participant dont la promo est
  clôturée et qui n'est pas repris (comportement existant conservé).

## Fichiers touchés (estimé)

| Fichier | Nature |
|---|---|
| `prisma/schema.prisma` | + modèle `PromotionParticipant`, back-relations, commentaire ponytail |
| `prisma/migrations/20260903120000_promotion_participant/migration.sql` | nouveau — table + backfill |
| `src/lib/participants/promotion-membership.ts` | nouveau — `registerParticipants`, `unregisterParticipant` |
| `src/lib/participants/promotion-membership.test.ts` | nouveau |
| `src/lib/portfolio-provisioning.ts` | lit `promotionParticipant` |
| `src/lib/portfolio-provisioning.test.ts` | adapté |
| `src/lib/participants/create-participant.ts` | ne fixe plus `promotionId` |
| `src/lib/participants/create-participant.test.ts` | adapté |
| `src/app/admin/promotions/[id]/participants-actions.ts` | + `addExistingParticipants`, `unregisterParticipantAction` ; bulk routé via module |
| `src/app/admin/promotions/[id]/page.tsx` | roster via `participants` ; nouvelle carte |
| `src/app/admin/promotions/[id]/add-existing-participants-form.tsx` | nouveau composant client |
| `src/app/admin/participants/actions.ts` | `createParticipant` via module ; `addParticipantToPromotion` remplace `reassign` |
| `src/app/admin/participants/schema.ts` | `addToPromotionSchema` |
| `src/app/admin/participants/page.tsx` | colonne multi-promotions |
| `src/app/admin/participants/participant-row-actions.tsx` | « Ajouter à une promotion » |
| `src/app/admin/participants/schema.test.ts` | adapté |
| `docs/ADMINISTRATION.md` | doc du nouveau flux |

## Tests

- `promotion-membership.test.ts` : inscription nouvelle, ré-inscription idempotente, garde
  « active ailleurs », synchro `user.promotionId`, provisioning déclenché si `ACTIVE`,
  `unregisterParticipant` refusé hors `DRAFT`.
- `portfolio-provisioning.test.ts` : lit bien `promotionParticipant`.
- Adapter les tests de création de participants.
- Vérif manuelle : créer promo DRAFT → ajouter existants + nouveaux → activer → classement
  ne contient que les inscrits ; un non-inscrit garde son ancien dashboard.
