# Sélection de participants existants à la création d'une promotion — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin d'inscrire des participants existants (d'anciennes promotions) à une nouvelle promotion, via une liste à cocher sur la page détail, sans que la participation soit automatique.

**Architecture:** Nouvelle table de liaison `PromotionParticipant` = registre d'inscription (une ligne par couple participant × promotion, jamais mutée destructivement). `User.promotionId` reste le pointeur dénormalisé « promotion active », synchronisé à l'inscription — le front participant n'est pas touché. Une migration de backfill recopie l'état actuel. Un module unique `promotion-membership.ts` centralise toute inscription/désinscription ; `provisionPortfolios` lit la table de liaison.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`), Prisma 7 / PostgreSQL (Neon), Vitest 4, Tailwind, base-ui.

## Global Constraints

- **Migrations : additives uniquement.** Aucun `prisma migrate dev` contre la base de `.env`. Écrire le SQL à la main dans `prisma/migrations/<timestamp>_<nom>/migration.sql` (timestamp rond, ex. `20260903120000`), puis `npx prisma generate` + `npx prisma migrate deploy`. Précédents : `20260807130000_position_unique_open_per_asset`, `20260828120000_hall_of_fame_entry`.
- **Ne jamais casser les promotions existantes.** Après backfill, `provisionPortfolios` et tout le front participant doivent se comporter à l'identique.
- **Client Prisma généré** dans `src/generated/prisma/` — enums importés depuis `@/generated/prisma/enums`.
- **Tests** : `npx vitest run <chemin>` pour un fichier, `npm test` pour tout. Mock de `@/lib/db` via `vi.mock` (voir `src/lib/portfolio-provisioning.test.ts` pour le motif exact).
- **Commits** : format `<type>: <description>` puis, sur une ligne vide,
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` et
  `Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8`.
- Branche de travail : `feat/promotion-participant-selection` (déjà créée).
- Commentaires et libellés UI en **français** (convention du repo).

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `prisma/schema.prisma` | + modèle `PromotionParticipant` + relations inverses | 1 |
| `prisma/migrations/20260903120000_promotion_participant/migration.sql` | table + index + FK + backfill | 1 |
| `src/lib/participants/promotion-membership.ts` | `registerParticipants`, `unregisterParticipant` — **seul** point d'inscription | 2 |
| `src/lib/participants/promotion-membership.test.ts` | tests du module | 2 |
| `src/lib/portfolio-provisioning.ts` | `provisionPortfolios` lit `promotionParticipant` | 3 |
| `src/lib/portfolio-provisioning.test.ts` | test adapté | 3 |
| `src/lib/participants/create-participant.ts` | crée le **seul** compte (retourne `id`, plus de `promotionId`) | 4 |
| `src/lib/participants/create-participant.test.ts` | test adapté | 4 |
| `src/app/admin/participants/actions.ts` | `createParticipant` + nouvelle `addParticipantToPromotion` (remplace `reassign`) via module | 4 |
| `src/app/admin/participants/schema.ts` | `addToPromotionSchema` (renommage) | 4 |
| `src/app/admin/participants/schema.test.ts` | test adapté | 4 |
| `src/app/admin/participants/participant-row-actions.tsx` | consomme `addParticipantToPromotion` (recâblage dans le commit du renommage) | 4 |
| `src/app/admin/promotions/[id]/participants-actions.ts` | bulk via module + `addExistingParticipants` + `unregisterParticipantAction` | 4 (bulk) + 5 |
| `src/app/admin/promotions/[id]/add-existing-participants-form.tsx` | composant client — liste à cocher + filtre | 5 |
| `src/app/admin/promotions/[id]/page.tsx` | roster via `participants` + carte « ajouter des existants » | 5 |
| `src/app/admin/participants/page.tsx` | colonne multi-promotions | 6 |
| `docs/ADMINISTRATION.md` | doc du nouveau flux | 7 |

---

## Task 1 : Table `PromotionParticipant` + migration de backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260903120000_promotion_participant/migration.sql`

**Interfaces:**
- Produces : modèle Prisma `PromotionParticipant { id, userId, promotionId, createdAt }`, accès `db.promotionParticipant`, clé composite `userId_promotionId`. Relations inverses `User.promotionParticipations`, `Promotion.participants`.

- [ ] **Step 1 : Ajouter le modèle au schéma**

Dans `prisma/schema.prisma`, après le modèle `HallOfFameEntry` (fin de fichier), ajouter :

```prisma
/// Registre d'inscription : une ligne par couple (participant, promotion),
/// écrite quand l'admin inscrit quelqu'un à une promotion, jamais mutée
/// destructivement. Source de vérité du roster (pilote provisionPortfolios) et
/// de l'historique des participations. `User.promotionId` en reste le pointeur
/// dénormalisé "promotion active" (une seule promotion non clôturée à la fois),
/// synchronisé ici à l'inscription.
/// ponytail: double donnée volontaire (ligne de liaison + User.promotionId) —
/// à fusionner si l'app passe un jour à du multi-promotion simultané.
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

Dans `model User`, après la ligne `hallOfFameEntries HallOfFameEntry[]` :

```prisma
  promotionParticipations PromotionParticipant[]
```

Dans `model Promotion`, après la ligne `hallOfFameEntries HallOfFameEntry[]` :

```prisma
  participants PromotionParticipant[]
```

- [ ] **Step 2 : Écrire la migration SQL à la main**

Créer `prisma/migrations/20260903120000_promotion_participant/migration.sql` :

```sql
-- CreateTable
CREATE TABLE "PromotionParticipant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionParticipant_userId_promotionId_key" ON "PromotionParticipant"("userId", "promotionId");

