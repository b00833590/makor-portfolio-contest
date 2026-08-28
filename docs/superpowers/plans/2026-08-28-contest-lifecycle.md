# Fin de concours automatique + Hall of Fame historisé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clôturer automatiquement un concours à sa date+heure de fin, figer son classement final, alimenter un Hall of Fame historisé, et donner date+heure obligatoires aux futurs concours.

**Architecture:** Nouveau module `promotion-lifecycle.ts` avec une transition de statut atomique idempotente (`updateMany` conditionnel) et une finalisation rejouable. Déclenché paresseusement depuis les pages participant + l'action de trading + en filet de sécurité depuis le cron nocturne existant (aucun nouveau cron). Nouvelle table `HallOfFameEntry` (migration additive) qui devient la seule source de vérité du Hall of Fame et de la page `/resultats`.

**Tech Stack:** Next.js 16 (App Router, RSC, server actions), React 19, Prisma 7 + Postgres (Supabase), Vitest 4 (tests unitaires avec `vi.mock("@/lib/db")`), Tailwind v4, shadcn-style UI dans `src/components/ui`.

## Global Constraints

- **AGENTS.md** : ce Next.js a des breaking changes — consulter `node_modules/next/dist/docs/` avant d'écrire du code Next nouveau (routing, `cookies()`, `revalidate`).
- **Fuseau** : toute date/heure saisie ou affichée passe par `src/lib/timezone.ts` (Europe/Paris). Jamais `new Date(string)` ni `toLocaleString` sans `timeZone`.
- **Migrations** : additives uniquement. Aucune migration destructive, aucun `prisma migrate dev` contre la base de `.env` (prod Supabase) — écrire le SQL à la main puis `prisma migrate deploy`. Précédent dans le repo : `20260807130000_position_unique_open_per_asset`.
- **Immutabilité** : pas de mutation en place (spread pour les copies).
- **Tests** : pattern existant = `vi.mock("@/lib/db", () => ({ db: dbMock }))` avec `dbMock` objet de `vi.fn()`, `const { x } = await import("./module")` après le mock. Pas de vraie DB en test.
- **Pas de `console.log`** en code livré.
- **Idempotence** : toute étape de clôture doit pouvoir être rejouée sans créer de doublon ni modifier un résultat déjà écrit.
- Commits fréquents, format `<type>: <description>` (feat/fix/refactor/test/chore), finir par `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Vérif finale : `npm test`, `npm run lint`, `npx tsc --noEmit` doivent passer.

---

## File Structure

**Créés :**
- `prisma/migrations/20260828120000_hall_of_fame_entry/migration.sql` — création table `HallOfFameEntry`
- `src/lib/promotion-lifecycle.ts` — transition de statut atomique + finalisation
- `src/lib/promotion-lifecycle.test.ts`
- `src/app/resultats/page.tsx` — page de fin de concours
- `src/app/resultats/results-podium.tsx` — podium client animé
- `src/app/resultats/mark-seen.ts` — server action posant le cookie "résultats vus"
- `src/lib/gamification/frozen-leaderboard.ts` — classement figé depuis `HallOfFameEntry`
- `src/components/contest-ended-banner.tsx` — bannière dashboard

**Modifiés :**
- `prisma/schema.prisma` — modèle `HallOfFameEntry` + relations inverses
- `src/lib/timezone.ts` — `formatParisDateTimeLong`
- `src/lib/gamification/hall-of-fame.ts` — réécrit sur `HallOfFameEntry`
- `src/lib/gamification/hall-of-fame.test.ts` — réécrit
- `src/app/hall-of-fame/page.tsx` — nouvelle forme de données
- `src/app/admin/promotions/actions.ts` — `setPromotionStatus` délègue à `finalizePromotionClosure`
- `src/app/api/cron/snapshot-portfolios/route.ts` — filet de sécurité de clôture en tête
- `src/app/dashboard/page.tsx` — trigger + redirection `/resultats` + gel UI
- `src/app/dashboard/actions.ts` — trigger avant `executeOrder` (helper partagé)
- `src/app/leaderboard/page.tsx` — trigger + classement figé si `CLOSED`
- `src/app/reglement/page.tsx` — trigger
- `src/app/dashboard/buy-form.tsx` + `position-card.tsx` — masquer les actions si concours clos
- `src/app/admin/promotions/promotion-form-fields.tsx` — `datetime-local`
- `src/app/admin/promotions/schema.ts` — `parisDateTimeLocalSchema`
- `src/app/admin/promotions/[id]/parametres/promotion-settings-form.tsx` — `datetime-local`
- `src/app/admin/promotions/[id]/parametres/schema.ts` — `parisDateTimeLocalSchema`
- `src/app/admin/promotions/[id]/parametres/page.tsx` — préremplissage `toParisDateTimeLocalValue`
- `src/app/admin/promotions/promotion-form.tsx` — défauts start/end
- `src/components/rules-document.tsx` — section « Calendrier du concours » avec heure

---

## Phase 1 — Table `HallOfFameEntry`

### Task 1 : Migration + modèle Prisma

**Files:**
- Create: `prisma/migrations/20260828120000_hall_of_fame_entry/migration.sql`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modèle Prisma `HallOfFameEntry` avec champs `id, promotionId, userId?, userName, promotionName, finalReturnPct: Decimal, finalPnlEur: Decimal, finalRank: Int, closedAt: DateTime, createdAt: DateTime` ; contrainte `@@unique([promotionId, userId])`.

- [ ] **Step 1 : Écrire le SQL de migration**

`prisma/migrations/20260828120000_hall_of_fame_entry/migration.sql` :

```sql
-- CreateTable
CREATE TABLE "HallOfFameEntry" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "promotionName" TEXT NOT NULL,
    "finalReturnPct" DECIMAL(9,6) NOT NULL,
    "finalPnlEur" DECIMAL(18,2) NOT NULL,
    "finalRank" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFameEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameEntry_promotionId_userId_key" ON "HallOfFameEntry"("promotionId", "userId");

-- CreateIndex
CREATE INDEX "HallOfFameEntry_finalReturnPct_idx" ON "HallOfFameEntry"("finalReturnPct");

-- AddForeignKey
ALTER TABLE "HallOfFameEntry" ADD CONSTRAINT "HallOfFameEntry_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameEntry" ADD CONSTRAINT "HallOfFameEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 2 : Ajouter le modèle au schéma**

Dans `prisma/schema.prisma`, après le modèle `AuditLog` :

```prisma
/// Historique figé des concours terminés — une ligne par participation à une
/// promotion CLOSED, écrite une seule fois à la clôture (voir
/// src/lib/promotion-lifecycle.ts). Jamais recalculée : contrairement à
/// getLeaderboard, la performance n'y bouge plus au gré du marché. Une même
/// personne apparaît autant de fois qu'elle a participé à des concours
/// terminés — les entrées ne sont jamais fusionnées.
model HallOfFameEntry {
  id             String   @id @default(cuid())
  promotionId    String
  /// SetNull : supprimer un compte ne détruit pas l'historique. userName /
  /// promotionName sont dénormalisés pour rester lisibles sans jointure.
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

Ajouter la relation inverse sur `model Promotion` (après `userBadges UserBadge[]`) :
```prisma
  hallOfFameEntries HallOfFameEntry[]
```
Ajouter la relation inverse sur `model User` (après `auditLogs AuditLog[]`) :
```prisma
  hallOfFameEntries HallOfFameEntry[]
```

- [ ] **Step 3 : Générer le client Prisma**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` sans erreur ; `src/generated/prisma/` contient `HallOfFameEntry`.

- [ ] **Step 4 : Appliquer la migration à la base**

Run: `npx prisma migrate deploy`
Expected: `Applying migration 20260828120000_hall_of_fame_entry` puis `All migrations have been successfully applied.`
(Si erreur de lock advisory P1002 : relancer la commande — voir `docs/superpowers/` mémoire projet.)

- [ ] **Step 5 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260828120000_hall_of_fame_entry
git commit -m "feat: add HallOfFameEntry table for frozen contest history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 2 — Module de cycle de vie

