# Fin de concours automatique + Hall of Fame historisé — Design

Date : 2026-08-28
Statut : validé (brainstorming)

## Problème

Le concours n'a aucun mécanisme de fin automatique. Constats sur le code et la base de prod :

- Le passage `ACTIVE → CLOSED` d'une `Promotion` est **100 % manuel** (bouton admin, `setPromotionStatus`). Rien ne lit `endDate` pour changer `status`.
- `endDate` est saisi via `<input type="date">` → `z.coerce.date()` le fige à **minuit UTC = 02:00 Paris**. Le règlement n'affiche aucune heure.
- Tant que l'admin ne clôture pas : le cron nocturne `snapshot-portfolios` (filtre `status: ACTIVE`) continue d'écrire snapshots + rangs indéfiniment ; `getLeaderboard` recalcule en continu au prix de marché ; le classement « final » dépend de l'instant du clic admin, pas de `endDate`.
- Le `Hall of Fame` ne persiste rien : `getHallOfFame()` recalcule à la volée depuis les promotions `CLOSED` et leurs `PerformanceSnapshot`, et ne garde **que le vainqueur** de chaque saison. Aucune entrée historique par participation.

Concours actuel « Promotion Août 2026 » : `ACTIVE`, `endDate = 2026-08-28T00:00:00Z`, `freezeHoursBeforeEnd = 48` (gel effectif depuis le 26/08), 3 participants, date de fin déjà dépassée en horloge murale.

## Objectifs