-- CreateIndex
CREATE INDEX "PromotionParticipant_promotionId_idx" ON "PromotionParticipant"("promotionId");

-- AddForeignKey
ALTER TABLE "PromotionParticipant" ADD CONSTRAINT "PromotionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionParticipant" ADD CONSTRAINT "PromotionParticipant_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : chaque participant actuellement rattaché à une promotion devient
-- une ligne d'inscription. gen_random_uuid() est natif Postgres 13+ ; l'id
-- n'a aucune contrainte de format côté DB, seulement la PK.
INSERT INTO "PromotionParticipant" ("id", "userId", "promotionId", "createdAt")
SELECT gen_random_uuid()::text, "id", "promotionId", CURRENT_TIMESTAMP
FROM "User"
WHERE "promotionId" IS NOT NULL;
```

- [ ] **Step 3 : Générer le client Prisma**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` sans erreur ; `src/generated/prisma/` mentionne `PromotionParticipant`.

- [ ] **Step 4 : Appliquer la migration**

Run: `npx prisma migrate deploy`
Expected: `Applying migration 20260903120000_promotion_participant` puis `All migrations have been successfully applied.`
(Si erreur de lock advisory P1002 : relancer la commande — voir mémoire projet.)

- [ ] **Step 5 : Vérifier le backfill**