### Task 2 : `formatParisDateTimeLong`

**Files:**
- Modify: `src/lib/timezone.ts`
- Test: `src/lib/timezone.test.ts`

**Interfaces:**
- Produces: `formatParisDateTimeLong(date: Date): string` → `"12 septembre 2026 à 09h00"`.

- [ ] **Step 1 : Écrire le test**

Ajouter dans `src/lib/timezone.test.ts` :

```ts
import { formatParisDateTimeLong } from "./timezone";

describe("formatParisDateTimeLong", () => {
  it("formate un instant UTC en date longue + heure de Paris (été, UTC+2)", () => {
    expect(formatParisDateTimeLong(new Date("2026-09-12T07:00:00Z"))).toBe("12 septembre 2026 à 09h00");
  });

  it("formate en hiver (UTC+1)", () => {
    expect(formatParisDateTimeLong(new Date("2026-01-15T17:30:00Z"))).toBe("15 janvier 2026 à 18h30");
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npm test -- src/lib/timezone.test.ts`
Expected: FAIL — `formatParisDateTimeLong is not a function`.

- [ ] **Step 3 : Implémenter**

Ajouter dans `src/lib/timezone.ts` (après `formatParisDate`) :

```ts
/**
 * Date longue + heure au format français « 12 septembre 2026 à 09h00 »,
 * en heure de Paris quel que soit le fuseau du serveur — pour le règlement.
 */
export function formatParisDateTimeLong(date: Date): string {
  const day = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const time = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: PARIS_TIME_ZONE,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${day} à ${time.hour}h${time.minute}`;
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npm test -- src/lib/timezone.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/timezone.ts src/lib/timezone.test.ts
git commit -m "feat: add formatParisDateTimeLong for rules document

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 3 : `closePromotionIfEnded` + `finalizePromotionClosure`

**Files:**
- Create: `src/lib/promotion-lifecycle.ts`
- Test: `src/lib/promotion-lifecycle.test.ts`

**Interfaces:**
- Consumes:
  - `db.promotion.updateMany`, `db.promotion.findUniqueOrThrow`, `db.changeSession.updateMany`, `db.portfolio.findMany`, `db.hallOfFameEntry.upsert` (Prisma)
  - `getLeaderboard(promotionId: string, now?: Date): Promise<LeaderboardRow[]>` de `@/lib/gamification/get-leaderboard` — `LeaderboardRow` a `{ userId, name, portfolioId, totalValue, cumulativeReturnPct, rank }`
  - `awardCloseOnlyBadges(promotionId: string, now?: Date): Promise<{ userId: string; code: string }[]>` de `@/lib/gamification/award-close-only-badges`
  - `PromotionStatus` de `@/generated/prisma/enums`
  - `updateTag`, `revalidatePath` de `next/cache`
- Produces:
  - `closePromotionIfEnded(promotionId: string, now?: Date): Promise<{ closed: boolean }>`
  - `finalizePromotionClosure(promotionId: string): Promise<void>`
  - `closeEndedPromotions(now?: Date): Promise<string[]>` (renvoie les ids clôturés — pour le cron)

- [ ] **Step 1 : Écrire les tests**