1. Concours actuel : fin aujourd'hui **28/08 à 11:00 Paris** (`endDate = 2026-08-28T09:00:00Z`), clôture automatique à cette heure.
2. Clôture automatique **idempotente** de toute promotion dont `endDate` est atteinte : statut `CLOSED`, sessions fermées, trading bloqué, classement final figé, badges close-only attribués, Hall of Fame rempli.
3. Robustesse : la clôture se produit même si personne n'est connecté à l'instant exact (au retour d'un participant, ou via le cron nocturne existant — **aucun nouveau cron**).
4. Futurs concours : date **et heure** obligatoires (début + fin), fuseau Europe/Paris, affichées dans le règlement.
5. Expérience de fin premium : page `/resultats` (podium, vainqueur, position du joueur).
6. Hall of Fame historisé : une entrée figée par participation à un concours terminé, jamais fusionnée, triée par performance.

## Non-objectifs

- Pas de nouveau cron (limite Vercel Hobby atteinte).
- Pas de changement aux règles de trading, au calcul de performance, au modèle `Transaction`/`Position`.
- Pas de migration destructive ni de backfill (0 promotion `CLOSED` aujourd'hui).
- Pas de notion de cohorte/promo distincte du concours (`Promotion` = la saison).

## Architecture

### 1. `src/lib/promotion-lifecycle.ts` (nouveau)

```ts
export async function closePromotionIfEnded(
  promotionId: string,
  now?: Date,
): Promise<{ closed: boolean }>
```

- **Garde atomique** :
  `db.promotion.updateMany({ where: { id: promotionId, status: ACTIVE, endDate: { lte: now } }, data: { status: CLOSED } })`.
  Le `count` (0 ou 1) indique si **cet appel** a réalisé la transition. Concurrence : un seul appel gagne.
- Si `count === 1` → `finalizePromotionClosure(promotionId)`.
- Retourne `{ closed: count === 1 }`.

```ts
export async function finalizePromotionClosure(promotionId: string): Promise<void>
```

Exécuté une seule fois par clôture. Toutes les étapes sont elles-mêmes idempotentes (défense en profondeur si un crash survient au milieu). Horodatage de référence = `promotion.endDate` (déterministe, indépendant de l'instant réel du déclenchement) :

1. **Snapshot final** par portefeuille, avec rang, `timestamp = endDate` — via `snapshotOnePromotion(promotionId, endDate)` extrait de `snapshot-service.ts`. Idempotent : ne crée pas de nouvelle ligne s'il existe déjà un snapshot à `timestamp === endDate` pour le portefeuille.
2. **Fermeture des sessions** : `db.changeSession.updateMany({ where: { promotionId, status: { not: CLOSED } }, data: { status: CLOSED } })`.
3. **Badges close-only** : `awardCloseOnlyBadges(promotionId, endDate)` (déjà idempotent, upsert `userId_badgeId_promotionId`).
4. **Hall of Fame** : pour chaque portefeuille, `db.hallOfFameEntry.upsert({ where: { promotionId_userId }, create: {...}, update: {} })` — `update: {}` garantit qu'une entrée existante n'est **jamais** modifiée (résultat officiel unique). Données lues depuis les snapshots finaux de l'étape 1 + `initialCapital`.
5. `updateTag("hall-of-fame")`, `updateTag("leaderboard")`, `revalidatePath("/hall-of-fame")`, `revalidatePath("/leaderboard")`, `revalidatePath("/resultats")`.

`setPromotionStatus(promotionId, CLOSED)` (bouton admin, `admin/promotions/actions.ts`) est réécrit pour appeler `finalizePromotionClosure` au lieu de son bloc `CLOSED` actuel — un seul chemin de finalisation.

`ponytail:` la valorisation utilise le dernier prix connu à l'instant du déclenchement (via `refreshAssetPricesIfStale` dans le chemin snapshot). Un déclenchement > 24 h après `endDate` (uniquement si le site **et** le cron nocturne sont muets) ferait légèrement dériver les prix. Filet cron = plafond réaliste < 1 jour ; le gel 48 h fige les positions bien avant la fin. Évolution possible si besoin : lire `price` avec `timestamp <= endDate`.

### 2. Déclencheurs

| Emplacement | Détail |
|---|---|
| `src/lib/promotion-lifecycle.ts` → `ensureViewerContestClosed(promotionId)` appelé dans **`/dashboard`, `/leaderboard`, `/resultats`, `/reglement`** (pages participant, server components) | une requête `updateMany` indexée ; ne s'exécute que si `endDate <= now && status ACTIVE`, sinon no-op quasi gratuit. **Pas** dans `verifySession` (partagé avec l'admin, hot path). |
| Tête du cron `src/app/api/cron/snapshot-portfolios/route.ts` | avant le snapshot : `for (p of promotions where endDate <= now && status ACTIVE) closePromotionIfEnded(p.id)`. Filet de sécurité. |
| Action de trading (`src/app/dashboard/actions.ts` ou équivalent qui appelle `executeOrder`) | `closePromotionIfEnded` avant `buildTradeContext` → refus « Le concours est terminé. » (le garde `status !== ACTIVE` de `validateOrder` suffit ensuite). |

### 3. Modèle de données — migration additive

`prisma/schema.prisma` :

```prisma
model HallOfFameEntry {
  id             String   @id @default(cuid())
  promotionId    String
  userId         String?
  userName       String
  promotionName  String
  finalReturnPct Decimal  @db.Decimal(9, 6)
  finalPnlEur    Decimal  @db.Decimal(18, 2)
  finalRank      Int
  closedAt       DateTime
  createdAt      DateTime @default(now())

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)
  user      User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@unique([promotionId, userId])
  @@index([finalReturnPct])
}
```

Relations inverses ajoutées sur `Promotion` (`hallOfFameEntries HallOfFameEntry[]`) et `User` (`hallOfFameEntries HallOfFameEntry[]`).

- `userId` nullable + `SetNull` : supprimer un compte ne détruit pas l'historique ; `userName`/`promotionName` dénormalisés le rendent lisible sans jointure.
- `@@unique([promotionId, userId])` : idempotence de l'upsert. (Note Postgres : `NULL` n'entre pas en conflit dans un index unique — non bloquant, un `userId` null ne survient qu'après suppression de compte, après écriture initiale.)
- Migration : **création de table + FK uniquement**. Nom : `20260828xxxxxx_hall_of_fame_entry`. Appliquée en prod par `prisma migrate deploy` au build (voir note P1002 dans la mémoire projet — relancer le build si lock).
- Backfill : aucun (0 promotion `CLOSED`). Le concours actuel remplit la table à 11:00.

### 4. `src/lib/gamification/hall-of-fame.ts` — réécrit

```ts
export interface HallOfFameEntryView {
  promotionId: string; promotionName: string;
  userId: string | null; userName: string;
  finalReturnPct: number; finalPnlEur: number; finalRank: number;
  closedAt: Date;
}
export interface HallOfFameData {
  entries: HallOfFameEntryView[];           // trié finalReturnPct desc — meilleures perfs all-time
  seasons: {                                // groupé par promotion, endDate desc
    promotionId: string; promotionName: string; closedAt: Date;
    podium: HallOfFameEntryView[];          // finalRank 1..3
  }[];
  participations: { userName: string; count: number; bestReturnPct: number }[];
}
export async function getHallOfFame(): Promise<HallOfFameData>
export const getCachedHallOfFame = unstable_cache(getHallOfFame, ["hall-of-fame"], { revalidate: 3600, tags: ["hall-of-fame"] });
```

Lecture unique de `HallOfFameEntry`, tri/agrégation en mémoire. `pick-winner.ts` conservé (utilisé par les badges close-only) mais retiré de `hall-of-fame.ts` et de `hall-of-fame/page.tsx`.

### 5. `/resultats` — `src/app/resultats/page.tsx` (nouveau)

- Server component. `verifySession` → `user.promotionId`. Charge la `Promotion` ; si `status !== CLOSED` → `redirect("/dashboard")`.
- Données : `db.hallOfFameEntry.findMany({ where: { promotionId }, orderBy: { finalRank: "asc" } })` — **figé, jamais recalculé**.
- Contenu : bandeau « 🏆 CONCOURS TERMINÉ », podium top 3 (composant `ResultsPodium`, animations CSS `@keyframes` + `motion-reduce:animate-none`), carte vainqueur (nom + `finalReturnPct` + `finalPnlEur`), carte « Votre résultat » (rang + perf du joueur connecté), table complète.
- Design : réutilise `Card`, `Badge`, `UserAvatar`, `medals`, tokens `text-gain`/`text-loss`. Pas de dépendance nouvelle.
- Lien retour « Voir mon portefeuille (figé) » → `/dashboard`.

### 6. Redirection & gel de l'UI participant

- `/dashboard` : après `verifySession`, si `user.promotionId` pointe une promotion `CLOSED` **et** cookie `seen_results_<promotionId>` absent → `redirect("/resultats")`. La page `/resultats` pose le cookie (`cookies().set`, 1 an, httpOnly false pour lecture serveur simple / ou via server action). Sinon : bannière `<ContestEndedBanner>` en haut du dashboard renvoyant vers `/resultats`. Portefeuille affiché en lecture seule (le `BuyForm` et les cartes position masquent déjà leurs actions quand aucune session n'est ouverte — vérifier ; sinon ajouter un garde `promotionClosed`).
- `/leaderboard` : si promotion `CLOSED` → afficher le classement **figé** construit depuis `HallOfFameEntry` (nouveau chemin `getFrozenLeaderboard(promotionId)`), badge « Classement final », pas d'`AutoRefresh`.

### 7. Date + heure pour les futurs concours

| Fichier | Changement |
|---|---|
| `src/app/admin/promotions/promotion-form-fields.tsx` | `startDate`/`endDate` : `type="date"` → `type="datetime-local"` ; `defaults` reçoit des valeurs `toParisDateTimeLocalValue` |
| `src/app/admin/promotions/schema.ts` | `startDate`/`endDate` : `z.coerce.date()` → `parisDateTimeLocalSchema` (importé de `@/lib/timezone`) |
| `src/app/admin/promotions/[id]/parametres/promotion-settings-form.tsx` | idem `datetime-local` |
| `src/app/admin/promotions/[id]/parametres/schema.ts` | idem `parisDateTimeLocalSchema` |
| `src/app/admin/promotions/[id]/parametres/promotion-settings-form.tsx` (défauts) | préremplir via `toParisDateTimeLocalValue(promotion.startDate/endDate)` |
| `src/components/rules-document.tsx` | nouvelle `SectionCard` « Calendrier du concours » en tête : **Début** `formatParisDateTimeLong(startDate)`, **Fin** `formatParisDateTimeLong(endDate)`. Badge d'en-tête : `formatParisDateTime` au lieu de `formatParisDate`. |
| `src/lib/timezone.ts` | ajout `formatParisDateTimeLong` → `"12 septembre 2026 à 09h00"` (`Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" })` retravaillé pour le `à ...h..`) |

Rétrocompat : les promotions existantes ont déjà un `endDate` `DateTime` complet — l'input `datetime-local` prérempli affichera juste l'heure (02:00 pour l'actuel, 11:00 après ajustement).

### 8. Concours actuel

`endDate` → `2026-08-28T09:00:00Z` via l'écran **Paramètres** admin (un champ, chemin `updatePromotionSettings` existant, avec ses avertissements d'impact). À défaut d'accès admin immédiat : script ponctuel `tsx` en scratchpad (lecture/écriture d'un seul champ). Aucune autre donnée touchée. `closePromotionIfEnded` clôture au premier hit après 11:00.

## Idempotence — récapitulatif (§8 de la demande)

| Effet | Garde |
|---|---|
| Transition de statut | `updateMany` conditionnel `status: ACTIVE` — `count` détermine le gagnant unique |
| Snapshot final | pas de création si snapshot `timestamp === endDate` déjà présent pour le portefeuille |
| Sessions fermées | `updateMany` — no-op si déjà `CLOSED` |
| Badges close-only | `upsert` sur `userId_badgeId_promotionId`, `update: {}` |
| Hall of Fame | `upsert` sur `promotionId_userId`, `update: {}` (jamais de modification d'une entrée existante) |
| Caches | `updateTag` idempotent |

## Tests

- `promotion-lifecycle.test.ts` : `closePromotionIfEnded` avant `endDate` = no-op ; après = `{ closed: true }` une seule fois, deuxième appel `{ closed: false }` ; sessions fermées ; entrées HoF créées une seule fois (double appel).
- `hall-of-fame.test.ts` : réécrit pour la nouvelle forme (tri par perf, podium par saison, une personne = N entrées non fusionnées).
- `timezone.test.ts` : `formatParisDateTimeLong`.
- `rules-document` : section calendrier rendue avec date + heure.
- Schémas `datetime-local` : valeur valide acceptée, `type="date"` (sans heure) rejetée.

## Ordre d'implémentation

1. Migration `HallOfFameEntry` + `prisma generate`.
2. `promotion-lifecycle.ts` + `snapshotOnePromotion` extrait + tests.
3. Câblage des déclencheurs (pages participant, cron, action trading) + `setPromotionStatus` réécrit.
4. `hall-of-fame.ts` réécrit + page `/hall-of-fame` + tests.
5. `/resultats` + `ResultsPodium` + redirection dashboard + cookie.
6. `/leaderboard` figé quand `CLOSED`.
7. `datetime-local` + schémas + `formatParisDateTimeLong` + règlement.
8. Ajustement `endDate` du concours actuel à 11:00 Paris.
9. `npm test`, `npm run lint`, `npx tsc --noEmit`, vérif manuelle.