Créer `prisma/check-backfill.ts` (même dossier que les scripts `seed-*` qui chargent déjà l'environnement DB) :

```ts
import { db } from "../src/lib/db";

const [usersWithPromotion, participantRows] = await Promise.all([
  db.user.count({ where: { promotionId: { not: null } } }),
  db.promotionParticipant.count(),
]);

console.log({ usersWithPromotion, participantRows });
process.exit(usersWithPromotion === participantRows ? 0 : 1);
```

Run: `npx tsx prisma/check-backfill.ts`
Expected: `{ usersWithPromotion: N, participantRows: N }` (mêmes valeurs), exit 0.
Puis supprimer le fichier : `rm prisma/check-backfill.ts` (ne pas committer).

- [ ] **Step 6 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260903120000_promotion_participant
git commit -m "feat: add PromotionParticipant registration ledger with backfill

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 2 : Module `promotion-membership.ts`

**Files:**
- Create: `src/lib/participants/promotion-membership.ts`
- Test: `src/lib/participants/promotion-membership.test.ts`

**Interfaces:**
- Consumes : `db.user`, `db.promotion`, `db.promotionParticipant` (Task 1) ; `provisionPortfolioIfPromotionActive(promotionId: string): Promise<void>` depuis `@/lib/portfolio-provisioning` ; `PromotionStatus` depuis `@/generated/prisma/enums`.
- Produces :
  - `type RegisterResult = { userId: string; name: string; status: "registered" } | { userId: string; name: string; status: "already-registered" } | { userId: string; name: string; status: "blocked-active-elsewhere"; promotionName: string }`
  - `registerParticipants(promotionId: string, userIds: string[]): Promise<RegisterResult[]>`
  - `unregisterParticipant(promotionId: string, userId: string): Promise<void>`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `src/lib/participants/promotion-membership.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const promotionFindUniqueOrThrow = vi.fn();
const ppFindUnique = vi.fn();
const ppCreate = vi.fn();
const ppDeleteMany = vi.fn();
const provisionIfActive = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: userFindUnique, update: userUpdate },
    promotion: { findUniqueOrThrow: promotionFindUniqueOrThrow },
    promotionParticipant: { findUnique: ppFindUnique, create: ppCreate, deleteMany: ppDeleteMany },
  },
}));
vi.mock("@/lib/portfolio-provisioning", () => ({
  provisionPortfolioIfPromotionActive: provisionIfActive,
}));

const { registerParticipants, unregisterParticipant } = await import("./promotion-membership");

beforeEach(() => {
  [userFindUnique, userUpdate, promotionFindUniqueOrThrow, ppFindUnique, ppCreate, ppDeleteMany, provisionIfActive].forEach(
    (m) => m.mockReset(),
  );
});

describe("registerParticipants", () => {
  it("inscrit un participant : crée la ligne de liaison et synchronise le pointeur actif", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "Alice", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).toHaveBeenCalledWith({ data: { userId: "u1", promotionId: "promo-2" } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { promotionId: "promo-2" } });
    expect(results).toEqual([{ userId: "u1", name: "Alice", status: "registered" }]);
  });

  it("provisionne les portefeuilles une seule fois si au moins une inscription", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "Alice", promotionId: null, promotion: null });
    ppFindUnique.mockResolvedValue(null);

    await registerParticipants("promo-2", ["u1", "u1"]);

    expect(provisionIfActive).toHaveBeenCalledTimes(1);
    expect(provisionIfActive).toHaveBeenCalledWith("promo-2");
  });

  it("renvoie already-registered sans rien écrire si la ligne existe déjà", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "Alice", promotionId: "promo-2", promotion: { status: "DRAFT", name: "P2" } });
    ppFindUnique.mockResolvedValue({ id: "pp1" });

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(results).toEqual([{ userId: "u1", name: "Alice", status: "already-registered" }]);
  });

  it("bloque un participant dont la promotion actuelle est ACTIVE et différente", async () => {
    userFindUnique.mockResolvedValue({
      id: "u1", name: "Alice", promotionId: "promo-1",
      promotion: { status: "ACTIVE", name: "Saison 1" },
    });

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(ppCreate).not.toHaveBeenCalled();
    expect(results).toEqual([
      { userId: "u1", name: "Alice", status: "blocked-active-elsewhere", promotionName: "Saison 1" },
    ]);
    expect(provisionIfActive).not.toHaveBeenCalled();
  });

  it("autorise la ré-inscription à la même promotion ACTIVE", async () => {
    userFindUnique.mockResolvedValue({
      id: "u1", name: "Alice", promotionId: "promo-2",
      promotion: { status: "ACTIVE", name: "Saison 2" },
    });
    ppFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["u1"]);

    expect(results[0].status).toBe("registered");
  });

  it("ignore silencieusement un userId inconnu", async () => {
    userFindUnique.mockResolvedValue(null);

    const results = await registerParticipants("promo-2", ["ghost"]);

    expect(results).toEqual([]);
    expect(provisionIfActive).not.toHaveBeenCalled();
  });
});

describe("unregisterParticipant", () => {
  it("supprime la ligne et remet le pointeur à null si la promotion est DRAFT", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "DRAFT" });
    userFindUnique.mockResolvedValue({ promotionId: "promo-2" });

    await unregisterParticipant("promo-2", "u1");

    expect(ppDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1", promotionId: "promo-2" } });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { promotionId: null } });
  });

  it("ne touche pas au pointeur s'il vise une autre promotion", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "DRAFT" });
    userFindUnique.mockResolvedValue({ promotionId: "promo-1" });

    await unregisterParticipant("promo-2", "u1");

    expect(ppDeleteMany).toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("refuse si la promotion n'est pas DRAFT", async () => {
    promotionFindUniqueOrThrow.mockResolvedValue({ status: "ACTIVE" });

    await expect(unregisterParticipant("promo-2", "u1")).rejects.toThrow(/brouillon/);
    expect(ppDeleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/lib/participants/promotion-membership.test.ts`
Expected: FAIL — `Cannot find module './promotion-membership'`.

- [ ] **Step 3 : Écrire le module**

Créer `src/lib/participants/promotion-membership.ts` :

```ts
import "server-only";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { provisionPortfolioIfPromotionActive } from "@/lib/portfolio-provisioning";

export type RegisterResult =
  | { userId: string; name: string; status: "registered" }
  | { userId: string; name: string; status: "already-registered" }
  | { userId: string; name: string; status: "blocked-active-elsewhere"; promotionName: string };

/**
 * Inscrit un ou plusieurs participants à une promotion : crée la ligne
 * PromotionParticipant (idempotent via la contrainte unique) et synchronise le
 * pointeur User.promotionId. Provisionne les portefeuilles une seule fois à la
 * fin si la promotion est déjà ACTIVE. Refuse d'inscrire un participant dont la
 * promotion actuelle est ACTIVE et différente (perte d'accès à un concours en
 * cours) — le client garantit qu'une seule promotion tourne à la fois, ce
 * garde-fou couvre le cas anormal.
 */
export async function registerParticipants(
  promotionId: string,
  userIds: string[],
): Promise<RegisterResult[]> {
  const results: RegisterResult[] = [];
  let anyRegistered = false;

  for (const userId of userIds) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        promotionId: true,
        promotion: { select: { status: true, name: true } },
      },
    });
    if (!user) continue;

    if (
      user.promotionId &&
      user.promotionId !== promotionId &&
      user.promotion?.status === PromotionStatus.ACTIVE
    ) {
      results.push({
        userId,
        name: user.name,
        status: "blocked-active-elsewhere",
        promotionName: user.promotion.name,
      });
      continue;
    }

    const existing = await db.promotionParticipant.findUnique({
      where: { userId_promotionId: { userId, promotionId } },
    });
    if (existing) {
      results.push({ userId, name: user.name, status: "already-registered" });
      continue;
    }

    await db.promotionParticipant.create({ data: { userId, promotionId } });
    await db.user.update({ where: { id: userId }, data: { promotionId } });
    anyRegistered = true;
    results.push({ userId, name: user.name, status: "registered" });
  }

  if (anyRegistered) {
    await provisionPortfolioIfPromotionActive(promotionId);
  }

  return results;
}

/**
 * Retire un participant d'une promotion — autorisé uniquement tant que la
 * promotion est DRAFT (aucun portefeuille créé). Retirer quelqu'un d'une
 * promotion active ou clôturée fausserait classement et historique.
 */
export async function unregisterParticipant(promotionId: string, userId: string): Promise<void> {
  const promotion = await db.promotion.findUniqueOrThrow({
    where: { id: promotionId },
    select: { status: true },
  });
  if (promotion.status !== PromotionStatus.DRAFT) {
    throw new Error("Retirer un participant n'est possible que sur une promotion en brouillon.");
  }

  await db.promotionParticipant.deleteMany({ where: { userId, promotionId } });

  const user = await db.user.findUnique({ where: { id: userId }, select: { promotionId: true } });
  if (user?.promotionId === promotionId) {
    await db.user.update({ where: { id: userId }, data: { promotionId: null } });
  }
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/lib/participants/promotion-membership.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/participants/promotion-membership.ts src/lib/participants/promotion-membership.test.ts
git commit -m "feat: promotion-membership module — register/unregister participants

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 3 : `provisionPortfolios` lit la table de liaison

**Files:**
- Modify: `src/lib/portfolio-provisioning.ts:10-22`
- Test: `src/lib/portfolio-provisioning.test.ts`

**Interfaces:**
- Consumes : `db.promotionParticipant.findMany` (Task 1).
- Produces : `provisionPortfolios(promotionId: string): Promise<number>` — signature inchangée.

- [ ] **Step 1 : Mettre à jour le test**

Remplacer `src/lib/portfolio-provisioning.test.ts` par :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
const createManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    promotionParticipant: { findMany: findManyMock },
    portfolio: { createMany: createManyMock },
  },
}));

const { provisionPortfolios } = await import("./portfolio-provisioning");

beforeEach(() => {
  findManyMock.mockReset();
  createManyMock.mockReset();
});

describe("provisionPortfolios", () => {
  it("crée un portefeuille pour chaque participant inscrit à la promotion", async () => {
    findManyMock.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
    createManyMock.mockResolvedValue({ count: 2 });

    const count = await provisionPortfolios("promo-1");

    expect(findManyMock).toHaveBeenCalledWith({ where: { promotionId: "promo-1" }, select: { userId: true } });
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", promotionId: "promo-1" },
        { userId: "user-2", promotionId: "promo-1" },
      ],
      skipDuplicates: true,
    });
    expect(count).toBe(2);
  });

  it("ne crée rien si aucun participant n'est inscrit", async () => {
    findManyMock.mockResolvedValue([]);
    createManyMock.mockResolvedValue({ count: 0 });

    const count = await provisionPortfolios("promo-1");

    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/lib/portfolio-provisioning.test.ts`
Expected: FAIL — `db.promotionParticipant` est `undefined` (le code lit encore `db.user`).

- [ ] **Step 3 : Modifier `provisionPortfolios`**

Dans `src/lib/portfolio-provisioning.ts`, remplacer le corps de `provisionPortfolios` (lignes 10-22) par :

```ts
export async function provisionPortfolios(promotionId: string): Promise<number> {
  const participants = await db.promotionParticipant.findMany({
    where: { promotionId },
    select: { userId: true },
  });

  const result = await db.portfolio.createMany({
    data: participants.map((participant) => ({ userId: participant.userId, promotionId })),
    skipDuplicates: true,
  });

  return result.count;
}
```

Mettre à jour le commentaire JSDoc au-dessus : « Crée un Portfolio pour chaque participant **inscrit** à la promotion (table `PromotionParticipant`) et qui n'en a pas encore un. »

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run src/lib/portfolio-provisioning.test.ts`
Expected: PASS.

- [ ] **Step 5 : Lancer toute la suite (rien d'autre cassé)**

Run: `npm test`
Expected: PASS partout sauf, éventuellement, `create-participant.test.ts` et `participants/schema.test.ts` (traités en Task 4). Si d'autres échouent, s'arrêter et investiguer.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/portfolio-provisioning.ts src/lib/portfolio-provisioning.test.ts
git commit -m "refactor: provisionPortfolios reads PromotionParticipant instead of User.promotionId

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 4 : `create-participant` ne gère plus la promotion ; actions `/admin/participants` via le module

**Files:**
- Modify: `src/lib/participants/create-participant.ts`
- Test: `src/lib/participants/create-participant.test.ts`
- Modify: `src/app/admin/participants/actions.ts`
- Modify: `src/app/admin/participants/schema.ts`
- Test: `src/app/admin/participants/schema.test.ts`

**Interfaces:**
- Consumes : `registerParticipants` (Task 2).
- Produces :
  - `ParticipantCreationInput = { name: string }`
  - `ParticipantCreationResult = { name: string; status: "created"; id: string; tempPassword: string } | { name: string; status: "exists" }`
  - `createParticipantWithTempPassword(input: ParticipantCreationInput): Promise<ParticipantCreationResult>`
  - action `addParticipantToPromotion(_prev: ParticipantFormState, formData: FormData): Promise<ParticipantFormState>` (remplace `reassignParticipantPromotion`)
  - `addToPromotionSchema` (remplace `reassignPromotionSchema`, mêmes champs `{ userId, promotionId }`)

- [ ] **Step 1 : Mettre à jour le test de `create-participant`**

Remplacer `src/lib/participants/create-participant.test.ts` par :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: findUniqueMock, create: createMock } },
}));

const { createParticipantWithTempPassword } = await import("./create-participant");

beforeEach(() => {
  findUniqueMock.mockReset();
  createMock.mockReset();
});

describe("createParticipantWithTempPassword", () => {
  it("crée un compte avec mot de passe temporaire et renvoie son id", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-x" });

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont" });

    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.id).toBe("user-x");
      expect(result.tempPassword).toHaveLength(10);
    }
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Adam Dupont", mustChangePassword: true }),
      }),
    );
    const createArg = createMock.mock.calls[0][0];
    expect(createArg.data).not.toHaveProperty("promotionId");
  });

  it("ne crée pas de doublon si le nom existe déjà", async () => {
    findUniqueMock.mockResolvedValue({ id: "existing-user" });

    const result = await createParticipantWithTempPassword({ name: "Adam Dupont" });

    expect(result).toEqual({ name: "Adam Dupont", status: "exists" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("nettoie le nom (trim) avant vérification et création", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-y" });

    await createParticipantWithTempPassword({ name: "  Adam Dupont  " });

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { name: "Adam Dupont" } });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Adam Dupont" }) }),
    );
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/lib/participants/create-participant.test.ts`
Expected: FAIL — le type d'input exige encore `promotionId`, et `result.id` n'existe pas.

- [ ] **Step 3 : Modifier `create-participant.ts`**

Remplacer `src/lib/participants/create-participant.ts` par :

```ts
import "server-only";
import { db } from "@/lib/db";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";

export interface ParticipantCreationInput {
  name: string;
}

export type ParticipantCreationResult =
  | { name: string; status: "created"; id: string; tempPassword: string }
  | { name: string; status: "exists" };

/**
 * Crée UN compte participant avec un mot de passe temporaire généré (jamais
 * choisi par l'admin) — `mustChangePassword: true` force le changement à la
 * première connexion (voir src/proxy.ts). Ne fait rien si l'identifiant existe
 * déjà. L'inscription à une promotion est une étape séparée : l'appelant
 * enchaîne `registerParticipants` (voir promotion-membership.ts).
 */
export async function createParticipantWithTempPassword(
  input: ParticipantCreationInput,
): Promise<ParticipantCreationResult> {
  const name = input.name.trim();
  const existing = await db.user.findUnique({ where: { name } });
  if (existing) return { name, status: "exists" };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await db.user.create({
    data: { name, passwordHash, mustChangePassword: true },
  });

  return { name, status: "created", id: user.id, tempPassword };
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run src/lib/participants/create-participant.test.ts`
Expected: PASS.

- [ ] **Step 5 : Renommer le schéma**

Dans `src/app/admin/participants/schema.ts`, renommer `reassignPromotionSchema` en `addToPromotionSchema` (contenu identique) :

```ts
export const addToPromotionSchema = z.object({
  userId: z.string().min(1),
  promotionId: z.string().min(1, "Choisissez une promotion"),
});
```

Dans `src/app/admin/participants/schema.test.ts`, remplacer le bloc `describe("reassignPromotionSchema", ...)` (et l'import) par `addToPromotionSchema` :

```ts
import { createParticipantSchema, resetPasswordSchema, addToPromotionSchema } from "./schema";
```
```ts
describe("addToPromotionSchema", () => {
  it("accepte un userId et un promotionId valides", () => {
    const result = addToPromotionSchema.safeParse({ userId: "user-1", promotionId: "promo-1" });
    expect(result.success).toBe(true);
  });

  it("rejette un promotionId manquant", () => {
    const result = addToPromotionSchema.safeParse({ userId: "user-1", promotionId: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6 : Réécrire les actions `/admin/participants`**

Dans `src/app/admin/participants/actions.ts` :

1. Imports : retirer `provisionPortfolioIfPromotionActive`, ajouter `registerParticipants`. Remplacer `reassignPromotionSchema` par `addToPromotionSchema`.

```ts
import { createParticipantWithTempPassword } from "@/lib/participants/create-participant";
import { registerParticipants } from "@/lib/participants/promotion-membership";
import { createParticipantSchema, resetPasswordSchema, addToPromotionSchema } from "./schema";
```
(retirer la ligne `import { provisionPortfolioIfPromotionActive } from "@/lib/portfolio-provisioning";`)

2. `createParticipant` — corps après le `safeParse` :

```ts
  const { name, promotionId } = parsed.data;

  const result = await createParticipantWithTempPassword({ name });
  if (result.status === "exists") {
    return { error: `L'identifiant "${name}" est déjà utilisé.` };
  }

  await registerParticipants(promotionId, [result.id]);

  await logAudit({
    adminId: session.user.id,
    action: "participant.create",
    target: name,
    after: { name, promotionId },
  });

  revalidatePath("/admin/participants");
  return { created: { name, tempPassword: result.tempPassword } };
```

3. Supprimer entièrement la fonction `reassignParticipantPromotion` et la remplacer par :

```ts
export async function addParticipantToPromotion(
  _prevState: ParticipantFormState,
  formData: FormData,
): Promise<ParticipantFormState> {
  const session = await requireAdmin();

  const parsed = addToPromotionSchema.safeParse({
    userId: formData.get("userId"),
    promotionId: formData.get("promotionId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const [result] = await registerParticipants(parsed.data.promotionId, [parsed.data.userId]);
  if (result?.status === "blocked-active-elsewhere") {
    return { error: `${result.name} participe déjà à « ${result.promotionName} » (promotion active).` };
  }

  await logAudit({
    adminId: session.user.id,
    action: "participant.add-to-promotion",
    target: parsed.data.userId,
    after: { promotionId: parsed.data.promotionId },
  });

  revalidatePath("/admin/participants");
  return {};
}
```

4. `removeParticipant` et `deleteParticipant` : inchangées.

- [ ] **Step 7 : Router le formulaire groupé via le module**

Dans `src/app/admin/promotions/[id]/participants-actions.ts` :

1. Imports : retirer `provisionPortfolioIfPromotionActive`, ajouter `registerParticipants`.

```ts
import { createParticipantWithTempPassword, type ParticipantCreationResult } from "@/lib/participants/create-participant";
import { registerParticipants } from "@/lib/participants/promotion-membership";
```

2. Dans `createParticipantsBulk`, remplacer la boucle de création + le bloc de provisioning (lignes ~44-61) par :

```ts
  const results: BulkParticipantResult[] = [];
  const createdIds: string[] = [];
  for (const row of parsedRows) {
    const result = await createParticipantWithTempPassword({ name: row.name });
    results.push(result);

    if (result.status === "created") {
      createdIds.push(result.id);
      await logAudit({
        adminId: session.user.id,
        action: "participant.create",
        target: result.name,
        after: { name: result.name, promotionId },
      });
    }
  }

  if (createdIds.length > 0) {
    await registerParticipants(promotionId, createdIds);
  }
```

- [ ] **Step 8 : Recâbler le seul consommateur de l'action renommée**

`participant-row-actions.tsx` importe `reassignParticipantPromotion` (supprimée au Step 6) — il faut le mettre à jour dans le même commit pour que l'arbre compile. Dans `src/app/admin/participants/participant-row-actions.tsx` :

1. Import : remplacer `reassignParticipantPromotion` par `addParticipantToPromotion`.

```ts
import {
  addParticipantToPromotion,
  removeParticipant,
  deleteParticipant,
  resetParticipantPassword,
  type ParticipantFormState,
} from "./actions";
```

2. Remplacer le `useActionState` de reassign par :

```ts
  const [addState, addAction, addPending] = useActionState(addParticipantToPromotion, initialState);
```

3. Dans le JSX, le premier `<form>` du dialogue : `action={reassignAction}` → `action={addAction}` ; le libellé du bouton devient « Ajouter à cette promotion » ; `reassignState` → `addState`, `reassignPending` → `addPending`. Le `<Select defaultValue={currentPromotionId ?? undefined}>` reste inchangé.

```tsx
            <form action={addAction} className="flex flex-col gap-2">
              <input type="hidden" name="userId" value={userId} />
              <Label htmlFor={`promotion-${userId}`}>Promotion</Label>
              <Select
                name="promotionId"
                defaultValue={currentPromotionId ?? undefined}
                items={promotions.map((promotion) => ({ value: promotion.id, label: promotion.name }))}
              >
                <SelectTrigger id={`promotion-${userId}`} className="w-full">
                  <SelectValue placeholder="Choisir une promotion" />
                </SelectTrigger>
                <SelectContent>
                  {promotions.map((promotion) => (
                    <SelectItem key={promotion.id} value={promotion.id}>
                      {promotion.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={addPending} className="self-start">
                Ajouter à cette promotion
              </Button>
              {addState.error && <p className="text-sm text-destructive">{addState.error}</p>}
            </form>
```

- [ ] **Step 9 : Vérifier compilation + suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur TS ; toute la suite PASS.

- [ ] **Step 10 : Commit**

```bash
git add src/lib/participants/create-participant.ts src/lib/participants/create-participant.test.ts src/app/admin/participants/actions.ts src/app/admin/participants/schema.ts src/app/admin/participants/schema.test.ts src/app/admin/participants/participant-row-actions.tsx "src/app/admin/promotions/[id]/participants-actions.ts"
git commit -m "refactor: route participant creation through registerParticipants

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 5 : Page détail promotion — roster + carte « ajouter des participants existants »

**Files:**
- Modify: `src/app/admin/promotions/[id]/participants-actions.ts`
- Create: `src/app/admin/promotions/[id]/add-existing-participants-form.tsx`
- Modify: `src/app/admin/promotions/[id]/page.tsx`

**Interfaces:**
- Consumes : `registerParticipants`, `unregisterParticipant` (Task 2) ; `db.promotionParticipant`, `db.user`.
- Produces :
  - `type AddParticipantsFormState = { error?: string; results?: RegisterResult[] }`
  - `addExistingParticipants(promotionId: string, _prev: AddParticipantsFormState, formData: FormData): Promise<AddParticipantsFormState>`
  - `unregisterParticipantAction(promotionId: string, userId: string): Promise<void>`
  - composant `<AddExistingParticipantsForm promotionId={string} candidates={{ id: string; name: string; lastPromotionName: string | null }[]} />`

- [ ] **Step 1 : Ajouter les actions**

Dans `src/app/admin/promotions/[id]/participants-actions.ts`, ajouter en tête :

```ts
import { registerParticipants, unregisterParticipant, type RegisterResult } from "@/lib/participants/promotion-membership";
```
(fusionner avec l'import `registerParticipants` déjà ajouté en Task 4 Step 7 — une seule ligne d'import du module)

En bas du fichier :

```ts
export interface AddParticipantsFormState {
  error?: string;
  results?: RegisterResult[];
}

export async function addExistingParticipants(
  promotionId: string,
  _prevState: AddParticipantsFormState,
  formData: FormData,
): Promise<AddParticipantsFormState> {
  const session = await requireAdmin();

  const userIds = formData.getAll("userId").map((value) => String(value)).filter((value) => value.length > 0);
  if (userIds.length === 0) {
    return { error: "Sélectionnez au moins un participant." };
  }

  const results = await registerParticipants(promotionId, userIds);

  const registered = results.filter((result) => result.status === "registered");
  if (registered.length > 0) {
    await logAudit({
      adminId: session.user.id,
      action: "promotion.participants.add",
      target: promotionId,
      after: { userIds: registered.map((result) => result.userId) },
    });
  }

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
  return { results };
}

export async function unregisterParticipantAction(promotionId: string, userId: string): Promise<void> {
  const session = await requireAdmin();

  await unregisterParticipant(promotionId, userId);

  await logAudit({
    adminId: session.user.id,
    action: "promotion.participants.remove",
    target: promotionId,
    after: { userId },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/admin/participants");
}
```

- [ ] **Step 2 : Créer le composant client**

Créer `src/app/admin/promotions/[id]/add-existing-participants-form.tsx` :

```tsx
"use client";

import { useActionState, useMemo, useState } from "react";
import { addExistingParticipants, type AddParticipantsFormState } from "./participants-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Candidate {
  id: string;
  name: string;
  lastPromotionName: string | null;
}

const initialState: AddParticipantsFormState = {};

export function AddExistingParticipantsForm({
  promotionId,
  candidates,
}: {
  promotionId: string;
  candidates: Candidate[];
}) {
  const action = addExistingParticipants.bind(null, promotionId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => candidate.name.toLowerCase().includes(q));
  }, [candidates, query]);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tous les participants existants sont déjà inscrits à cette promotion.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {candidates.length > 12 && (
        <Input
          type="search"
          placeholder="Filtrer par nom…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-xs"
        />
      )}

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {filtered.map((candidate) => (
          <label
            key={candidate.id}
            className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/50"
          >
            <input type="checkbox" name="userId" value={candidate.id} className="size-4 accent-primary" />
            <span className="font-medium">{candidate.name}</span>
            {candidate.lastPromotionName && (
              <span className="ml-auto text-xs text-muted-foreground">
                dernière : {candidate.lastPromotionName}
              </span>
            )}
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">Aucun nom ne correspond.</p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Inscription…" : "Inscrire les participants cochés"}
        </Button>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      {state.results && state.results.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          {state.results.map((result) => (
            <li key={result.userId}>
              {result.status === "registered" && (
                <span className="text-gain">✓ {result.name} inscrit·e</span>
              )}
              {result.status === "already-registered" && (
                <span className="text-muted-foreground">• {result.name} était déjà inscrit·e</span>
              )}
              {result.status === "blocked-active-elsewhere" && (
                <span className="text-destructive">
                  ✕ {result.name} — déjà dans « {result.promotionName} » (promotion active)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
```

- [ ] **Step 3 : Câbler la page détail**

Dans `src/app/admin/promotions/[id]/page.tsx` :

1. Imports supplémentaires :

```ts
import { PromotionStatus } from "@/generated/prisma/enums";
import { AddExistingParticipantsForm } from "./add-existing-participants-form";
import { unregisterParticipantAction } from "./participants-actions";
```
(le fichier importe déjà `ChangeSessionKind` depuis `@/generated/prisma/enums` — ajouter `PromotionStatus` à cet import existant plutôt qu'une seconde ligne)

2. Remplacer le `include` de la requête `promotion` :

```ts
  const promotion = await db.promotion.findUnique({
    where: { id },
    include: {
      changeSessions: { orderBy: { opensAt: "asc" } },
      participants: {
        orderBy: { user: { name: "asc" } },
        select: { userId: true, user: { select: { name: true } } },
      },
    },
  });
```

3. Après `if (!promotion) notFound();` et le calcul de `rules`, charger les candidats :

```ts
  const registeredIds = promotion.participants.map((participant) => participant.userId);
  const candidateUsers = await db.user.findMany({
    where: {
      role: "PARTICIPANT",
      ...(registeredIds.length > 0 ? { id: { notIn: registeredIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      promotionParticipations: {
        orderBy: { promotion: { createdAt: "desc" } },
        take: 1,
        select: { promotion: { select: { name: true } } },
      },
    },
  });
  const candidates = candidateUsers.map((user) => ({
    id: user.id,
    name: user.name,
    lastPromotionName: user.promotionParticipations[0]?.promotion.name ?? null,
  }));
  const isDraft = promotion.status === PromotionStatus.DRAFT;
```

4. Remplacer la `<Card>` « Participants » (lignes ~88-107) par :

```tsx
      <Card>
        <CardHeader>
          <CardTitle>Participants ({promotion.participants.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {promotion.participants.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {promotion.participants.map((participant) => (
                <li key={participant.userId} className="flex items-center gap-1">
                  <Badge variant="secondary">{participant.user.name}</Badge>
                  {isDraft && (
                    <form action={unregisterParticipantAction.bind(null, promotion.id, participant.userId)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Retirer ${participant.user.name}`}
                      >
                        ✕
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun participant inscrit pour le moment.</p>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Créer de nouveaux comptes</p>
            <BulkParticipantsForm promotionId={promotion.id} />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Ajouter des participants existants</p>
            <AddExistingParticipantsForm promotionId={promotion.id} candidates={candidates} />
          </div>

          <Link href="/admin/participants" className="text-sm text-muted-foreground hover:underline">
            Gérer tous les participants →
          </Link>
        </CardContent>
      </Card>
```

- [ ] **Step 4 : Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Vérification manuelle**

```
npm run dev
```
1. `/admin/promotions` → créer une promotion (reste DRAFT).
2. Page détail → carte Participants : « Créer de nouveaux comptes » crée 2 comptes ; ils apparaissent dans le roster avec un ✕.
3. « Ajouter des participants existants » : la liste montre les autres participants (pas ceux déjà inscrits), avec leur dernière promotion ; cocher 1-2 → « Inscrire » → compte-rendu ✓, roster mis à jour.
4. Cliquer ✕ sur un inscrit (promotion DRAFT) → il disparaît du roster.
5. Passer la promotion ACTIVE (`/admin/promotions`, bouton statut) → revenir sur le détail : plus de ✕ (roster verrouillé) ; le classement `/leaderboard` (connecté en participant inscrit) ne liste que les inscrits.

- [ ] **Step 6 : Commit**

```bash
git add "src/app/admin/promotions/[id]/participants-actions.ts" "src/app/admin/promotions/[id]/add-existing-participants-form.tsx" "src/app/admin/promotions/[id]/page.tsx"
git commit -m "feat: select existing participants into a promotion from its detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 6 : `/admin/participants` — colonne multi-promotions

**Files:**
- Modify: `src/app/admin/participants/page.tsx`

**Interfaces:**
- Consumes : `db.user.promotionParticipations` (Task 1). L'action `addParticipantToPromotion` et le composant `participant-row-actions.tsx` ont déjà été recâblés en Task 4 Step 8 — **ne pas y retoucher ici**.

- [ ] **Step 1 : Mettre à jour la requête et l'affichage de la page**

Dans `src/app/admin/participants/page.tsx`, remplacer le `db.user.findMany` (lignes ~19-30) par :

```ts
    db.user.findMany({
      where: { role: "PARTICIPANT" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        promotionId: true,
        promotionParticipations: {
          orderBy: { promotion: { createdAt: "desc" } },
          select: { promotionId: true, promotion: { select: { name: true } } },
        },
        portfolios: { select: { id: true, promotionId: true } },
      },
    }),
```

Remplacer la `<TableCell>` de la colonne « Promotion » (lignes ~50-56) par :

```tsx
                <TableCell>
                  {user.promotionParticipations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.promotionParticipations.map((participation) => (
                        <Badge
                          key={participation.promotionId}
                          variant={participation.promotionId === user.promotionId ? "default" : "secondary"}
                        >
                          {participation.promotion.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="secondary">Aucune</Badge>
                  )}
                </TableCell>
```

(Le calcul `currentPortfolio` juste au-dessus et le reste de la ligne restent inchangés — `user.promotionId` est toujours sélectionné. `ParticipantRowActions` reçoit toujours `currentPromotionId={user.promotionId}` et `promotions`.)

- [ ] **Step 2 : Vérifier compilation + suite**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur TS ; toute la suite PASS.

- [ ] **Step 3 : Vérification manuelle**

1. `/admin/participants` : la colonne Promotion montre, pour un participant ayant fait 2 saisons, 2 badges (l'active en couleur pleine).
2. « Modifier » sur une ligne → choisir une promotion → « Ajouter à cette promotion » → le badge apparaît ; s'il est déjà dans une promotion ACTIVE différente, message d'erreur explicite.
3. Régression : « Créer un participant » (formulaire du haut) fonctionne toujours et provisionne le portefeuille si la promotion est active.

- [ ] **Step 4 : Commit**

```bash
git add src/app/admin/participants/page.tsx
git commit -m "feat: /admin/participants shows all promotions a participant has joined

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

---

## Task 7 : Documentation + vérification finale

**Files:**
- Modify: `docs/ADMINISTRATION.md`

- [ ] **Step 1 : Documenter le flux**

Dans `docs/ADMINISTRATION.md`, repérer la section qui décrit la gestion des participants / création d'une promotion (chercher « participant » ou « promotion »). Ajouter un paragraphe :

```markdown
### Inscrire des participants à une promotion

La participation est **liée à chaque promotion** : un participant d'une saison
passée n'a accès à une nouvelle promotion que si l'admin l'y inscrit
explicitement. Depuis la page détail d'une promotion (`/admin/promotions/<id>`),
carte **Participants** :

- **Créer de nouveaux comptes** — génère des comptes + mots de passe temporaires.
- **Ajouter des participants existants** — liste à cocher de tous les participants
  déjà connus (avec leur dernière promotion en repère). Les cocher les inscrit à
  cette promotion ; un portefeuille leur est créé si la promotion est déjà active.

Tant que la promotion est en **brouillon**, un participant inscrit peut être
retiré (✕ à côté de son nom). Une fois la promotion active ou clôturée, le roster
est verrouillé (retirer quelqu'un fausserait classement et historique).

Les participants non inscrits n'apparaissent pas dans le classement de la nouvelle
promotion et n'y ont pas accès. Chaque participation garde son portefeuille, son
classement et son historique propres ; l'historique des anciennes promotions est
conservé.
```

- [ ] **Step 2 : Vérification complète**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: suite verte ; pas d'erreur TS ; build réussi (inclut `prisma migrate deploy` — la migration `20260903120000_promotion_participant` est déjà appliquée, no-op).

- [ ] **Step 3 : Commit**

```bash
git add docs/ADMINISTRATION.md
git commit -m "docs: document per-promotion participant registration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UqBLYU3dCAE8iUT3wtRGD8"
```

- [ ] **Step 4 : Pousser la branche**

```bash
git push -u origin feat/promotion-participant-selection
```

---

## Self-Review — couverture du spec

| Exigence du spec | Tâche(s) |
|---|---|
| Table `PromotionParticipant` + relations + backfill | 1 |
| `User.promotionId` conservé comme pointeur, commentaire ponytail | 1 |
| Module `registerParticipants` / `unregisterParticipant` avec garde ACTIVE | 2 |
| `provisionPortfolios` lit la table de liaison | 3 |
| `create-participant` ne fixe plus `promotionId`, renvoie l'`id` | 4 |
| Création (simple + groupée) routée via le module | 4 |
| `reassignParticipantPromotion` → `addParticipantToPromotion` (+ recâblage row-actions) | 4 |
| Actions `addExistingParticipants` / `unregisterParticipantAction` | 5 |
| Carte « ajouter des participants existants » (cases à cocher + filtre + dernière promotion) | 5 |
| Roster page détail via `participants`, ✕ seulement en DRAFT | 5 |
| `/admin/participants` colonne multi-promotions | 6 |
| Non-inscrits absents du classement / sans accès | Vérifs manuelles Task 5 Step 5, Task 6 Step 3 (mécanisme : pas de `Portfolio` → absent de `getLeaderboard` ; `user.promotionId` inchangé) |
| Historique conservé | 1 (table additive), aucune suppression de `Portfolio`/snapshot/`HallOfFameEntry` |
| Ne pas casser l'existant | 3 Step 5, 4 Step 9, 7 Step 2 (suite + build) ; backfill 1 Step 5 |
| Doc | 7 |

**Hors périmètre (spec)** : suppression de `User.promotionId`, sélecteur de promotion côté participant, sélection dans le formulaire de création — non planifiés, conformément au spec.