`src/lib/promotion-lifecycle.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionStatus } from "@/generated/prisma/enums";

const dbMock = {
  promotion: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
  changeSession: { updateMany: vi.fn() },
  hallOfFameEntry: { upsert: vi.fn() },
};
const getLeaderboardMock = vi.fn();
const awardCloseOnlyBadgesMock = vi.fn();
const updateTagMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/gamification/get-leaderboard", () => ({ getLeaderboard: getLeaderboardMock }));
vi.mock("@/lib/gamification/award-close-only-badges", () => ({ awardCloseOnlyBadges: awardCloseOnlyBadgesMock }));
vi.mock("next/cache", () => ({ updateTag: updateTagMock, revalidatePath: revalidatePathMock }));

const { closePromotionIfEnded } = await import("./promotion-lifecycle");

const END = new Date("2026-08-28T11:00:00Z"); // 13:00 Paris — endDate du concours
const PROMO = {
  id: "promo-1",
  name: "Promotion Août 2026",
  status: PromotionStatus.CLOSED,
  endDate: END,
  initialCapital: 1_000_000,
};

function resetMocks() {
  Object.values(dbMock).forEach((g) => Object.values(g).forEach((fn) => fn.mockReset()));
  [getLeaderboardMock, awardCloseOnlyBadgesMock, updateTagMock, revalidatePathMock].forEach((fn) => fn.mockReset());
  dbMock.promotion.findUniqueOrThrow.mockResolvedValue(PROMO);
  dbMock.changeSession.updateMany.mockResolvedValue({ count: 0 });
  dbMock.hallOfFameEntry.upsert.mockResolvedValue({});
  awardCloseOnlyBadgesMock.mockResolvedValue([]);
  getLeaderboardMock.mockResolvedValue([
    { userId: "u1", name: "Alice", portfolioId: "p1", totalValue: 1_120_000, cumulativeReturnPct: 12, rank: 1 },
    { userId: "u2", name: "Bob", portfolioId: "p2", totalValue: 980_000, cumulativeReturnPct: -2, rank: 2 },
  ]);
}
beforeEach(resetMocks);

describe("closePromotionIfEnded", () => {
  it("ne fait rien si la garde atomique ne transitionne pas (count 0)", async () => {
    dbMock.promotion.updateMany.mockResolvedValue({ count: 0 });
    const result = await closePromotionIfEnded("promo-1", new Date("2026-08-28T08:00:00Z"));
    expect(result).toEqual({ closed: false });
    expect(dbMock.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: "promo-1", status: PromotionStatus.ACTIVE, endDate: { lte: new Date("2026-08-28T08:00:00Z") } },
      data: { status: PromotionStatus.CLOSED },
    });
    expect(getLeaderboardMock).not.toHaveBeenCalled();
  });

  it("finalise une seule fois quand la garde transitionne (count 1)", async () => {
    dbMock.promotion.updateMany.mockResolvedValue({ count: 1 });
    const result = await closePromotionIfEnded("promo-1", new Date("2026-08-28T10:30:00Z"));
    expect(result).toEqual({ closed: true });
    expect(getLeaderboardMock).toHaveBeenCalledWith("promo-1", END);
    expect(awardCloseOnlyBadgesMock).toHaveBeenCalledWith("promo-1", END);
    expect(dbMock.changeSession.updateMany).toHaveBeenCalledWith({
      where: { promotionId: "promo-1", status: { not: PromotionStatus.CLOSED } },
      data: { status: PromotionStatus.CLOSED },
    });
  });

  it("écrit une entrée Hall of Fame figée par participant (upsert update:{})", async () => {
    dbMock.promotion.updateMany.mockResolvedValue({ count: 1 });
    await closePromotionIfEnded("promo-1", new Date("2026-08-28T10:30:00Z"));
    expect(dbMock.hallOfFameEntry.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.hallOfFameEntry.upsert).toHaveBeenCalledWith({
      where: { promotionId_userId: { promotionId: "promo-1", userId: "u1" } },
      update: {},
      create: {
        promotionId: "promo-1",
        userId: "u1",
        userName: "Alice",
        promotionName: "Promotion Août 2026",
        finalReturnPct: 12,
        finalPnlEur: 120_000,
        finalRank: 1,
        closedAt: END,
      },
    });
  });

  it("invalide les caches hall-of-fame et leaderboard", async () => {
    dbMock.promotion.updateMany.mockResolvedValue({ count: 1 });
    await closePromotionIfEnded("promo-1", new Date("2026-08-28T10:30:00Z"));
    expect(updateTagMock).toHaveBeenCalledWith("hall-of-fame");
    expect(updateTagMock).toHaveBeenCalledWith("leaderboard");
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npm test -- src/lib/promotion-lifecycle.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implémenter**

`src/lib/promotion-lifecycle.ts` :

```ts
import "server-only";
import { updateTag, revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { awardCloseOnlyBadges } from "@/lib/gamification/award-close-only-badges";

/**
 * Clôt une promotion si sa date+heure de fin est atteinte. Idempotent et
 * sûr en concurrence : la transition ACTIVE → CLOSED est un `updateMany`
 * conditionnel unique — `count` (0 ou 1) indique si CET appel a réalisé la
 * transition. Seul l'appel gagnant lance la finalisation. Un appel
 * ultérieur (ou concurrent perdant) voit `count: 0` et ne touche à rien.
 */
export async function closePromotionIfEnded(
  promotionId: string,
  now: Date = new Date(),
): Promise<{ closed: boolean }> {
  const { count } = await db.promotion.updateMany({
    where: { id: promotionId, status: PromotionStatus.ACTIVE, endDate: { lte: now } },
    data: { status: PromotionStatus.CLOSED },
  });
  if (count === 0) return { closed: false };

  await finalizePromotionClosure(promotionId);
  return { closed: true };
}

/**
 * Écrit le résultat officiel définitif d'une promotion clôturée. Rejouable
 * sans effet : chaque étape est idempotente (updateMany no-op, upsert
 * `update: {}`, awardCloseOnlyBadges upsert). Horodaté à `endDate` — pas à
 * l'instant réel du déclenchement — pour que le classement final soit le
 * même quel que soit le moment où la clôture est constatée.
 */
export async function finalizePromotionClosure(promotionId: string): Promise<void> {
  const promotion = await db.promotion.findUniqueOrThrow({ where: { id: promotionId } });
  const endDate = promotion.endDate;
  const initialCapital = Number(promotion.initialCapital);

  // Ferme toute session de changement encore ouverte (auto ou forcée par l'admin).
  await db.changeSession.updateMany({
    where: { promotionId, status: { not: PromotionStatus.CLOSED } },
    data: { status: PromotionStatus.CLOSED },
  });

  // Classement final, calculé une fois, avec la même logique de rang que
  // partout ailleurs (rankEntries via getLeaderboard).
  const finalRows = await getLeaderboard(promotionId, endDate);

  // Badges de fin de concours (superlatifs + conditions "tout le concours").
  await awardCloseOnlyBadges(promotionId, endDate);

  // Historique figé — une entrée par participant, jamais modifiée si elle existe.
  for (const row of finalRows) {
    await db.hallOfFameEntry.upsert({
      where: { promotionId_userId: { promotionId, userId: row.userId } },
      update: {},
      create: {
        promotionId,
        userId: row.userId,
        userName: row.name,
        promotionName: promotion.name,
        finalReturnPct: row.cumulativeReturnPct,
        finalPnlEur: row.totalValue - initialCapital,
        finalRank: row.rank,
        closedAt: endDate,
      },
    });
  }

  updateTag("hall-of-fame");
  updateTag("leaderboard");
  revalidatePath("/hall-of-fame");
  revalidatePath("/leaderboard");
  revalidatePath("/resultats");
}

/**
 * Balaie toutes les promotions dont la fin est atteinte mais qui sont
 * encore ACTIVE — filet de sécurité appelé par le cron nocturne. Renvoie
 * les ids effectivement clôturés.
 */
export async function closeEndedPromotions(now: Date = new Date()): Promise<string[]> {
  const candidates = await db.promotion.findMany({
    where: { status: PromotionStatus.ACTIVE, endDate: { lte: now } },
    select: { id: true },
  });
  const closed: string[] = [];
  for (const candidate of candidates) {
    const result = await closePromotionIfEnded(candidate.id, now);
    if (result.closed) closed.push(candidate.id);
  }
  return closed;
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npm test -- src/lib/promotion-lifecycle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/promotion-lifecycle.ts src/lib/promotion-lifecycle.test.ts
git commit -m "feat: idempotent automatic promotion closure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 3 — Câblage des déclencheurs

### Task 4 : `setPromotionStatus` délègue à la finalisation partagée

**Files:**
- Modify: `src/app/admin/promotions/actions.ts:130-167`
- Test: `src/app/admin/promotions/actions.test.ts` (créer si absent — sinon test manuel documenté ci-dessous)

**Interfaces:**
- Consumes: `finalizePromotionClosure(promotionId)` de `@/lib/promotion-lifecycle`.

- [ ] **Step 1 : Remplacer le bloc CLOSED**

Dans `src/app/admin/promotions/actions.ts`, remplacer :

```ts
  let closeOnlyBadgesAwarded: number | undefined;
  if (status === PromotionStatus.CLOSED) {
    closeOnlyBadgesAwarded = (await awardCloseOnlyBadges(promotionId)).length;
    updateTag("hall-of-fame");
    revalidatePath("/hall-of-fame");
  }
```

par :

```ts
  if (status === PromotionStatus.CLOSED) {
    // Clôture manuelle par l'admin : même chemin exact que la clôture
    // automatique (voir src/lib/promotion-lifecycle.ts). `updateMany`
    // ci-dessus a déjà passé le statut à CLOSED ; on lance la finalisation.
    await finalizePromotionClosure(promotionId);
  }
```

Mettre à jour les imports en tête du fichier : retirer `awardCloseOnlyBadges` s'il n'est plus utilisé ailleurs dans le fichier, ajouter :
```ts
import { finalizePromotionClosure } from "@/lib/promotion-lifecycle";
```
Retirer `closeOnlyBadgesAwarded` de l'objet `after` du `logAudit`.

- [ ] **Step 2 : Vérifier compilation + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur (attention aux imports devenus inutilisés `updateTag`/`awardCloseOnlyBadges` — les retirer si c'est le cas).

- [ ] **Step 3 : Test manuel documenté**

Démarrer `npm run dev`, se connecter admin, créer une promotion de test avec `endDate` passée, la passer ACTIVE puis CLOSED : vérifier qu'une entrée apparaît dans `/hall-of-fame`. (Ne pas toucher « Promotion Août 2026 ».)

- [ ] **Step 4 : Commit**

```bash
git add src/app/admin/promotions/actions.ts
git commit -m "refactor: route manual promotion close through finalizePromotionClosure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 5 : Filet de sécurité dans le cron nocturne

**Files:**
- Modify: `src/app/api/cron/snapshot-portfolios/route.ts`

**Interfaces:**
- Consumes: `closeEndedPromotions(now?: Date): Promise<string[]>`.

- [ ] **Step 1 : Ajouter l'appel en tête**

Dans `src/app/api/cron/snapshot-portfolios/route.ts`, juste avant `const snapshotResults = await snapshotActivePromotions();` :

```ts
  // Filet de sécurité : si aucun participant ne s'est connecté après la fin
  // d'un concours, la clôture n'a pas eu lieu au fil de l'eau — on la
  // rattrape ici avant le snapshot du soir. Idempotent.
  const autoClosed = await closeEndedPromotions();
```

Ajouter à l'import : `import { closeEndedPromotions } from "@/lib/promotion-lifecycle";`
Ajouter `autoClosed` à la réponse JSON : `return NextResponse.json({ autoClosed, snapshotResults, badgeResults: badgeResults.flat() });`

- [ ] **Step 2 : Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/app/api/cron/snapshot-portfolios/route.ts
git commit -m "feat: auto-close ended promotions from the nightly cron as a backstop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 6 : Trigger paresseux sur les pages participant + action de trading

**Files:**
- Modify: `src/app/dashboard/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/reglement/page.tsx`, `src/app/dashboard/actions.ts`

**Interfaces:**
- Consumes: `closePromotionIfEnded(promotionId: string): Promise<{ closed: boolean }>`.
- Produces: après chargement d'une de ces pages / soumission d'un ordre par un participant dont le concours est fini, le statut est `CLOSED` et le Hall of Fame est rempli.

- [ ] **Step 1 : Dashboard**

Dans `src/app/dashboard/page.tsx`, après avoir résolu `session` et avant `getCachedPortfolioView`, charger la promotion de l'utilisateur et déclencher la clôture :

```ts
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { promotionId: true },
  });
  if (dbUser?.promotionId) {
    await closePromotionIfEnded(dbUser.promotionId);
  }
```

Imports à ajouter : `import { db } from "@/lib/db";` (si absent), `import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";`.

(La redirection vers `/resultats` est ajoutée en Task 10 — ici on ne fait que déclencher la clôture.)

- [ ] **Step 2 : Leaderboard**

Dans `src/app/leaderboard/page.tsx`, juste après `const user = await db.user.findUnique(...)` et le garde `if (!user?.promotionId)` :

```ts
  await closePromotionIfEnded(user.promotionId);
```

Import : `import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";`.

- [ ] **Step 3 : Règlement**

Dans `src/app/reglement/page.tsx`, après avoir résolu `user` (qui a `promotionId`) et avant de charger `promotion` :

```ts
  if (user.promotionId) {
    await closePromotionIfEnded(user.promotionId);
  }
```

Import identique.

- [ ] **Step 4 : Action de trading (helper partagé)**

Dans `src/app/dashboard/actions.ts`, ajouter en tête un helper puis l'appeler dans les 4 actions avant `executeOrder` :

```ts
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { db } from "@/lib/db";

/** Constate une éventuelle fin de concours avant d'exécuter un ordre —
 *  garantit que executeOrder verra le statut CLOSED et refusera proprement. */
async function ensureContestFreshness(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { promotionId: true } });
  if (user?.promotionId) await closePromotionIfEnded(user.promotionId);
}
```

Dans `buyAsset`, `increasePosition`, `sellPartial`, `sellFull` : ajouter `await ensureContestFreshness(session.user.id);` juste après `const session = await verifySession();`. (Le refus « Le concours n'est pas actif. » vient ensuite gratuitement de `validateOrder`.)

- [ ] **Step 5 : Vérifier compilation + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tout passe (les tests existants de `dashboard/actions` mockent `executeOrder` — vérifier qu'ils mockent aussi `@/lib/db` ou ajouter le mock `closePromotionIfEnded`).

- [ ] **Step 6 : Commit**

```bash
git add src/app/dashboard/page.tsx src/app/leaderboard/page.tsx src/app/reglement/page.tsx src/app/dashboard/actions.ts
git commit -m "feat: lazily close ended contests on participant page loads and trades

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 4 — Hall of Fame historisé

### Task 7 : Réécrire `getHallOfFame` sur `HallOfFameEntry`

**Files:**
- Modify: `src/lib/gamification/hall-of-fame.ts`
- Test: `src/lib/gamification/hall-of-fame.test.ts` (réécrit)

**Interfaces:**
- Consumes: `db.hallOfFameEntry.findMany` (Prisma).
- Produces:
  ```ts
  interface HallOfFameEntryView {
    promotionId: string; promotionName: string;
    userId: string | null; userName: string;
    finalReturnPct: number; finalPnlEur: number; finalRank: number; closedAt: Date;
  }
  interface HallOfFameSeason {
    promotionId: string; promotionName: string; closedAt: Date;
    podium: HallOfFameEntryView[];
  }
  interface HallOfFameParticipation { userName: string; count: number; bestReturnPct: number; }
  interface HallOfFameData {
    entries: HallOfFameEntryView[];
    seasons: HallOfFameSeason[];
    participations: HallOfFameParticipation[];
  }
  export async function getHallOfFame(): Promise<HallOfFameData>
  export const getCachedHallOfFame: () => Promise<HallOfFameData>
  ```

- [ ] **Step 1 : Réécrire le test**

Remplacer intégralement `src/lib/gamification/hall-of-fame.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = { hallOfFameEntry: { findMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const { getHallOfFame } = await import("./hall-of-fame");

function entry(over: Partial<Record<string, unknown>>) {
  return {
    promotionId: "p1", promotionName: "Saison 1",
    userId: "u1", userName: "Alice",
    finalReturnPct: 10, finalPnlEur: 100_000, finalRank: 1,
    closedAt: new Date("2026-01-31T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => dbMock.hallOfFameEntry.findMany.mockReset());

describe("getHallOfFame", () => {
  it("trie les entrées par performance décroissante (meilleure perf de tous les temps en tête)", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      entry({ userName: "Alice", finalReturnPct: 8, promotionName: "Saison 1", promotionId: "p1" }),
      entry({ userName: "Bob", finalReturnPct: 22, promotionName: "Saison 2", promotionId: "p2", finalRank: 1 }),
      entry({ userName: "Alice", finalReturnPct: -3, promotionName: "Saison 2", promotionId: "p2", finalRank: 2 }),
    ]);
    const data = await getHallOfFame();
    expect(data.entries.map((e) => [e.userName, e.finalReturnPct])).toEqual([
      ["Bob", 22], ["Alice", 8], ["Alice", -3],
    ]);
  });

  it("garde une entrée distincte par participation — une même personne apparaît plusieurs fois", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      entry({ userName: "Alice", finalReturnPct: 12.4, promotionName: "Concours Septembre 2026", promotionId: "sep" }),
      entry({ userName: "Alice", finalReturnPct: -2.1, promotionName: "Concours Octobre 2026", promotionId: "oct" }),
    ]);
    const data = await getHallOfFame();
    expect(data.entries).toHaveLength(2);
    expect(data.participations).toEqual([{ userName: "Alice", count: 2, bestReturnPct: 12.4 }]);
  });

  it("regroupe les podiums par saison, saison la plus récente en premier", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 1, userName: "A", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p1", promotionName: "S1", finalRank: 4, userName: "D", closedAt: new Date("2026-01-31") }),
      entry({ promotionId: "p2", promotionName: "S2", finalRank: 1, userName: "E", closedAt: new Date("2026-03-31") }),
    ]);
    const data = await getHallOfFame();
    expect(data.seasons.map((s) => s.promotionName)).toEqual(["S2", "S1"]);
    expect(data.seasons[1].podium.map((e) => e.userName)).toEqual(["A"]); // rank 4 exclu
  });

  it("renvoie des listes vides quand rien n'est terminé", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([]);
    const data = await getHallOfFame();
    expect(data).toEqual({ entries: [], seasons: [], participations: [] });
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npm test -- src/lib/gamification/hall-of-fame.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Réécrire `hall-of-fame.ts`**

Remplacer intégralement `src/lib/gamification/hall-of-fame.ts` :

```ts
import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export interface HallOfFameEntryView {
  promotionId: string;
  promotionName: string;
  userId: string | null;
  userName: string;
  finalReturnPct: number;
  finalPnlEur: number;
  finalRank: number;
  closedAt: Date;
}

export interface HallOfFameSeason {
  promotionId: string;
  promotionName: string;
  closedAt: Date;
  podium: HallOfFameEntryView[];
}

export interface HallOfFameParticipation {
  userName: string;
  count: number;
  bestReturnPct: number;
}

export interface HallOfFameData {
  /** Toutes les participations, meilleure performance de tous les temps en tête. */
  entries: HallOfFameEntryView[];
  /** Podiums (rang 1-3) groupés par saison, la plus récente d'abord. */
  seasons: HallOfFameSeason[];
  /** Nombre de participations et meilleure perf par personne. */
  participations: HallOfFameParticipation[];
}

/**
 * Historique figé : lecture unique de HallOfFameEntry (écrite une seule fois
 * à la clôture de chaque promotion — voir src/lib/promotion-lifecycle.ts).
 * Aucun recalcul, la performance n'y bouge plus.
 */
export async function getHallOfFame(): Promise<HallOfFameData> {
  const rows = await db.hallOfFameEntry.findMany({ orderBy: { finalReturnPct: "desc" } });

  const entries: HallOfFameEntryView[] = rows.map((row) => ({
    promotionId: row.promotionId,
    promotionName: row.promotionName,
    userId: row.userId,
    userName: row.userName,
    finalReturnPct: Number(row.finalReturnPct),
    finalPnlEur: Number(row.finalPnlEur),
    finalRank: row.finalRank,
    closedAt: row.closedAt,
  }));

  const seasonMap = new Map<string, HallOfFameSeason>();
  for (const entry of entries) {
    let season = seasonMap.get(entry.promotionId);
    if (!season) {
      season = {
        promotionId: entry.promotionId,
        promotionName: entry.promotionName,
        closedAt: entry.closedAt,
        podium: [],
      };
      seasonMap.set(entry.promotionId, season);
    }
    if (entry.finalRank <= 3) season.podium.push(entry);
  }
  const seasons = [...seasonMap.values()]
    .map((season) => ({ ...season, podium: [...season.podium].sort((a, b) => a.finalRank - b.finalRank) }))
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());

  const participationMap = new Map<string, HallOfFameParticipation>();
  for (const entry of entries) {
    const current = participationMap.get(entry.userName);
    if (!current) {
      participationMap.set(entry.userName, {
        userName: entry.userName,
        count: 1,
        bestReturnPct: entry.finalReturnPct,
      });
    } else {
      participationMap.set(entry.userName, {
        userName: entry.userName,
        count: current.count + 1,
        bestReturnPct: Math.max(current.bestReturnPct, entry.finalReturnPct),
      });
    }
  }
  const participations = [...participationMap.values()].sort((a, b) => b.bestReturnPct - a.bestReturnPct);

  return { entries, seasons, participations };
}

/**
 * Mise en cache, tag `hall-of-fame` — invalidé uniquement à la clôture d'une
 * promotion (finalizePromotionClosure). La fenêtre de revalidation n'est
 * qu'un filet.
 */
export const getCachedHallOfFame = unstable_cache(getHallOfFame, ["hall-of-fame"], {
  revalidate: 3600,
  tags: ["hall-of-fame"],
});
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npm test -- src/lib/gamification/hall-of-fame.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/gamification/hall-of-fame.ts src/lib/gamification/hall-of-fame.test.ts
git commit -m "feat: historised Hall of Fame from frozen HallOfFameEntry rows

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 8 : Page `/hall-of-fame` sur la nouvelle forme

**Files:**
- Modify: `src/app/hall-of-fame/page.tsx`

**Interfaces:**
- Consumes: `getCachedHallOfFame(): Promise<HallOfFameData>`.

- [ ] **Step 1 : Réécrire la page**

Remplacer `src/app/hall-of-fame/page.tsx` (garder `SiteHeader`, `Card`, `Badge`, structure de conteneur `max-w-3xl`). Retirer l'import de `pickWinner`. Nouveau contenu :

```tsx
import { verifySession } from "@/lib/dal";
import { getCachedHallOfFame } from "@/lib/gamification/hall-of-fame";
import { formatParisDate } from "@/lib/timezone";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pctFmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const medals = ["🥇", "🥈", "🥉"];

export default async function HallOfFamePage() {
  const session = await verifySession();
  const { entries, seasons, participations } = await getCachedHallOfFame();
  const record = entries[0] ?? null;

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hall of Fame</h1>

        {record && (
          <Card className="mt-6 border-primary/40 bg-primary/5">
            <CardHeader><CardTitle>Record historique</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Meilleure performance jamais enregistrée :{" "}
              <span className="font-semibold text-foreground">{record.userName}</span> avec{" "}
              <span className="font-semibold text-gain">{pctFmt(record.finalReturnPct)}</span>{" "}
              lors de «&nbsp;{record.promotionName}&nbsp;».
            </CardContent>
          </Card>
        )}

        {entries.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Aucune saison terminée pour le moment — revenez à la fin du concours en cours.
          </p>
        )}

        {seasons.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Podiums par saison</h2>
            <div className="mt-4 flex flex-col gap-4">
              {seasons.map((season) => (
                <Card key={season.promotionId}>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{season.promotionName}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{formatParisDate(season.closedAt)}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1.5">
                    {season.podium.map((e) => (
                      <div key={e.userId ?? e.userName} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span>{medals[e.finalRank - 1]}</span>
                          <span className="font-medium">{e.userName}</span>
                        </span>
                        <span className={e.finalReturnPct >= 0 ? "text-gain tabular-nums" : "text-loss tabular-nums"}>
                          {pctFmt(e.finalReturnPct)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {entries.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Meilleures performances de tous les temps</h2>
            <Card className="mt-4">
              <CardContent className="flex flex-col gap-1.5 pt-6">
                {entries.map((e, i) => (
                  <div key={`${e.promotionId}-${e.userId ?? e.userName}`} className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
                    <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{e.userName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{e.promotionName}</span>
                    </span>
                    <span className={e.finalReturnPct >= 0 ? "text-gain tabular-nums" : "text-loss tabular-nums"}>
                      {pctFmt(e.finalReturnPct)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {participations.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Participations</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {participations.map((p) => (
                <Badge key={p.userName} variant="secondary">
                  {p.userName} · {p.count} concours · record {pctFmt(p.bestReturnPct)}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2 : Supprimer `pick-winner` s'il est devenu orphelin**

Run: `git grep -n "pick-winner\|pickWinner" src/`
Si les seuls résultats sont `src/lib/gamification/pick-winner.ts` et `pick-winner.test.ts` (plus aucun consommateur), les supprimer :
```bash
git rm src/lib/gamification/pick-winner.ts src/lib/gamification/pick-winner.test.ts
```
Sinon, laisser en place.

- [ ] **Step 3 : Vérifier compilation + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur. Vérifier qu'aucun fichier n'importe l'ancienne forme : `git grep -n "season.winner\|\.winner" src/` — ne doit plus rien retourner.

- [ ] **Step 4 : Commit**

```bash
git add -A src/app/hall-of-fame/page.tsx src/lib/gamification/
git commit -m "feat: rebuild Hall of Fame page on historised entries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 5 — Expérience de fin `/resultats`

### Task 9 : Classement figé + page `/resultats` + podium

**Files:**
- Create: `src/lib/gamification/frozen-leaderboard.ts`, `src/lib/gamification/frozen-leaderboard.test.ts`
- Create: `src/app/resultats/page.tsx`, `src/app/resultats/results-podium.tsx`, `src/app/resultats/mark-seen.ts`

**Interfaces:**
- Consumes: `db.hallOfFameEntry.findMany`, `verifySession`, `db.promotion.findUnique`, `db.user.findUnique`, `cookies()` de `next/headers`.
- Produces:
  - `getFrozenLeaderboard(promotionId: string): Promise<FrozenLeaderboardRow[]>` où `FrozenLeaderboardRow = { userId: string | null; userName: string; finalRank: number; finalReturnPct: number; finalPnlEur: number }`
  - route `/resultats`

- [ ] **Step 1 : Test du classement figé**

`src/lib/gamification/frozen-leaderboard.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = { hallOfFameEntry: { findMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ db: dbMock }));
const { getFrozenLeaderboard } = await import("./frozen-leaderboard");

beforeEach(() => dbMock.hallOfFameEntry.findMany.mockReset());

describe("getFrozenLeaderboard", () => {
  it("renvoie les entrées d'une promotion triées par rang final", async () => {
    dbMock.hallOfFameEntry.findMany.mockResolvedValue([
      { userId: "u2", userName: "Bob", finalRank: 2, finalReturnPct: -2, finalPnlEur: -20000 },
      { userId: "u1", userName: "Alice", finalRank: 1, finalReturnPct: 12, finalPnlEur: 120000 },
    ]);
    const rows = await getFrozenLeaderboard("p1");
    expect(dbMock.hallOfFameEntry.findMany).toHaveBeenCalledWith({
      where: { promotionId: "p1" },
      orderBy: { finalRank: "asc" },
    });
    expect(rows.map((r) => r.userName)).toEqual(["Alice", "Bob"]);
    expect(rows[0].finalReturnPct).toBe(12);
  });
});
```

- [ ] **Step 2 : Lancer → échec, puis implémenter**

`src/lib/gamification/frozen-leaderboard.ts` :

```ts
import "server-only";
import { db } from "@/lib/db";

export interface FrozenLeaderboardRow {
  userId: string | null;
  userName: string;
  finalRank: number;
  finalReturnPct: number;
  finalPnlEur: number;
}

/** Classement définitif d'une promotion clôturée, lu depuis l'historique figé. */
export async function getFrozenLeaderboard(promotionId: string): Promise<FrozenLeaderboardRow[]> {
  const rows = await db.hallOfFameEntry.findMany({
    where: { promotionId },
    orderBy: { finalRank: "asc" },
  });
  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName,
    finalRank: row.finalRank,
    finalReturnPct: Number(row.finalReturnPct),
    finalPnlEur: Number(row.finalPnlEur),
  }));
}
```

Run: `npm test -- src/lib/gamification/frozen-leaderboard.test.ts` → PASS.

- [ ] **Step 3 : Server action « résultats vus »**

`src/app/resultats/mark-seen.ts` :

```ts
"use server";
import { cookies } from "next/headers";

/** Mémorise (par appareil) que le participant a vu l'écran de résultats
 *  d'une saison — le dashboard cesse alors de rediriger vers /resultats. */
export async function markResultsSeen(promotionId: string): Promise<void> {
  const store = await cookies();
  store.set(`seen_results_${promotionId}`, "1", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}
```

- [ ] **Step 4 : Podium client animé**

`src/app/resultats/results-podium.tsx` :

```tsx
"use client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const medals = ["🥇", "🥈", "🥉"];
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export interface PodiumEntry {
  userName: string;
  finalRank: number;
  finalReturnPct: number;
  isSelf: boolean;
}

/** Podium 3 places, 2e-1er-3e visuellement, apparition en cascade (désactivée
 *  si prefers-reduced-motion). */
export function ResultsPodium({ entries }: { entries: PodiumEntry[] }) {
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {order.map((entry, i) => {
        const place = entry.finalRank;
        return (
          <div
            key={entry.userName}
            style={{ animationDelay: `${i * 140}ms` }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-4 text-center",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 motion-safe:fill-mode-backwards",
              place === 1 ? "border-primary/50 bg-primary/5 pb-8" : "pb-4",
              entry.isSelf && "ring-1 ring-primary",
            )}
          >
            <span className="text-3xl">{medals[place - 1]}</span>
            <UserAvatar name={entry.userName} avatarUrl={null} className="mt-1 size-11 text-base" />
            <p className="mt-1 text-sm font-medium">{entry.userName}</p>
            <p className={cn("text-base font-semibold tabular-nums", entry.finalReturnPct >= 0 ? "text-gain" : "text-loss")}>
              {pct(entry.finalReturnPct)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
```

(Vérifier que `tw-animate-css` fournit `animate-in`/`fade-in`/`slide-in-from-bottom` — c'est le cas, il est déjà utilisé dans le repo pour les dialogs. Sinon remplacer par une `@keyframes` locale dans `globals.css`.)

- [ ] **Step 5 : Page `/resultats`**

`src/app/resultats/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { formatParisDateTimeLong } from "@/lib/timezone";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ResultsPodium } from "./results-podium";
import { markResultsSeen } from "./mark-seen";

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function ResultatsPage() {
  const session = await verifySession();
  if (session.user.role === "ADMIN") redirect("/admin");

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { promotionId: true } });
  if (!user?.promotionId) redirect("/dashboard");

  const promotion = await db.promotion.findUnique({
    where: { id: user.promotionId },
    select: { id: true, name: true, endDate: true, status: true },
  });
  if (!promotion || promotion.status !== PromotionStatus.CLOSED) redirect("/dashboard");

  const rows = await getFrozenLeaderboard(promotion.id);
  if (rows.length === 0) redirect("/dashboard"); // finalisation pas encore écrite — le trigger la posera

  await markResultsSeen(promotion.id);

  const winner = rows[0];
  const me = rows.find((r) => r.userId === session.user.id) ?? null;
  const podium = rows.slice(0, 3).map((r) => ({
    userName: r.userName,
    finalRank: r.finalRank,
    finalReturnPct: r.finalReturnPct,
    isSelf: r.userId === session.user.id,
  }));

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-14">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {promotion.name} · terminé le {formatParisDateTimeLong(promotion.endDate)}
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">🏆 Concours terminé</h1>

        <Card className="mt-8 border-primary/40 bg-primary/5">
          <CardHeader><CardTitle className="text-center">Vainqueur</CardTitle></CardHeader>
          <CardContent className="text-center">
            <p className="text-xl font-semibold">{winner.userName}</p>
            <p className={winner.finalReturnPct >= 0 ? "text-gain text-lg font-semibold tabular-nums" : "text-loss text-lg font-semibold tabular-nums"}>
              {pct(winner.finalReturnPct)} <span className="text-sm font-normal text-muted-foreground">({eur.format(winner.finalPnlEur)})</span>
            </p>
          </CardContent>
        </Card>

        <div className="mt-8">
          <ResultsPodium entries={podium} />
        </div>

        {me && (
          <Card className="mt-8">
            <CardHeader><CardTitle>Votre résultat</CardTitle></CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {me.finalRank}<sup>{me.finalRank === 1 ? "er" : "e"}</sup> sur {rows.length}
              </span>
              <span className={me.finalReturnPct >= 0 ? "text-gain text-lg font-semibold tabular-nums" : "text-loss text-lg font-semibold tabular-nums"}>
                {pct(me.finalReturnPct)} <span className="text-sm font-normal text-muted-foreground">({eur.format(me.finalPnlEur)})</span>
              </span>
            </CardContent>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader><CardTitle>Classement final</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5 pt-2">
            {rows.map((r) => (
              <div
                key={r.userId ?? r.userName}
                className={r.userId === session.user.id
                  ? "flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 font-medium"
                  : "flex items-center justify-between gap-3 px-3 py-2"}
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 text-center tabular-nums text-muted-foreground">{r.finalRank}</span>
                  <span>{r.userName}</span>
                </span>
                <span className={r.finalReturnPct >= 0 ? "text-gain tabular-nums" : "text-loss tabular-nums"}>{pct(r.finalReturnPct)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/dashboard">Voir mon portefeuille (figé)</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
```

Ajouter `/resultats` aux `protectedPrefixes` de `src/proxy.ts`.

- [ ] **Step 6 : Vérifier compilation + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tout passe.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/gamification/frozen-leaderboard.ts src/lib/gamification/frozen-leaderboard.test.ts src/app/resultats src/proxy.ts
git commit -m "feat: /resultats end-of-contest experience with frozen final standings

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 10 : Redirection dashboard + gel de l'UI + bannière

**Files:**
- Create: `src/components/contest-ended-banner.tsx`
- Modify: `src/app/dashboard/page.tsx`, `src/app/dashboard/buy-form.tsx`, `src/app/dashboard/position-card.tsx`

**Interfaces:**
- Consumes: `cookies()` de `next/headers`, `PromotionStatus`.
- Produces: `<ContestEndedBanner />` ; prop `contestClosed?: boolean` sur `BuyForm` et `PositionCard`.

- [ ] **Step 1 : Bannière**

`src/components/contest-ended-banner.tsx` :

```tsx
import Link from "next/link";
import { Trophy } from "lucide-react";

export function ContestEndedBanner() {
  return (
    <Link
      href="/resultats"
      className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
    >
      <Trophy className="size-5 shrink-0 text-primary" />
      <span className="flex-1">
        <span className="font-medium text-foreground">Le concours est terminé.</span>{" "}
        <span className="text-muted-foreground">Votre portefeuille est figé — voir le classement final.</span>
      </span>
      <span className="shrink-0 font-medium text-primary">Résultats →</span>
    </Link>
  );
}
```

- [ ] **Step 2 : Dashboard — redirection + état clos**

Dans `src/app/dashboard/page.tsx`, après le trigger `closePromotionIfEnded` de Task 6, charger le statut de la promotion et gérer la redirection :

```ts
  const promotion = dbUser?.promotionId
    ? await db.promotion.findUnique({ where: { id: dbUser.promotionId }, select: { id: true, status: true } })
    : null;
  const contestClosed = promotion?.status === PromotionStatus.CLOSED;

  if (contestClosed) {
    const seen = (await cookies()).get(`seen_results_${promotion!.id}`);
    if (!seen) redirect("/resultats");
  }
```

Imports : `import { cookies } from "next/headers";`, `import { PromotionStatus } from "@/generated/prisma/enums";`, `redirect` déjà présent.

Dans le JSX : afficher `<ContestEndedBanner />` juste après le `<h1>` quand `contestClosed`, et remplacer les bannières de session (`isInitializationWindow` / `weeklySessionOpen` / `nextChangeSession`) par `null` quand `contestClosed` (le portefeuille est figé, aucune session ne compte). Passer `contestClosed` à `<BuyForm />` (via `<BuyForm contestClosed={contestClosed} />`) et à chaque `<PositionCard ... contestClosed={contestClosed} />`. Masquer complètement la carte « Nouvel achat » quand `contestClosed`.

- [ ] **Step 3 : `BuyForm` / `PositionCard` — masquer les actions**

`src/app/dashboard/buy-form.tsx` : ajouter `contestClosed?: boolean` aux props ; si `contestClosed`, `return null` (la carte parente est déjà masquée, c'est une double sécurité).

`src/app/dashboard/position-card.tsx` : ajouter `contestClosed?: boolean` ; quand vrai, ne pas rendre les `<form>` d'action (renforcer / vente partielle / vente totale) — afficher seulement les chiffres de la position.

- [ ] **Step 4 : Vérifier compilation + lint + build de pages**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 5 : Test manuel**

`npm run dev`, créer une promo de test `CLOSED` avec un participant de test → se connecter en participant → `/dashboard` redirige vers `/resultats` une fois, puis affiche la bannière et le portefeuille figé.

- [ ] **Step 6 : Commit**

```bash
git add src/components/contest-ended-banner.tsx src/app/dashboard/page.tsx src/app/dashboard/buy-form.tsx src/app/dashboard/position-card.tsx
git commit -m "feat: dashboard redirects to /resultats then freezes when contest closed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 11 : Classement figé sur `/leaderboard`

**Files:**
- Modify: `src/app/leaderboard/page.tsx`

- [ ] **Step 1 : Brancher le classement figé**

Dans `src/app/leaderboard/page.tsx`, après le trigger `closePromotionIfEnded` (Task 6), charger le statut :

```ts
  const promotion = await db.promotion.findUniqueOrThrow({
    where: { id: user.promotionId },
    select: { initialCapital: true, status: true, name: true, endDate: true },
  });
  const contestClosed = promotion.status === PromotionStatus.CLOSED;
```

Si `contestClosed` : ne pas rendre `<AutoRefresh />`, remplacer le contenu principal par un tableau construit depuis `getFrozenLeaderboard(user.promotionId)` avec un `<Badge>Classement final</Badge>` et la date de fin (`formatParisDateTimeLong(promotion.endDate)`). Réutiliser un rendu simple (mêmes classes que le tableau existant, colonnes Rang / Participant / Rendement). Garder le chemin live existant quand `!contestClosed`.

Imports : `getFrozenLeaderboard`, `PromotionStatus`, `formatParisDateTimeLong`.

- [ ] **Step 2 : Vérifier compilation + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/app/leaderboard/page.tsx
git commit -m "feat: freeze the leaderboard from HallOfFameEntry once the contest is closed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 6 — Date + heure pour les futurs concours

### Task 12 : Schémas admin en `parisDateTimeLocalSchema`

**Files:**
- Modify: `src/app/admin/promotions/schema.ts`, `src/app/admin/promotions/schema.test.ts`
- Modify: `src/app/admin/promotions/[id]/parametres/schema.ts`

**Interfaces:**
- Consumes: `parisDateTimeLocalSchema` de `@/lib/timezone` (déjà exporté et testé).

- [ ] **Step 1 : Adapter le test de schéma**

Dans `src/app/admin/promotions/schema.test.ts`, remplacer les valeurs de date `"2026-09-01"` par des valeurs `datetime-local` `"2026-09-01T09:00"` ; ajouter un cas :

```ts
it("rejette une date sans heure (ancien format date seule)", () => {
  const result = createPromotionSchema.safeParse({
    ...validBase,
    startDate: "2026-09-01",
    endDate: "2026-10-01T18:00",
  });
  expect(result.success).toBe(false);
});
```

(Adapter `validBase` aux clés réellement utilisées dans le fichier de test existant.)

- [ ] **Step 2 : Lancer → échec**

Run: `npm test -- src/app/admin/promotions/schema.test.ts`
Expected: FAIL sur le nouveau cas / les valeurs modifiées.

- [ ] **Step 3 : Modifier les schémas**

`src/app/admin/promotions/schema.ts` — remplacer dans `promotionFieldsSchema` :
```ts
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
```
par :
```ts
  startDate: parisDateTimeLocalSchema,
  endDate: parisDateTimeLocalSchema,
```
et ajouter l'import : `import { parisDateTimeLocalSchema } from "@/lib/timezone";`

`src/app/admin/promotions/[id]/parametres/schema.ts` — même remplacement dans `promotionSettingsSchema` + même import.

- [ ] **Step 4 : Lancer → succès**

Run: `npm test -- src/app/admin/promotions`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/app/admin/promotions/schema.ts src/app/admin/promotions/schema.test.ts "src/app/admin/promotions/[id]/parametres/schema.ts"
git commit -m "feat: require date+time (Paris) for promotion start/end

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 13 : Champs de formulaire `datetime-local`

**Files:**
- Modify: `src/app/admin/promotions/promotion-form-fields.tsx`, `src/app/admin/promotions/promotion-form.tsx`, `src/app/admin/promotions/[id]/parametres/promotion-settings-form.tsx`, `src/app/admin/promotions/[id]/parametres/page.tsx`

**Interfaces:**
- Consumes: `toParisDateTimeLocalValue(date: Date): string` de `@/lib/timezone`.

- [ ] **Step 1 : `promotion-form-fields.tsx`**

Remplacer les deux `Input` de date :
```tsx
<Input id={id("startDate")} name="startDate" type="date" required defaultValue={defaults.startDate} />
...
<Input id={id("endDate")} name="endDate" type="date" required defaultValue={defaults.endDate} />
```
par `type="datetime-local"`. Mettre à jour les labels : « Début du concours (date et heure) » / « Fin du concours (date et heure) ».

- [ ] **Step 2 : `promotion-form.tsx` — défauts**

Le formulaire de création n'a pas de dates par défaut aujourd'hui (`defaults` ne contient ni `startDate` ni `endDate`). Laisser vide (l'admin saisit) — `required` sur l'input suffit. Aucun changement nécessaire ici sauf vérifier que `PromotionFieldValues.startDate?: string` reste optionnel.

- [ ] **Step 3 : `parametres/page.tsx` — préremplissage**

Remplacer :
```ts
function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}
```
par un import : `import { toParisDateTimeLocalValue } from "@/lib/timezone";`
et dans le JSX :
```tsx
startDate={toParisDateTimeLocalValue(promotion.startDate)}
endDate={toParisDateTimeLocalValue(promotion.endDate)}
```

- [ ] **Step 4 : `promotion-settings-form.tsx`**

Les deux `Input` `type="date"` → `type="datetime-local"`. Labels « Début (date et heure) » / « Fin (date et heure) ».

- [ ] **Step 5 : Vérifier compilation + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 6 : Test manuel**

`npm run dev` → `/admin/promotions` : le formulaire de création montre des sélecteurs date+heure ; `/admin/promotions/<id>/parametres` : les champs sont préremplis à l'heure de Paris (02:00 pour « Promotion Août 2026 » avant ajustement).

- [ ] **Step 7 : Commit**

```bash
git add src/app/admin/promotions/promotion-form-fields.tsx src/app/admin/promotions/promotion-form.tsx "src/app/admin/promotions/[id]/parametres/promotion-settings-form.tsx" "src/app/admin/promotions/[id]/parametres/page.tsx"
git commit -m "feat: datetime-local inputs for promotion start/end (Paris time)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 14 : Section « Calendrier du concours » dans le règlement

**Files:**
- Modify: `src/components/rules-document.tsx`

**Interfaces:**
- Consumes: `formatParisDateTimeLong` de `@/lib/timezone`.

- [ ] **Step 1 : Ajouter la section**

Dans `src/components/rules-document.tsx` :
- ajouter `formatParisDateTimeLong` à l'import depuis `@/lib/timezone`
- dans l'en-tête, remplacer le `Badge` `{formatParisDate(promotion.startDate)} → {formatParisDate(promotion.endDate)}` par `{formatParisDateTimeLong(promotion.startDate)} → {formatParisDateTimeLong(promotion.endDate)}` (ou le laisser court et compter sur la nouvelle section)
- insérer une `SectionCard` en tout premier (avant « Objectif et conditions de victoire ») :

```tsx
<SectionCard icon={<CalendarClock className="size-4.5" />} title="Calendrier du concours">
  <div className="grid gap-3 sm:grid-cols-2">
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Début du concours</p>
      <p className="text-foreground">{formatParisDateTimeLong(promotion.startDate)}</p>
    </div>
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fin du concours</p>
      <p className="text-foreground">{formatParisDateTimeLong(promotion.endDate)}</p>
    </div>
  </div>
  <p>
    À l&apos;heure exacte de fin, le concours passe automatiquement en statut «&nbsp;terminé&nbsp;» : plus aucune
    transaction n&apos;est possible, le classement final est figé et publié, et les performances rejoignent le
    Hall of Fame. Toutes les heures sont exprimées en heure de Paris.
  </p>
</SectionCard>
```

(`CalendarClock` est déjà importé dans ce fichier.)

- [ ] **Step 2 : Vérifier compilation + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add src/components/rules-document.tsx
git commit -m "feat: show start/end date and time in the rules document

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Phase 7 — Concours actuel + vérification finale

### Task 15 : Déplacer la fin du concours actuel à 13:00 Paris

**Files:**
- Aucun fichier de code. Modification de données via l'UI admin (préféré) ou script ponctuel.

- [ ] **Step 1 : Via l'écran admin (préféré)**

`npm run dev`, se connecter admin, `/admin/promotions/<id de Promotion Août 2026>/parametres`.
Régler « Fin (date et heure) » sur **`2026-08-28T13:00`**. Soumettre. Un avertissement d'impact peut apparaître (« déclenche le gel » — déjà gelé, sans effet) → confirmer.
Vérifier en base que `endDate` vaut `2026-08-28T11:00:00.000Z`.

- [ ] **Step 2 : Alternative — script ponctuel (si pas d'accès admin immédiat)**

Créer `_scratch_set_end.ts` à la racine (non commité) :

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const p = await db.promotion.findFirstOrThrow({ where: { name: "Promotion Août 2026" } });
console.log("avant:", p.endDate.toISOString(), p.status);
await db.promotion.update({ where: { id: p.id }, data: { endDate: new Date("2026-08-28T11:00:00Z") } });
console.log("après: 2026-08-28T11:00:00Z (= 13:00 Paris)");
process.exit(0);
```

Run: `npx tsx _scratch_set_end.ts` puis `rm _scratch_set_end.ts`.
**Ne PAS** modifier d'autre champ. **Ne PAS** lancer de migration.

- [ ] **Step 3 : Vérifier la clôture automatique**

Après 13:00 Paris (ou en repassant temporairement `endDate` dans le passé pour tester puis en la remettant) : charger `/dashboard` en participant → redirection `/resultats`, entrées `HallOfFameEntry` créées (3), `status = CLOSED`, sessions `CLOSED`. Recharger `/dashboard` plusieurs fois → aucune entrée en double, résultat inchangé (idempotence).

### Task 16 : Vérification finale complète

- [ ] **Step 1 : Suite de tests**

Run: `npm test`
Expected: tous les fichiers passent, y compris `promotion-lifecycle`, `hall-of-fame`, `frozen-leaderboard`, `timezone`, `admin/promotions/schema`.

- [ ] **Step 2 : Lint + types**

Run: `npm run lint && npx tsc --noEmit`
Expected: aucune erreur, aucun import inutilisé.

- [ ] **Step 3 : Build**

Run: `npm run build`
Expected: build réussi (inclut `prisma migrate deploy` — la migration `hall_of_fame_entry` est déjà appliquée, no-op).

- [ ] **Step 4 : Revue manuelle des parcours**

- Règlement participant : section « Calendrier du concours » avec date + heure de Paris.
- `/hall-of-fame` : record historique, podiums par saison, top all-time, participations.
- `/resultats` : podium animé, vainqueur, votre résultat, classement final, bouton retour.
- `/leaderboard` après clôture : classement figé, badge « Classement final », pas d'auto-refresh.
- `/dashboard` après clôture : redirection une fois puis bannière + portefeuille figé (pas de bouton d'achat/vente).
- Admin : création de promotion avec date+heure ; paramètres préremplis à l'heure de Paris.

- [ ] **Step 5 : Commit final éventuel (nettoyage)**

```bash
git status   # doit être propre, aucun _scratch_* résiduel
```

---

## Self-Review — couverture de la spec

| Exigence spec | Task |
|---|---|
| §1 analyse (fait avant le plan) | — (rapport livré) |
| §2 concours actuel → fin 13:00 Paris | Task 15 |
| §2 ne pas toucher transactions/positions/perfs | Task 15 (un seul champ), contrainte globale |
| §3 date+heure début/fin obligatoires futurs concours | Tasks 12, 13 |
| §3 règlement affiche date+heure | Task 14 |
| §3 fuseau Paris | `parisDateTimeLocalSchema` / `formatParisDateTimeLong`, Tasks 2/12/13/14 |
| §4.1 statut → terminé à l'heure exacte | Task 3 (`closePromotionIfEnded`) + Task 6 triggers |
| §4.2 transactions bloquées | Task 6 (trigger avant `executeOrder` → `validateOrder` refuse) + Task 10 (UI) |
| §4.3 fenêtres de changement fermées | Task 3 (`changeSession.updateMany`) |
| §4.4 aucune modif de portefeuille | Tasks 6, 10 |
| §4.5 classement final calculé et figé | Task 3 (`getLeaderboard` @ endDate → `HallOfFameEntry`) |
| §4.6 performances finales enregistrées | Task 3 (`finalPnlEur`, `finalReturnPct`) |
| §4.7 données conservées | Task 1 (table permanente) |
| §4 robuste si personne connecté | Task 5 (cron backstop) + Task 6 (au retour) |
| §5 expérience de fin premium | Tasks 9, 10 |
| §6 Hall of Fame MAJ auto à la clôture | Task 3 (upsert) + `updateTag` |
| §6 historique de tous les concours terminés | Tasks 1, 7 |
| §6 prénom/nom, concours, perf %, gain €, rang, date fin | Task 1 (champs) + Task 3 (écriture) |
| §6 une personne = plusieurs entrées, jamais fusionnées | Task 1 (`@@unique([promotionId, userId])`), Task 7 test |
| §7 classement par performance, meilleure en tête | Task 7 (`orderBy finalReturnPct desc`) |
| §7 podiums, participations, nb participations | Tasks 7, 8 |
| §8 idempotence (pas de doublon HoF, perfs, snapshots, résultats) | Task 3 (garde atomique + `update: {}`), tests Task 3 |
| §9 pas de suppression/reset/migration destructive | Task 1 (SQL additif), contrainte globale |
| §10 rapport | Livré en conversation + ce plan |

Aucun `TBD`/`TODO`/placeholder. Signatures cohérentes entre tasks (`closePromotionIfEnded`, `finalizePromotionClosure`, `closeEndedPromotions`, `getHallOfFame` → `HallOfFameData`, `getFrozenLeaderboard` → `FrozenLeaderboardRow[]`).

### Écart assumé vs spec

- La spec §Architecture mentionnait « snapshot final par portefeuille avec rang ». Le plan **ne crée pas** de nouvelles lignes `PerformanceSnapshot` : `HallOfFameEntry` est la source figée, et le dernier snapshot nocturne (< 24 h avant `endDate` grâce au gel 48 h) suffit à l'historique des courbes. Moins de code, même résultat observable. `ponytail:` si un jour une courbe doit finir exactement à `endDate`, ajouter l'écriture d'un snapshot dans `finalizePromotionClosure`.
