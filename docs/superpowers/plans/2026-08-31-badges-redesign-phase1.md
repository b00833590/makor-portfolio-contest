# Refonte du système de badges — Plan d'implémentation (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réécrire le catalogue de badges (40 badges), corriger le moteur d'évaluation, refondre l'onglet `/badges` en vitrine de collection et enrichir les notifications de déblocage — **sans aucune migration de schéma Prisma**.

**Architecture:** Le catalogue est du code (`BADGE_CATALOG`, agrégé depuis `src/lib/gamification/badges/*.ts`). `ensureBadgesSeeded()` fait un `upsert` des lignes `Badge` à chaque évaluation → réécrire le catalogue ne demande pas de migration. Les enums `BadgeCategory` / `BadgeRarity` sont inchangés ; les 6 catégories affichées sont un relibellé. Les `UserBadge` sous d'anciens codes restent en base mais sont masqués (board construit depuis le catalogue).

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Prisma 7 + Postgres, Zod, Vitest, `sonner` (toasts), Tailwind v4, shadcn/ui (`@base-ui/react`).

## Global Constraints

- **Zéro migration de schéma.** Aucun `prisma migrate`, aucun changement de `schema.prisma`.
- Aucune écriture sur les `UserBadge` / `Badge` existants hors `upsert` du catalogue par `ensureBadgesSeeded`.
- Tous les fichiers `src/lib/**` portent `import "server-only"` en tête (sauf les modules purs sans I/O — ex. `badges/*.ts`, qui n'en ont pas et ne doivent pas en avoir).
- Frontière server/client : `"use client"` en ligne 1 uniquement si state/effects/handlers. Ne jamais importer un module `server-only` depuis un fichier client.
- Style : `type Props = {}` pour les composants, pas de `React.FC`, imports type-only séparés, immutabilité (spreads).
- Commits : format `<type>: <description>` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`). Terminer chaque message par les deux lignes :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Dq6FexqX86uWKMZGr13mtX
  ```
- Vérif finale obligatoire : `npx tsc --noEmit` clean, `npx eslint <fichiers>` clean, `npx vitest run` vert, `npm run build` exit 0.
- Branche : travailler sur `master` (convention du dépôt — voir git log).
- Spec de référence : `docs/superpowers/specs/2026-08-31-badges-redesign-design.md`. En cas de doute sur un seuil ou une condition, le §6 de la spec fait foi.

---

## Structure de fichiers

### Modifiés
- `src/lib/promotion-rules.ts` — valeurs par défaut des règles admin
- `src/lib/gamification/badges/types.ts` — nouveaux champs de `BadgeEvaluationContext`
- `src/lib/gamification/badges/badge-test-context.ts` — `baseContext` mis à jour
- `src/lib/gamification/badges/performance.ts` — 5 badges réécrits
- `src/lib/gamification/badges/trading.ts` — 7 badges + `LE_BON_INSTINCT` rapatrié
- `src/lib/gamification/badges/ranking-badges.ts` — 8 badges (catégorie « Compétition »)
- `src/lib/gamification/badges/risk-management.ts` — 3 badges (`SANS_FAUTE` déplacé ailleurs)
- `src/lib/gamification/badges/diversification.ts` — 4 badges
- `src/lib/gamification/badges/distinction.ts` — 9 badges (Exploits)
- `src/lib/gamification/badges/special-event.ts` — 4 badges (Fun)
- `src/lib/gamification/badges/catalog.ts` — assemblage + `CLOSE_ONLY_CODES`
- `src/lib/gamification/evaluate-badges.ts` — champs dérivés dans `buildEvaluationContext`, `AwardedBadge` enrichi, exclusivité `LEVE_TOT`
- `src/lib/gamification/award-close-only-badges.ts` — renommages + import
- `src/lib/gamification/get-badge-board.ts` — compteurs par catégorie + par rareté
- `src/lib/gamification/get-user-badges.ts` — (aucun changement de forme ; vérifier)
- `src/lib/gamification/get-unseen-badges.ts` — expose `icon` + `description`
- `src/lib/gamification/badge-display.ts` — libellés catégories + classes rareté
- `src/app/badges/page.tsx` — nouvelle composition
- `src/app/badges/badge-grid.tsx` — sections + filtres (remplace onglets)
- `src/app/badges/badge-card.tsx` — condition visible, liseré rareté
- `src/components/badges/unseen-badge-toaster.tsx` — utilise le nouveau composant de toast
- `src/app/dashboard/use-badge-toast.ts` — idem
- Tests : `src/lib/gamification/badges/*.test.ts`, `evaluate-badges.test.ts`, `award-close-only-badges.test.ts`, `get-badge-board.test.ts`

### Créés
- `src/lib/gamification/badges/post-buy-gain.ts` — `computeMaxPostBuyGainPct` extrait de `conviction.ts`
- `src/app/badges/badges-header.tsx` — bloc d'en-tête unique (compteur + barre segmentée + niveau)
- `src/components/badges/badge-unlock-toast.tsx` — rendu de toast de déblocage partagé
- `scripts/badge-dryrun.ts` — vérification lecture seule sur la prod

### Supprimés
- `src/lib/gamification/badges/conviction.ts` — vidé (badges répartis, helper extrait)
- `src/lib/gamification/badges/conviction.test.ts` — remplacé par les tests trading/distinction

---

## Task 1 : Valeurs par défaut des règles admin

**Files:**
- Modify: `src/lib/promotion-rules.ts`
- Test: `src/lib/promotion-rules.test.ts` (créer si absent — vérifier d'abord : `ls src/lib/promotion-rules.test.ts`)

**Interfaces:**
- Produces: `defaultPromotionRules` avec `changeSessionsPerWeek: 1`, `maxChangesPerSession: 6`.

- [ ] **Step 1 : Vérifier l'existence du fichier de test**

Run: `ls src/lib/promotion-rules.test.ts 2>/dev/null || echo "absent"`

- [ ] **Step 2 : Écrire / compléter le test**

Si le fichier existe, ajouter le `describe` ci-dessous. Sinon, créer `src/lib/promotion-rules.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { defaultPromotionRules, promotionRulesSchema } from "./promotion-rules";

describe("defaultPromotionRules", () => {
  it("propose 1 session de changement par semaine et 6 changements par session", () => {
    expect(defaultPromotionRules.changeSessionsPerWeek).toBe(1);
    expect(defaultPromotionRules.maxChangesPerSession).toBe(6);
  });

  it("reste un jeu de règles valide au regard du schéma", () => {
    expect(() => promotionRulesSchema.parse(defaultPromotionRules)).not.toThrow();
  });
});
```

- [ ] **Step 3 : Lancer le test — doit échouer**

Run: `npx vitest run src/lib/promotion-rules.test.ts`
Expected: FAIL (`changeSessionsPerWeek` vaut `2`, `maxChangesPerSession` vaut `4`)

- [ ] **Step 4 : Modifier `defaultPromotionRules`**

Dans `src/lib/promotion-rules.ts`, remplacer :

```ts
  changeSessionsPerWeek: 2,
  maxChangesPerSession: 4,
```

par :

```ts
  changeSessionsPerWeek: 1,
  maxChangesPerSession: 6,
```

- [ ] **Step 5 : Lancer le test — doit passer**

Run: `npx vitest run src/lib/promotion-rules.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/promotion-rules.ts src/lib/promotion-rules.test.ts
git commit -m "feat: default promo rules to 1 change session/week x 6 changes"
```

---

## Task 2 : Champs de contexte + fixture de test

**Files:**
- Modify: `src/lib/gamification/badges/types.ts`
- Modify: `src/lib/gamification/badges/badge-test-context.ts`

**Interfaces:**
- Produces: `BadgeEvaluationContext` gagne :
  - `fieldAverageReturnPct: number`
  - `hasBestWeeklyReturn: boolean`
  - `distinctAssetsTradedCount: number`
  - `holdsStockAndCrypto: boolean`
  - `maxPositionConcentrationPct: number | null`
  - `hasAnchorPosition: boolean`
  - `regainedFirstPlace: boolean`
- Produces: `BadgeEvaluationContext` **perd** `sectorAllocation` et `currencyAllocation` (badges supprimés).
- Produces: `baseContext(overrides?)` fournit des valeurs neutres pour tous les nouveaux champs, `totalBadgeCount: 40`.

- [ ] **Step 1 : Modifier `types.ts`**

Dans `src/lib/gamification/badges/types.ts` :

- Supprimer l'import `import type { AllocationSlice } from "../get-participant-stats";` (plus utilisé).
- Dans `BadgeEvaluationContext`, **retirer** les deux lignes :
  ```ts
  sectorAllocation: AllocationSlice[];
  currencyAllocation: AllocationSlice[];
  ```
- **Ajouter** dans `BadgeEvaluationContext`, avant `alreadyOwnedCodes` :
  ```ts
  /** Moyenne de `cumulativeReturnPct` sur tous les participants du classement. */
  fieldAverageReturnPct: number;
  /** Ce participant a le meilleur rendement 7 jours glissants de tous les participants (min 2 valeurs). */
  hasBestWeeklyReturn: boolean;
  /** Nombre d'actifs distincts jamais tradés (transactions), ouverts ou non. */
  distinctAssetsTradedCount: number;
  /** Détient au moins une action ET au moins une crypto en position ouverte. */
  holdsStockAndCrypto: boolean;
  /** Poids (%) de la plus grosse position ouverte dans la valeur investie ; `null` si aucune position. */
  maxPositionConcentrationPct: number | null;
  /** Existe une position ouverte : âge >= 21 j, P&L latent >= +10%, jamais renforcée ni allégée. */
  hasAnchorPosition: boolean;
  /** A été 1er, l'a perdu au moins un snapshot, et est 1er à nouveau maintenant. */
  regainedFirstPlace: boolean;
  ```

- [ ] **Step 2 : Modifier `badge-test-context.ts`**

Remplacer entièrement `src/lib/gamification/badges/badge-test-context.ts` par :

```ts
import type { BadgeEvaluationContext } from "./types";

export const NOW = new Date("2026-09-15T12:00:00Z");

/** Fixture partagée par tous les tests de badges — un contexte neutre où aucun badge n'est attribué. */
export function baseContext(overrides: Partial<BadgeEvaluationContext> = {}): BadgeEvaluationContext {
  return {
    now: NOW,
    openPositionCount: 0,
    maxPositions: 20,
    investedValue: 0,
    positions: [],
    transactionCount: 0,
    firstTransactionDate: null,
    lastTransactionDate: null,
    closedTradesChronological: [],
    hasSuccessfulArbitrage: false,
    postBuyMaxGainPct: null,
    cumulativeReturnPct: 0,
    dailyReturnPct: null,
    currentRank: null,
    previousRank: null,
    gapToSecondPts: null,
    rankHistory: [],
    participantCount: 1,
    weeklyChangeWindows: [],
    currentStreakDays: 0,
    longestStreakDays: 0,
    fieldAverageReturnPct: 0,
    hasBestWeeklyReturn: false,
    distinctAssetsTradedCount: 0,
    holdsStockAndCrypto: false,
    maxPositionConcentrationPct: null,
    hasAnchorPosition: false,
    regainedFirstPlace: false,
    alreadyOwnedCodes: new Set(),
    totalBadgeCount: 40,
    ...overrides,
  };
}
```

- [ ] **Step 3 : Vérifier la compilation (échouera ailleurs, c'est attendu)**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: des erreurs dans `performance.ts`, `evaluate-badges.ts`, etc. (catalogue pas encore réécrit). **Aucune erreur ne doit venir de `types.ts` ou `badge-test-context.ts` eux-mêmes.**

- [ ] **Step 4 : Commit**

```bash
git add src/lib/gamification/badges/types.ts src/lib/gamification/badges/badge-test-context.ts
git commit -m "refactor: badge context — add derived fields, drop sector/currency allocation"
```

---

## Task 3 : Helper `post-buy-gain.ts` (extraction depuis `conviction.ts`)

**Files:**
- Create: `src/lib/gamification/badges/post-buy-gain.ts`
- Test: `src/lib/gamification/badges/post-buy-gain.test.ts`

**Interfaces:**
- Produces: `computeMaxPostBuyGainPct(buys: BuyForGainScan[], priceHistoryByAsset: Map<string, PriceHistoryPoint[]>): number | null`
- Produces: `interface BuyForGainScan { assetId: string; price: number; createdAt: Date }`
- Produces: `interface PriceHistoryPoint { price: number; timestamp: Date }`

- [ ] **Step 1 : Créer `post-buy-gain.ts`**

Contenu identique à l'actuel `conviction.ts` privé de ses `BadgeSpec`. Créer `src/lib/gamification/badges/post-buy-gain.ts` :

```ts
export interface BuyForGainScan {
  assetId: string;
  price: number;
  createdAt: Date;
}

export interface PriceHistoryPoint {
  price: number;
  timestamp: Date;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Meilleur gain % atteint dans les 5 jours suivant un achat, tous achats confondus — `null` si
 * aucun achat n'a de données de prix postérieures disponibles.
 */
export function computeMaxPostBuyGainPct(
  buys: BuyForGainScan[],
  priceHistoryByAsset: Map<string, PriceHistoryPoint[]>,
): number | null {
  let best: number | null = null;

  for (const buy of buys) {
    if (buy.price <= 0) continue;
    const windowEnd = buy.createdAt.getTime() + FIVE_DAYS_MS;
    const pricesAfter = (priceHistoryByAsset.get(buy.assetId) ?? []).filter(
      (point) => point.timestamp.getTime() >= buy.createdAt.getTime() && point.timestamp.getTime() <= windowEnd,
    );
    for (const point of pricesAfter) {
      const gainPct = ((point.price - buy.price) / buy.price) * 100;
      if (best === null || gainPct > best) best = gainPct;
    }
  }

  return best;
}
```

- [ ] **Step 2 : Écrire le test**

Créer `src/lib/gamification/badges/post-buy-gain.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { computeMaxPostBuyGainPct } from "./post-buy-gain";

const BUY_DATE = new Date("2026-09-01T00:00:00Z");

describe("computeMaxPostBuyGainPct", () => {
  it("retourne le meilleur gain dans la fenêtre de 5 jours", () => {
    const result = computeMaxPostBuyGainPct(
      [{ assetId: "a", price: 100, createdAt: BUY_DATE }],
      new Map([["a", [
        { price: 110, timestamp: new Date("2026-09-02T00:00:00Z") },
        { price: 125, timestamp: new Date("2026-09-04T00:00:00Z") },
      ]]]),
    );
    expect(result).toBe(25);
  });

  it("ignore les prix au-delà de 5 jours", () => {
    const result = computeMaxPostBuyGainPct(
      [{ assetId: "a", price: 100, createdAt: BUY_DATE }],
      new Map([["a", [{ price: 200, timestamp: new Date("2026-09-10T00:00:00Z") }]]]),
    );
    expect(result).toBeNull();
  });

  it("retourne null sans historique de prix", () => {
    expect(computeMaxPostBuyGainPct([{ assetId: "a", price: 100, createdAt: BUY_DATE }], new Map())).toBeNull();
  });
});
```

- [ ] **Step 3 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/badges/post-buy-gain.test.ts`
Expected: PASS

- [ ] **Step 4 : Commit**

```bash
git add src/lib/gamification/badges/post-buy-gain.ts src/lib/gamification/badges/post-buy-gain.test.ts
git commit -m "refactor: extract computeMaxPostBuyGainPct into post-buy-gain module"
```

---

## Task 4 : Badges Performance (`performance.ts`)

**Files:**
- Modify (remplacer intégralement) : `src/lib/gamification/badges/performance.ts`
- Test (remplacer) : `src/lib/gamification/badges/performance.test.ts`

**Interfaces:**
- Consumes: `BadgeEvaluationContext` (Task 2), `BadgeSpec` (`./types`).
- Produces: `export const performanceBadges: BadgeSpec[]` — 5 entrées : `PREMIER_ENVOL`, `DANS_LE_VERT`, `SURPERFORMANCE`, `AUTRE_GALAXIE`, `ALPHA`. Toutes `category: "PERFORMANCE"`, toutes avec `evaluate`.

- [ ] **Step 1 : Écrire les tests (échouent)**

Remplacer `src/lib/gamification/badges/performance.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { performanceBadges } from "./performance";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = performanceBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("PREMIER_ENVOL", () => {
  it("attribué à +3%", () => expect(ev("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 3 }))).toBe(true));
  it("pas attribué à +2.9%", () => expect(ev("PREMIER_ENVOL")(baseContext({ cumulativeReturnPct: 2.9 }))).toBe(false));
});

describe("DANS_LE_VERT", () => {
  it("attribué à +8%", () => expect(ev("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 8 }))).toBe(true));
  it("pas attribué à +7.9%", () => expect(ev("DANS_LE_VERT")(baseContext({ cumulativeReturnPct: 7.9 }))).toBe(false));
});

describe("SURPERFORMANCE", () => {
  it("attribué à +18%", () => expect(ev("SURPERFORMANCE")(baseContext({ cumulativeReturnPct: 18 }))).toBe(true));
  it("pas attribué à +17%", () => expect(ev("SURPERFORMANCE")(baseContext({ cumulativeReturnPct: 17 }))).toBe(false));
});

describe("AUTRE_GALAXIE", () => {
  it("attribué à +28%", () => expect(ev("AUTRE_GALAXIE")(baseContext({ cumulativeReturnPct: 28 }))).toBe(true));
  it("pas attribué à +27%", () => expect(ev("AUTRE_GALAXIE")(baseContext({ cumulativeReturnPct: 27 }))).toBe(false));
});

describe("ALPHA", () => {
  it("attribué si +12 pts au-dessus de la moyenne (min 3 participants)", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 15, fieldAverageReturnPct: 3, participantCount: 3 }))).toBe(true));
  it("pas attribué sous +12 pts d'écart", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 14, fieldAverageReturnPct: 3, participantCount: 3 }))).toBe(false));
  it("pas attribué à moins de 3 participants", () =>
    expect(ev("ALPHA")(baseContext({ cumulativeReturnPct: 20, fieldAverageReturnPct: 3, participantCount: 2 }))).toBe(false));
});
```

- [ ] **Step 2 : Lancer — doit échouer**

Run: `npx vitest run src/lib/gamification/badges/performance.test.ts`
Expected: FAIL (codes inexistants)

- [ ] **Step 3 : Écrire `performance.ts`**

Remplacer intégralement `src/lib/gamification/badges/performance.ts` :

```ts
import type { BadgeSpec } from "./types";

const ALPHA_MIN_OUTPERFORMANCE_PTS = 12;
const ALPHA_MIN_PARTICIPANTS = 3;

export const performanceBadges: BadgeSpec[] = [
  {
    code: "PREMIER_ENVOL",
    name: "Premier envol",
    description: "Votre portefeuille a dépassé +3% de rendement cumulé pour la première fois.",
    condition: "Dépasser +3% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "COMMON",
    icon: "🛫",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 3,
  },
  {
    code: "DANS_LE_VERT",
    name: "Dans le vert",
    description: "Votre portefeuille a atteint +8% de rendement cumulé.",
    condition: "Atteindre +8% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "📈",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 8,
  },
  {
    code: "SURPERFORMANCE",
    name: "Surperformance",
    description: "Votre portefeuille a atteint +18% de rendement cumulé.",
    condition: "Atteindre +18% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "EPIC",
    icon: "🪐",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 18,
  },
  {
    code: "AUTRE_GALAXIE",
    name: "Autre galaxie",
    description: "Votre portefeuille a atteint +28% de rendement cumulé.",
    condition: "Atteindre +28% de rendement cumulé",
    category: "PERFORMANCE",
    rarity: "LEGENDARY",
    icon: "🌌",
    evaluate: (ctx) => ctx.cumulativeReturnPct >= 28,
  },
  {
    code: "ALPHA",
    name: "Alpha",
    description: "Votre rendement dépasse la moyenne du concours de plus de 12 points.",
    condition: "Battre la moyenne de rendement du concours de plus de 12 points",
    category: "PERFORMANCE",
    rarity: "RARE",
    icon: "📊",
    evaluate: (ctx) =>
      ctx.participantCount >= ALPHA_MIN_PARTICIPANTS &&
      ctx.cumulativeReturnPct - ctx.fieldAverageReturnPct >= ALPHA_MIN_OUTPERFORMANCE_PTS,
  },
];
```

- [ ] **Step 4 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/badges/performance.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/gamification/badges/performance.ts src/lib/gamification/badges/performance.test.ts
git commit -m "feat: rewrite performance badges (5) — recalibrated thresholds + ALPHA"
```

---

## Task 5 : Badges Compétition (`ranking-badges.ts`)

**Files:**
- Modify (remplacer intégralement) : `src/lib/gamification/badges/ranking-badges.ts`
- Test (remplacer) : `src/lib/gamification/badges/ranking-badges.test.ts`

**Interfaces:**
- Consumes: `BadgeEvaluationContext` (Task 2), `BadgeSpec`.
- Produces: `export const rankingBadges: BadgeSpec[]` — 8 entrées avec `evaluate`, toutes `category: "RANKING"` : `SUR_LE_PODIUM`, `SUR_LE_TOIT`, `CHASSEUR_DE_TETE`, `MEILLEURE_SEMAINE`, `FUSEE`, `REMONTADA`, `DOMINATION`, `REGNE`.
- **`LE_PHENIX` n'est plus exporté d'ici** — il passe en `distinction.ts` (Task 8) avec `category: "DISTINCTION"`.
- Produces: `export function isLeaderForConsecutiveDays(ctx: { rankHistory: { rank: number | null }[] }, days: number): boolean` (réutilisé par les tests).

- [ ] **Step 1 : Écrire les tests (échouent)**

Remplacer `src/lib/gamification/badges/ranking-badges.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { rankingBadges } from "./ranking-badges";
import { baseContext, NOW } from "./badge-test-context";

function ev(code: string) {
  const b = rankingBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const rh = (ranks: (number | null)[]) => ranks.map((rank) => ({ timestamp: NOW, rank }));

describe("SUR_LE_PODIUM", () => {
  it("attribué au top 3 (>= 4 participants)", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 3, participantCount: 6 }))).toBe(true));
  it("pas attribué en 4e", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 4, participantCount: 6 }))).toBe(false));
  it("pas attribué à moins de 4 participants", () =>
    expect(ev("SUR_LE_PODIUM")(baseContext({ currentRank: 1, participantCount: 3 }))).toBe(false));
});

describe("SUR_LE_TOIT", () => {
  it("attribué en 1ère place (>= 3 participants)", () =>
    expect(ev("SUR_LE_TOIT")(baseContext({ currentRank: 1, participantCount: 3 }))).toBe(true));
  it("pas attribué en 2e", () =>
    expect(ev("SUR_LE_TOIT")(baseContext({ currentRank: 2, participantCount: 3 }))).toBe(false));
});

describe("CHASSEUR_DE_TETE", () => {
  it("attribué quand on reprend la 1ère place après l'avoir perdue", () =>
    expect(ev("CHASSEUR_DE_TETE")(baseContext({ regainedFirstPlace: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("CHASSEUR_DE_TETE")(baseContext({ regainedFirstPlace: false }))).toBe(false));
});

describe("MEILLEURE_SEMAINE", () => {
  it("attribué au meilleur rendement hebdo du concours", () =>
    expect(ev("MEILLEURE_SEMAINE")(baseContext({ hasBestWeeklyReturn: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("MEILLEURE_SEMAINE")(baseContext({ hasBestWeeklyReturn: false }))).toBe(false));
});

describe("FUSEE", () => {
  it("attribué à +8% en une journée", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: 8 }))).toBe(true));
  it("pas attribué à +7.9%", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: 7.9 }))).toBe(false));
  it("pas attribué sans rendement journalier", () =>
    expect(ev("FUSEE")(baseContext({ dailyReturnPct: null }))).toBe(false));
});

describe("REMONTADA", () => {
  it("attribué pour +5 places en un jour", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 3, previousRank: 8 }))).toBe(true));
  it("pas attribué pour +4 places", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 4, previousRank: 8 }))).toBe(false));
  it("pas attribué sans rang précédent", () =>
    expect(ev("REMONTADA")(baseContext({ currentRank: 1, previousRank: null }))).toBe(false));
});

describe("DOMINATION", () => {
  it("attribué 1er avec +8 pts d'avance", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 8 }))).toBe(true));
  it("pas attribué avec +7.9 pts", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 1, gapToSecondPts: 7.9 }))).toBe(false));
  it("pas attribué si pas 1er", () =>
    expect(ev("DOMINATION")(baseContext({ currentRank: 2, gapToSecondPts: 20 }))).toBe(false));
});

describe("REGNE", () => {
  it("attribué pour 5 snapshots consécutifs en tête", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, 1, 1, 1]) }))).toBe(true));
  it("pas attribué avec seulement 4", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, 1, 1]) }))).toBe(false));
  it("un null casse la série", () =>
    expect(ev("REGNE")(baseContext({ rankHistory: rh([1, 1, null, 1, 1, 1]) }))).toBe(false));
});
```

- [ ] **Step 2 : Lancer — doit échouer**

Run: `npx vitest run src/lib/gamification/badges/ranking-badges.test.ts`
Expected: FAIL

- [ ] **Step 3 : Écrire `ranking-badges.ts`**

Remplacer intégralement `src/lib/gamification/badges/ranking-badges.ts` :

```ts
import type { BadgeSpec } from "./types";

const REGNE_DAYS = 5;
const REMONTADA_MIN_RANK_GAIN = 5;
const DOMINATION_MIN_GAP_PTS = 8;
const FUSEE_MIN_DAILY_RETURN_PCT = 8;
const PODIUM_MIN_PARTICIPANTS = 4;

/** Vrai si les `days` points de rang les plus récents (le plus récent en premier) valent tous 1. */
export function isLeaderForConsecutiveDays(ctx: { rankHistory: { rank: number | null }[] }, days: number): boolean {
  if (ctx.rankHistory.length < days) return false;
  return ctx.rankHistory.slice(0, days).every((point) => point.rank === 1);
}

export const rankingBadges: BadgeSpec[] = [
  {
    code: "SUR_LE_PODIUM",
    name: "Sur le podium",
    description: "Vous avez atteint le Top 3 du classement.",
    condition: "Atteindre le Top 3 du classement au moins une fois",
    category: "RANKING",
    rarity: "RARE",
    icon: "🥉",
    evaluate: (ctx) =>
      ctx.currentRank !== null && ctx.currentRank <= 3 && ctx.participantCount >= PODIUM_MIN_PARTICIPANTS,
  },
  {
    code: "SUR_LE_TOIT",
    name: "Sur le toit",
    description: "Vous avez atteint la 1ère place du classement.",
    condition: "Atteindre la 1ère place du classement au moins une fois",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🥇",
    evaluate: (ctx) => ctx.currentRank === 1 && ctx.participantCount >= 3,
  },
  {
    code: "CHASSEUR_DE_TETE",
    name: "Chasseur de tête",
    description: "Vous avez repris la 1ère place après l'avoir perdue.",
    condition: "Reprendre la 1ère place après l'avoir perdue au moins un jour",
    category: "RANKING",
    rarity: "RARE",
    icon: "🎯",
    evaluate: (ctx) => ctx.regainedFirstPlace,
  },
  {
    code: "MEILLEURE_SEMAINE",
    name: "Meilleure semaine",
    description: "Vous avez signé le meilleur rendement de tous les participants sur 7 jours.",
    condition: "Avoir le meilleur rendement sur 7 jours de tous les participants",
    category: "RANKING",
    rarity: "EPIC",
    icon: "📅",
    evaluate: (ctx) => ctx.hasBestWeeklyReturn,
  },
  {
    code: "FUSEE",
    name: "Fusée",
    description: "Vous avez réalisé une progression d'au moins +8% en une seule journée.",
    condition: "Réaliser une progression d'au moins +8% en une seule journée",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🚀",
    evaluate: (ctx) => ctx.dailyReturnPct !== null && ctx.dailyReturnPct >= FUSEE_MIN_DAILY_RETURN_PCT,
  },
  {
    code: "REMONTADA",
    name: "Remontada",
    description: "Vous avez gagné au moins 5 places au classement en une seule journée.",
    condition: "Gagner au moins 5 places au classement en une seule journée",
    category: "RANKING",
    rarity: "EPIC",
    icon: "🐎",
    evaluate: (ctx) => {
      if (ctx.currentRank === null || ctx.previousRank === null) return false;
      return ctx.previousRank - ctx.currentRank >= REMONTADA_MIN_RANK_GAIN;
    },
  },
  {
    code: "DOMINATION",
    name: "Domination",
    description: "Vous êtes 1er du classement avec au moins 8 points d'avance sur le 2e.",
    condition: "Être 1er du classement avec au moins 8 points d'avance sur le 2e",
    category: "RANKING",
    rarity: "EPIC",
    icon: "👊",
    evaluate: (ctx) =>
      ctx.currentRank === 1 && ctx.gapToSecondPts !== null && ctx.gapToSecondPts >= DOMINATION_MIN_GAP_PTS,
  },
  {
    code: "REGNE",
    name: "Règne",
    description: "Vous êtes resté(e) en tête du classement 5 jours consécutifs.",
    condition: "Rester en tête du classement 5 jours consécutifs",
    category: "RANKING",
    rarity: "EPIC",
    icon: "👑",
    evaluate: (ctx) => isLeaderForConsecutiveDays(ctx, REGNE_DAYS),
  },
];
```

- [ ] **Step 4 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/badges/ranking-badges.test.ts`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/lib/gamification/badges/ranking-badges.ts src/lib/gamification/badges/ranking-badges.test.ts
git commit -m "feat: rewrite competition badges (8), move LE_PHENIX to distinction"
```

---

## Task 6 : Badges Trading (`trading.ts`) + suppression de `conviction.ts`

**Files:**
- Modify (remplacer intégralement) : `src/lib/gamification/badges/trading.ts`
- Delete: `src/lib/gamification/badges/conviction.ts`, `src/lib/gamification/badges/conviction.test.ts`
- Test (remplacer) : `src/lib/gamification/badges/trading.test.ts`

**Interfaces:**
- Consumes: `computeHasSuccessfulArbitrage` (déjà dans ce fichier, inchangé — le garder), `BadgeSpec`.
- Produces: `export const tradingBadges: BadgeSpec[]` — 7 entrées `category: "TRADING"` avec `evaluate` : `PREMIER_PAS`, `PREMIERE_VICTOIRE`, `BEAU_MOVE`, `GROS_COUP`, `MAIN_CHAUDE`, `ARBITRAGISTE`, `LE_BON_INSTINCT`.
- Produces: `export function computeHasSuccessfulArbitrage(...)` et `export interface ArbitrageTransaction` — inchangés.
- Produces: `export function hasWinningStreak(trades: { pnlEur: number }[], count: number): boolean` (exporté pour les tests).

- [ ] **Step 1 : Écrire les tests (échouent)**

Remplacer `src/lib/gamification/badges/trading.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { tradingBadges } from "./trading";
import { baseContext, NOW } from "./badge-test-context";

function ev(code: string) {
  const b = tradingBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const trade = (pnlEur: number, pnlPct: number) => ({ pnlEur, pnlPct, closedAt: NOW });

describe("PREMIER_PAS", () => {
  it("attribué dès 1 transaction", () => expect(ev("PREMIER_PAS")(baseContext({ transactionCount: 1 }))).toBe(true));
  it("pas attribué à 0", () => expect(ev("PREMIER_PAS")(baseContext({ transactionCount: 0 }))).toBe(false));
});

describe("PREMIERE_VICTOIRE", () => {
  it("attribué avec une vente gagnante", () =>
    expect(ev("PREMIERE_VICTOIRE")(baseContext({ closedTradesChronological: [trade(10, 1)] }))).toBe(true));
  it("pas attribué avec seulement des ventes perdantes", () =>
    expect(ev("PREMIERE_VICTOIRE")(baseContext({ closedTradesChronological: [trade(-10, -1)] }))).toBe(false));
});

describe("BEAU_MOVE", () => {
  it("attribué à une vente +12%", () =>
    expect(ev("BEAU_MOVE")(baseContext({ closedTradesChronological: [trade(100, 12)] }))).toBe(true));
  it("pas attribué à +11.9%", () =>
    expect(ev("BEAU_MOVE")(baseContext({ closedTradesChronological: [trade(100, 11.9)] }))).toBe(false));
});

describe("GROS_COUP", () => {
  it("attribué à une vente +25%", () =>
    expect(ev("GROS_COUP")(baseContext({ closedTradesChronological: [trade(100, 25)] }))).toBe(true));
  it("pas attribué à +24%", () =>
    expect(ev("GROS_COUP")(baseContext({ closedTradesChronological: [trade(100, 24)] }))).toBe(false));
});

describe("MAIN_CHAUDE", () => {
  it("attribué pour 4 ventes gagnantes consécutives", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(1, 1), trade(1, 1), trade(1, 1)] }))).toBe(true));
  it("pas attribué si l'une est perdante", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(-1, -1), trade(1, 1), trade(1, 1)] }))).toBe(false));
  it("pas attribué avec seulement 3 ventes", () =>
    expect(ev("MAIN_CHAUDE")(baseContext({ closedTradesChronological: [trade(1, 1), trade(1, 1), trade(1, 1)] }))).toBe(false));
});

describe("ARBITRAGISTE", () => {
  it("attribué si un arbitrage réussi est détecté", () =>
    expect(ev("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("ARBITRAGISTE")(baseContext({ hasSuccessfulArbitrage: false }))).toBe(false));
});

describe("LE_BON_INSTINCT", () => {
  it("attribué si un achat prend +15% en 5 jours", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 15 }))).toBe(true));
  it("pas attribué à +14%", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: 14 }))).toBe(false));
  it("pas attribué sans donnée", () =>
    expect(ev("LE_BON_INSTINCT")(baseContext({ postBuyMaxGainPct: null }))).toBe(false));
});
```

- [ ] **Step 2 : Lancer — doit échouer**

Run: `npx vitest run src/lib/gamification/badges/trading.test.ts`
Expected: FAIL

- [ ] **Step 3 : Réécrire `trading.ts`**

Dans `src/lib/gamification/badges/trading.ts` :
- **Conserver** l'import `TransactionType`, `computeHasSuccessfulArbitrage`, `ArbitrageTransaction` (bloc actuel, inchangé).
- Remplacer la constante `MAIN_CHAUDE_STREAK = 5` par `= 4`.
- Supprimer `COUP_DOUBLE_GAIN_PCT`.
- **Exporter** `hasWinningStreak` (ajouter `export`).
- Ajouter les constantes `const BEAU_MOVE_GAIN_PCT = 12;`, `const GROS_COUP_GAIN_PCT = 25;`, `const LE_BON_INSTINCT_GAIN_PCT = 15;`.
- Remplacer le tableau `tradingBadges` par :

```ts
export const tradingBadges: BadgeSpec[] = [
  {
    code: "PREMIER_PAS",
    name: "Premier pas",
    description: "Vous avez réalisé votre première transaction.",
    condition: "Réaliser sa première transaction",
    category: "TRADING",
    rarity: "COMMON",
    icon: "🐣",
    evaluate: (ctx) => ctx.transactionCount >= 1,
  },
  {
    code: "PREMIERE_VICTOIRE",
    name: "Première prise",
    description: "Vous avez réalisé votre première vente gagnante.",
    condition: "Réaliser sa première vente gagnante",
    category: "TRADING",
    rarity: "COMMON",
    icon: "✅",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlEur >= 0),
  },
  {
    code: "BEAU_MOVE",
    name: "Beau move",
    description: "Vous avez réalisé une vente avec plus de 12% de gain.",
    condition: "Réaliser une vente avec au moins +12% de gain",
    category: "TRADING",
    rarity: "RARE",
    icon: "💰",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlPct >= BEAU_MOVE_GAIN_PCT),
  },
  {
    code: "GROS_COUP",
    name: "Gros coup",
    description: "Vous avez réalisé une vente avec plus de 25% de gain.",
    condition: "Réaliser une vente avec au moins +25% de gain",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🎆",
    evaluate: (ctx) => ctx.closedTradesChronological.some((trade) => trade.pnlPct >= GROS_COUP_GAIN_PCT),
  },
  {
    code: "MAIN_CHAUDE",
    name: "Main chaude",
    description: "Vous avez enchaîné 4 ventes gagnantes consécutives.",
    condition: "Enchaîner 4 ventes gagnantes consécutives",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🔥",
    evaluate: (ctx) => hasWinningStreak(ctx.closedTradesChronological, MAIN_CHAUDE_STREAK),
  },
  {
    code: "ARBITRAGISTE",
    name: "Arbitragiste",
    description: "Vous avez vendu une position puis racheté une autre, aujourd'hui gagnante, dans la même session de changement.",
    condition: "Vendre une position puis en racheter une autre gagnante dans la même session de changement",
    category: "TRADING",
    rarity: "RARE",
    icon: "🔁",
    evaluate: (ctx) => ctx.hasSuccessfulArbitrage,
  },
  {
    code: "LE_BON_INSTINCT",
    name: "Le bon instinct",
    description: "Vous avez acheté un actif juste avant une hausse d'au moins 15% dans les 5 jours suivants.",
    condition: "Acheter un actif qui prend au moins +15% dans les 5 jours suivant l'achat",
    category: "TRADING",
    rarity: "EPIC",
    icon: "🔮",
    evaluate: (ctx) => ctx.postBuyMaxGainPct !== null && ctx.postBuyMaxGainPct >= LE_BON_INSTINCT_GAIN_PCT,
  },
];
```

- [ ] **Step 4 : Supprimer `conviction.ts` et son test**

```bash
git rm src/lib/gamification/badges/conviction.ts src/lib/gamification/badges/conviction.test.ts
```

- [ ] **Step 5 : Lancer les tests trading — doivent passer**

Run: `npx vitest run src/lib/gamification/badges/trading.test.ts`
Expected: PASS

(Les erreurs `tsc` dans `catalog.ts` / `evaluate-badges.ts` / `award-close-only-badges.ts` liées à `conviction` sont attendues — corrigées aux Tasks 8 et 9.)

- [ ] **Step 6 : Commit**

```bash
git add src/lib/gamification/badges/trading.ts src/lib/gamification/badges/trading.test.ts
git commit -m "feat: rewrite trading badges (7), absorb LE_BON_INSTINCT, drop conviction module"
```

---

## Task 7 : Badges Sang-froid + Diversification

**Files:**
- Modify (remplacer intégralement) : `src/lib/gamification/badges/risk-management.ts`
- Modify (remplacer intégralement) : `src/lib/gamification/badges/diversification.ts`
- Test (remplacer) : `src/lib/gamification/badges/risk-management.test.ts`, `src/lib/gamification/badges/diversification.test.ts`

**Interfaces:**
- Produces: `export const riskManagementBadges: BadgeSpec[]` — 3 entrées `category: "RISK_MANAGEMENT"` avec `evaluate` : `SANG_FROID`, `TOUT_AU_VERT`, `PIERRE_ANGULAIRE`.
- **`SANS_FAUTE` n'est plus exporté d'ici** — il passe dans `distinction.ts` (Task 8), `category: "DISTINCTION"`, close-only.
- Produces: `export function positionPnlPct(position: { marketValue: number; costBasis: number }): number` (exporté pour tests).
- Produces: `export const diversificationBadges: BadgeSpec[]` — 4 entrées `category: "DIVERSIFICATION"` : `PORTEFEUILLE_COMPLET`, `RIEN_DANS_UN_PANIER`, `TOUCHE_A_TOUT`, `COLLECTIONNEUR`.

- [ ] **Step 1 : Écrire les tests (échouent)**

Remplacer `src/lib/gamification/badges/risk-management.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { riskManagementBadges } from "./risk-management";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = riskManagementBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}
const pos = (marketValue: number, costBasis: number) => ({ marketValue, costBasis });

describe("SANG_FROID", () => {
  it("attribué : 5 positions, aucune sous -5%", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(96, 100), pos(100, 100), pos(120, 100), pos(101, 100), pos(98, 100)] }))).toBe(true));
  it("pas attribué : une position à -6%", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(94, 100), pos(100, 100), pos(120, 100), pos(101, 100), pos(98, 100)] }))).toBe(false));
  it("pas attribué : moins de 5 positions", () =>
    expect(ev("SANG_FROID")(baseContext({ positions: [pos(100, 100), pos(100, 100), pos(100, 100), pos(100, 100)] }))).toBe(false));
});

describe("TOUT_AU_VERT", () => {
  it("attribué : 5 positions toutes en gain", () =>
    expect(ev("TOUT_AU_VERT")(baseContext({ positions: [pos(101, 100), pos(102, 100), pos(120, 100), pos(101, 100), pos(150, 100)] }))).toBe(true));
  it("pas attribué : une position à l'équilibre négatif", () =>
    expect(ev("TOUT_AU_VERT")(baseContext({ positions: [pos(99, 100), pos(102, 100), pos(120, 100), pos(101, 100), pos(150, 100)] }))).toBe(false));
});

describe("PIERRE_ANGULAIRE", () => {
  it("attribué si le contexte signale une position ancre", () =>
    expect(ev("PIERRE_ANGULAIRE")(baseContext({ hasAnchorPosition: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("PIERRE_ANGULAIRE")(baseContext({ hasAnchorPosition: false }))).toBe(false));
});
```

Remplacer `src/lib/gamification/badges/diversification.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { diversificationBadges } from "./diversification";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = diversificationBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("PORTEFEUILLE_COMPLET", () => {
  it("attribué au max de positions", () =>
    expect(ev("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true));
  it("pas attribué en dessous", () =>
    expect(ev("PORTEFEUILLE_COMPLET")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false));
});

describe("RIEN_DANS_UN_PANIER", () => {
  it("attribué : 8 positions, concentration max 12%", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 8, maxPositionConcentrationPct: 12 }))).toBe(true));
  it("pas attribué : concentration 12.1%", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 8, maxPositionConcentrationPct: 12.1 }))).toBe(false));
  it("pas attribué : moins de 8 positions", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 7, maxPositionConcentrationPct: 5 }))).toBe(false));
  it("pas attribué : concentration inconnue", () =>
    expect(ev("RIEN_DANS_UN_PANIER")(baseContext({ openPositionCount: 8, maxPositionConcentrationPct: null }))).toBe(false));
});

describe("TOUCHE_A_TOUT", () => {
  it("attribué si actions + crypto", () =>
    expect(ev("TOUCHE_A_TOUT")(baseContext({ holdsStockAndCrypto: true }))).toBe(true));
  it("pas attribué sinon", () =>
    expect(ev("TOUCHE_A_TOUT")(baseContext({ holdsStockAndCrypto: false }))).toBe(false));
});

describe("COLLECTIONNEUR", () => {
  it("attribué à 25 actifs distincts tradés", () =>
    expect(ev("COLLECTIONNEUR")(baseContext({ distinctAssetsTradedCount: 25 }))).toBe(true));
  it("pas attribué à 24", () =>
    expect(ev("COLLECTIONNEUR")(baseContext({ distinctAssetsTradedCount: 24 }))).toBe(false));
});
```

- [ ] **Step 2 : Lancer — doivent échouer**

Run: `npx vitest run src/lib/gamification/badges/risk-management.test.ts src/lib/gamification/badges/diversification.test.ts`
Expected: FAIL

- [ ] **Step 3 : Écrire `risk-management.ts`**

Remplacer intégralement :

```ts
import type { BadgeSpec } from "./types";

const MIN_POSITIONS_FOR_RISK_BADGES = 5;
const SANG_FROID_MAX_LOSS_PCT = -5;

export function positionPnlPct(position: { marketValue: number; costBasis: number }): number {
  if (position.costBasis <= 0) return 0;
  return ((position.marketValue - position.costBasis) / position.costBasis) * 100;
}

export const riskManagementBadges: BadgeSpec[] = [
  {
    code: "SANG_FROID",
    name: "Sang-froid",
    description: "Aucune de vos positions n'est en perte de plus de 5%.",
    condition: "Aucune position en perte de plus de 5% (au moins 5 positions)",
    category: "RISK_MANAGEMENT",
    rarity: "RARE",
    icon: "🧊",
    evaluate: (ctx) =>
      ctx.positions.length >= MIN_POSITIONS_FOR_RISK_BADGES &&
      ctx.positions.every((position) => positionPnlPct(position) >= SANG_FROID_MAX_LOSS_PCT),
  },
  {
    code: "TOUT_AU_VERT",
    name: "Tout au vert",
    description: "Toutes vos positions ouvertes sont en gain simultanément.",
    condition: "Avoir toutes ses positions ouvertes en gain simultanément (au moins 5 positions)",
    category: "RISK_MANAGEMENT",
    rarity: "EPIC",
    icon: "✳️",
    evaluate: (ctx) =>
      ctx.positions.length >= MIN_POSITIONS_FOR_RISK_BADGES &&
      ctx.positions.every((position) => positionPnlPct(position) >= 0),
  },
  {
    code: "PIERRE_ANGULAIRE",
    name: "Pierre angulaire",
    description: "Vous avez gardé une position en gain de plus de 10% pendant plus de 3 semaines sans y toucher.",
    condition: "Garder une position en gain de +10% pendant au moins 3 semaines sans la renforcer ni l'alléger",
    category: "RISK_MANAGEMENT",
    rarity: "RARE",
    icon: "💠",
    evaluate: (ctx) => ctx.hasAnchorPosition,
  },
];
```

- [ ] **Step 4 : Écrire `diversification.ts`**

Remplacer intégralement :

```ts
import type { BadgeSpec } from "./types";

const RIEN_DANS_UN_PANIER_MIN_POSITIONS = 8;
const RIEN_DANS_UN_PANIER_MAX_CONCENTRATION_PCT = 12;
const COLLECTIONNEUR_MIN_ASSETS = 25;

export const diversificationBadges: BadgeSpec[] = [
  {
    code: "PORTEFEUILLE_COMPLET",
    name: "Portefeuille garni",
    description: "Vous avez atteint le nombre maximal de positions autorisées.",
    condition: "Atteindre le nombre maximal de positions autorisées",
    category: "DIVERSIFICATION",
    rarity: "COMMON",
    icon: "🧱",
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "RIEN_DANS_UN_PANIER",
    name: "Rien dans un seul panier",
    description: "Aucune de vos positions ne pèse plus de 12% de votre portefeuille.",
    condition: "Aucune position ne dépasse 12% du portefeuille (au moins 8 positions)",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "⚖️",
    evaluate: (ctx) =>
      ctx.openPositionCount >= RIEN_DANS_UN_PANIER_MIN_POSITIONS &&
      ctx.maxPositionConcentrationPct !== null &&
      ctx.maxPositionConcentrationPct <= RIEN_DANS_UN_PANIER_MAX_CONCENTRATION_PCT,
  },
  {
    code: "TOUCHE_A_TOUT",
    name: "Touche-à-tout",
    description: "Vous détenez des actions et de la crypto en même temps.",
    condition: "Détenir simultanément au moins une action et une cryptomonnaie",
    category: "DIVERSIFICATION",
    rarity: "COMMON",
    icon: "🪙",
    evaluate: (ctx) => ctx.holdsStockAndCrypto,
  },
  {
    code: "COLLECTIONNEUR",
    name: "Collectionneur",
    description: "Vous avez détenu au moins 25 actifs différents au fil du concours.",
    condition: "Avoir détenu au moins 25 actifs différents au cours du concours",
    category: "DIVERSIFICATION",
    rarity: "RARE",
    icon: "🗂️",
    evaluate: (ctx) => ctx.distinctAssetsTradedCount >= COLLECTIONNEUR_MIN_ASSETS,
  },
];
```

- [ ] **Step 5 : Lancer — doivent passer**

Run: `npx vitest run src/lib/gamification/badges/risk-management.test.ts src/lib/gamification/badges/diversification.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/gamification/badges/risk-management.ts src/lib/gamification/badges/risk-management.test.ts src/lib/gamification/badges/diversification.ts src/lib/gamification/badges/diversification.test.ts
git commit -m "feat: rewrite risk (3) and diversification (4) badges for available data"
```

---

## Task 8 : Badges Exploits + Fun + assemblage du catalogue

**Files:**
- Modify (remplacer intégralement) : `src/lib/gamification/badges/distinction.ts`
- Modify (remplacer intégralement) : `src/lib/gamification/badges/special-event.ts`
- Modify (remplacer intégralement) : `src/lib/gamification/badges/catalog.ts`
- Test (remplacer) : `src/lib/gamification/badges/distinction.test.ts`, `src/lib/gamification/badges/special-event.test.ts`, `src/lib/gamification/badges/catalog.test.ts`

**Interfaces:**
- Consumes: tous les modules de badges précédents.
- Produces: `distinctionBadges: BadgeSpec[]` — 9 entrées `category: "DISTINCTION"` :
  - Évaluées en boucle : `INTOUCHABLE` (evaluate), `PERFECTION` (evaluate).
  - Close-only (pas de `evaluate`) : `CHAMPION_DU_CONCOURS`, `LE_PHENIX`, `MEILLEUR_STOCK_PICKER`, `MEILLEUR_TACTICIEN`, `OEIL_DE_LYNX`, `FIDELE_AU_POSTE`, `SANS_FAUTE`.
- Produces: `specialEventBadges: BadgeSpec[]` — 4 entrées `category: "SPECIAL_EVENT"` :
  - Évaluées : `LEVE_TOT` (evaluate = condition individuelle), `ZEN` (evaluate), `HABITUE` (evaluate).
  - Close-only : `STRATEGE_ASSIDU`.
- Produces: `BADGE_CATALOG: BadgeSpec[]` (40), `BADGE_CATALOG_BY_CODE`, `CLOSE_ONLY_CODES` (8), `evaluateBadgeCatalog(ctx)`.

- [ ] **Step 1 : Écrire les tests (échouent)**

Créer/remplacer `src/lib/gamification/badges/distinction.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { distinctionBadges } from "./distinction";
import { baseContext, NOW } from "./badge-test-context";

const CLOSE_ONLY = new Set([
  "CHAMPION_DU_CONCOURS", "LE_PHENIX", "MEILLEUR_STOCK_PICKER",
  "MEILLEUR_TACTICIEN", "OEIL_DE_LYNX", "FIDELE_AU_POSTE", "SANS_FAUTE",
]);

describe("distinctionBadges", () => {
  it("contient 9 badges DISTINCTION", () => {
    expect(distinctionBadges).toHaveLength(9);
    expect(distinctionBadges.every((b) => b.category === "DISTINCTION")).toBe(true);
  });

  it("les badges close-only n'ont pas de fonction evaluate", () => {
    for (const b of distinctionBadges) {
      if (CLOSE_ONLY.has(b.code)) expect(b.evaluate).toBeUndefined();
      else expect(typeof b.evaluate).toBe("function");
    }
  });
});

function ev(code: string) {
  const b = distinctionBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("INTOUCHABLE", () => {
  it("attribué à 12 snapshots cumulés en tête", () => {
    const rankHistory = Array.from({ length: 15 }, (_, i) => ({ timestamp: NOW, rank: i < 12 ? 1 : 2 }));
    expect(ev("INTOUCHABLE")(baseContext({ rankHistory }))).toBe(true);
  });
  it("pas attribué à 11 cumulés", () => {
    const rankHistory = Array.from({ length: 15 }, (_, i) => ({ timestamp: NOW, rank: i < 11 ? 1 : 2 }));
    expect(ev("INTOUCHABLE")(baseContext({ rankHistory }))).toBe(false);
  });
});

describe("PERFECTION", () => {
  it("attribué si tous les autres badges sont possédés", () =>
    expect(ev("PERFECTION")(baseContext({ alreadyOwnedCodes: new Set(Array.from({ length: 39 }, (_, i) => `X${i}`)), totalBadgeCount: 40 }))).toBe(true));
  it("pas attribué s'il en manque deux", () =>
    expect(ev("PERFECTION")(baseContext({ alreadyOwnedCodes: new Set(Array.from({ length: 38 }, (_, i) => `X${i}`)), totalBadgeCount: 40 }))).toBe(false));
});
```

Créer/remplacer `src/lib/gamification/badges/special-event.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { specialEventBadges } from "./special-event";
import { baseContext } from "./badge-test-context";

function ev(code: string) {
  const b = specialEventBadges.find((x) => x.code === code);
  if (!b?.evaluate) throw new Error(`Badge ${code} introuvable ou sans evaluate`);
  return b.evaluate;
}

describe("specialEventBadges", () => {
  it("contient 4 badges SPECIAL_EVENT", () => {
    expect(specialEventBadges).toHaveLength(4);
    expect(specialEventBadges.every((b) => b.category === "SPECIAL_EVENT")).toBe(true);
  });
  it("STRATEGE_ASSIDU est close-only (pas de evaluate)", () => {
    expect(specialEventBadges.find((b) => b.code === "STRATEGE_ASSIDU")?.evaluate).toBeUndefined();
  });
});

describe("LEVE_TOT", () => {
  it("condition individuelle : portefeuille complet", () =>
    expect(ev("LEVE_TOT")(baseContext({ openPositionCount: 20, maxPositions: 20 }))).toBe(true));
  it("pas rempli si portefeuille incomplet", () =>
    expect(ev("LEVE_TOT")(baseContext({ openPositionCount: 19, maxPositions: 20 }))).toBe(false));
});

describe("ZEN", () => {
  it("attribué si une semaine avec fenêtre a 0 changement", () =>
    expect(ev("ZEN")(baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 0 }] }))).toBe(true));
  it("pas attribué si tous les changements ont été utilisés", () =>
    expect(ev("ZEN")(baseContext({ weeklyChangeWindows: [{ hadWindow: true, changesUsed: 2 }] }))).toBe(false));
});

describe("HABITUE", () => {
  it("attribué à 10 jours de série (courante)", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 10 }))).toBe(true));
  it("attribué à 10 jours de série (record)", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 3, longestStreakDays: 10 }))).toBe(true));
  it("pas attribué à 9", () =>
    expect(ev("HABITUE")(baseContext({ currentStreakDays: 9, longestStreakDays: 9 }))).toBe(false));
});
```

Remplacer `src/lib/gamification/badges/catalog.test.ts` (créer si absent) :

```ts
import { describe, it, expect } from "vitest";
import { BADGE_CATALOG, BADGE_CATALOG_BY_CODE, CLOSE_ONLY_CODES } from "./catalog";
import { baseContext } from "./badge-test-context";

describe("BADGE_CATALOG", () => {
  it("contient 40 badges aux codes uniques", () => {
    expect(BADGE_CATALOG).toHaveLength(40);
    expect(new Set(BADGE_CATALOG.map((b) => b.code)).size).toBe(40);
  });

  it("chaque badge a nom, description, condition, catégorie, rareté, icône non vides", () => {
    for (const b of BADGE_CATALOG) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
      expect(b.condition.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
      expect(["PERFORMANCE", "TRADING", "RISK_MANAGEMENT", "DIVERSIFICATION", "RANKING", "SPECIAL_EVENT", "DISTINCTION", "CONVICTION"]).toContain(b.category);
      expect(["COMMON", "RARE", "EPIC", "LEGENDARY"]).toContain(b.rarity);
    }
  });

  it("les codes close-only n'ont pas de evaluate, les autres en ont un", () => {
    for (const b of BADGE_CATALOG) {
      if (CLOSE_ONLY_CODES.has(b.code)) expect(b.evaluate).toBeUndefined();
      else expect(typeof b.evaluate).toBe("function");
    }
  });

  it("CLOSE_ONLY_CODES contient exactement les 8 codes attendus", () => {
    expect([...CLOSE_ONLY_CODES].sort()).toEqual(
      [
        "CHAMPION_DU_CONCOURS", "FIDELE_AU_POSTE", "LE_PHENIX", "MEILLEUR_STOCK_PICKER",
        "MEILLEUR_TACTICIEN", "OEIL_DE_LYNX", "SANS_FAUTE", "STRATEGE_ASSIDU",
      ].sort(),
    );
  });

  it("un contexte neutre n'attribue aucun badge", () => {
    const earned = BADGE_CATALOG.filter((b) => b.evaluate?.(baseContext()) ?? false);
    expect(earned).toEqual([]);
  });

  it("BADGE_CATALOG_BY_CODE indexe tout le catalogue", () => {
    expect(BADGE_CATALOG_BY_CODE.size).toBe(40);
  });
});
```

- [ ] **Step 2 : Lancer — doivent échouer**

Run: `npx vitest run src/lib/gamification/badges/distinction.test.ts src/lib/gamification/badges/special-event.test.ts src/lib/gamification/badges/catalog.test.ts`
Expected: FAIL

- [ ] **Step 3 : Écrire `distinction.ts`**

Remplacer intégralement :

```ts
import type { BadgeSpec } from "./types";

const INTOUCHABLE_CUMULATIVE_DAYS = 12;

/**
 * Distinctions & hauts faits. Les superlatifs (`CHAMPION_DU_CONCOURS`,
 * `MEILLEUR_*`, `OEIL_DE_LYNX`) et les conditions « tout le concours »
 * (`FIDELE_AU_POSTE`, `SANS_FAUTE`, `LE_PHENIX`) sont **close-only** : aucun
 * `evaluate`, calculés une seule fois à la clôture (voir award-close-only-badges.ts).
 * `INTOUCHABLE` et `PERFECTION` sont évalués en continu — leur condition est
 * monotone (ne peut que devenir vraie), donc aucun risque de faux positif.
 */
export const distinctionBadges: BadgeSpec[] = [
  {
    code: "INTOUCHABLE",
    name: "Intouchable",
    description: "Vous avez occupé la 1ère place du classement pendant 12 journées au total.",
    condition: "Être 1er du classement pendant 12 journées cumulées",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🛡️",
    evaluate: (ctx) => ctx.rankHistory.filter((point) => point.rank === 1).length >= INTOUCHABLE_CUMULATIVE_DAYS,
  },
  {
    code: "PERFECTION",
    name: "Perfection",
    description: "Vous avez débloqué tous les autres badges de la collection.",
    condition: "Débloquer tous les autres badges de la collection",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "💎",
    evaluate: (ctx) => ctx.alreadyOwnedCodes.size >= ctx.totalBadgeCount - 1,
  },
  {
    code: "CHAMPION_DU_CONCOURS",
    name: "Champion du concours",
    description: "Vous avez terminé 1er du classement final.",
    condition: "Terminer 1er du classement final",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🏆",
  },
  {
    code: "LE_PHENIX",
    name: "Le Phénix",
    description: "Vous avez été dernier du classement à un moment donné, puis avez terminé sur le podium final.",
    condition: "Avoir été dernier à un moment donné puis terminer sur le podium (Top 3) final",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🔥",
  },
  {
    code: "MEILLEUR_STOCK_PICKER",
    name: "Meilleur stock picker",
    description: "Vous avez réalisé le trade avec le meilleur gain % de tout le concours.",
    condition: "Réaliser le trade avec le meilleur gain % de tout le concours",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🎯",
  },
  {
    code: "MEILLEUR_TACTICIEN",
    name: "Meilleur tacticien",
    description: "Vous avez le meilleur taux de réussite sur au moins 5 trades clôturés.",
    condition: "Avoir le meilleur taux de réussite sur au moins 5 trades clôturés",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "📊",
  },
  {
    code: "OEIL_DE_LYNX",
    name: "Œil de lynx",
    description: "Vous avez réalisé le meilleur achat juste avant une hausse de tout le concours.",
    condition: "Réaliser le meilleur achat juste avant une hausse (meilleure progression dans les 5 jours suivants, tous participants confondus)",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "👁️",
  },
  {
    code: "FIDELE_AU_POSTE",
    name: "Fidèle au poste",
    description: "Vous avez conservé une position ouverte du tout début à la toute fin du concours.",
    condition: "Conserver une position ouverte du début à la fin du concours",
    category: "DISTINCTION",
    rarity: "EPIC",
    icon: "⚓",
  },
  {
    code: "SANS_FAUTE",
    name: "Sans faute",
    description: "Aucune de vos positions n'a jamais dépassé -10% de perte, du début à la fin du concours.",
    condition: "Terminer le concours sans qu'aucune position n'ait jamais dépassé -10% de perte",
    category: "DISTINCTION",
    rarity: "LEGENDARY",
    icon: "🦾",
  },
];
```

- [ ] **Step 4 : Écrire `special-event.ts`**

Remplacer intégralement :

```ts
import type { BadgeSpec } from "./types";

const HABITUE_STREAK_DAYS = 10;

export const specialEventBadges: BadgeSpec[] = [
  {
    code: "LEVE_TOT",
    name: "Lève-tôt",
    description: "Vous avez été le tout premier participant du concours à finaliser votre portefeuille.",
    condition: "Être le 1er participant du concours à finaliser son portefeuille (badge exclusif, un seul gagnant)",
    category: "SPECIAL_EVENT",
    rarity: "RARE",
    icon: "🐓",
    // L'exclusivité (« le 1er ») est vérifiée à l'attribution dans evaluate-badges.ts
    // (état DB, pas dérivable du seul contexte). Ici : condition individuelle (portefeuille complet).
    evaluate: (ctx) => ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions,
  },
  {
    code: "ZEN",
    name: "Zen",
    description: "Vous avez laissé passer une semaine complète sans aucun changement alors qu'une fenêtre était ouverte.",
    condition: "Ne réaliser aucun changement pendant une semaine alors qu'une fenêtre était disponible",
    category: "SPECIAL_EVENT",
    rarity: "COMMON",
    icon: "🧘",
    evaluate: (ctx) => ctx.weeklyChangeWindows.some((week) => week.hadWindow && week.changesUsed === 0),
  },
  {
    code: "STRATEGE_ASSIDU",
    name: "Stratège assidu",
    description: "Vous avez participé à chaque session de changement du concours.",
    condition: "Avoir utilisé sa fenêtre de changement chaque semaine du concours",
    category: "SPECIAL_EVENT",
    rarity: "EPIC",
    icon: "📋",
  },
  {
    code: "HABITUE",
    name: "Habitué",
    description: "Vous vous êtes connecté(e) 10 jours d'affilée.",
    condition: "Se connecter 10 jours consécutifs",
    category: "SPECIAL_EVENT",
    rarity: "COMMON",
    icon: "📆",
    evaluate: (ctx) => ctx.currentStreakDays >= HABITUE_STREAK_DAYS || ctx.longestStreakDays >= HABITUE_STREAK_DAYS,
  },
];
```

- [ ] **Step 5 : Écrire `catalog.ts`**

Remplacer intégralement :

```ts
import { performanceBadges } from "./performance";
import { tradingBadges } from "./trading";
import { riskManagementBadges } from "./risk-management";
import { diversificationBadges } from "./diversification";
import { rankingBadges } from "./ranking-badges";
import { specialEventBadges } from "./special-event";
import { distinctionBadges } from "./distinction";
import type { BadgeEvaluationContext, BadgeSpec } from "./types";

export const BADGE_CATALOG: BadgeSpec[] = [
  ...performanceBadges,
  ...rankingBadges,
  ...tradingBadges,
  ...riskManagementBadges,
  ...diversificationBadges,
  ...distinctionBadges,
  ...specialEventBadges,
];

export const BADGE_CATALOG_BY_CODE = new Map(BADGE_CATALOG.map((spec) => [spec.code, spec]));

/**
 * Badges « superlatifs » ou « tout le concours » : jamais évalués dans la boucle
 * standard, uniquement par award-close-only-badges.ts au passage ACTIVE → CLOSED.
 * Ce sont exactement les entrées du catalogue sans fonction `evaluate`.
 */
export const CLOSE_ONLY_CODES = new Set(BADGE_CATALOG.filter((spec) => !spec.evaluate).map((spec) => spec.code));

export function evaluateBadgeCatalog(ctx: BadgeEvaluationContext): string[] {
  return BADGE_CATALOG.filter((spec) => spec.evaluate?.(ctx) ?? false).map((spec) => spec.code);
}
```

- [ ] **Step 6 : Lancer les tests badges — doivent passer**

Run: `npx vitest run src/lib/gamification/badges/`
Expected: PASS (tous les fichiers du dossier `badges/`)

- [ ] **Step 7 : Commit**

```bash
git add src/lib/gamification/badges/distinction.ts src/lib/gamification/badges/special-event.ts src/lib/gamification/badges/catalog.ts src/lib/gamification/badges/distinction.test.ts src/lib/gamification/badges/special-event.test.ts src/lib/gamification/badges/catalog.test.ts
git commit -m "feat: rewrite exploits (9) and fun (4) badges, assemble 40-badge catalog"
```

---

## Task 9 : `buildEvaluationContext` — champs dérivés + `AwardedBadge` enrichi + exclusivité `LEVE_TOT`

**Files:**
- Modify: `src/lib/gamification/evaluate-badges.ts`
- Test: `src/lib/gamification/evaluate-badges.test.ts`

**Interfaces:**
- Consumes: `BadgeEvaluationContext` (nouveaux champs, Task 2), `catalog.ts` (Task 8), `computeMaxPostBuyGainPct` depuis `./badges/post-buy-gain` (Task 3), `computeHasSuccessfulArbitrage` depuis `./badges/trading` (inchangé).
- Produces: `AwardedBadge` gagne `icon: string` et `description: string`.
- Produces: `buildEvaluationContext` renseigne les 7 nouveaux champs et ne renseigne plus `sectorAllocation` / `currencyAllocation`.
- Produces: l'exclusivité gérée pour le code `LEVE_TOT` (remplace `PIONNIER`).

- [ ] **Step 1 : Adapter les imports et le `select` position**

Dans `src/lib/gamification/evaluate-badges.ts` :
- Remplacer `import { computeMaxPostBuyGainPct } from "./badges/conviction";` par `import { computeMaxPostBuyGainPct } from "./badges/post-buy-gain";`
- Supprimer `import { buildAllocation } from "./get-participant-stats";`
- Dans `buildEvaluationContext`, requête `db.position.findMany`, changer le `select` de l'asset :
  ```ts
  include: { asset: { select: { type: true, prices: { orderBy: { timestamp: "desc" }, take: 1 } } } },
  ```
  (retirer `sector` et `currency`, ajouter `type`).

- [ ] **Step 2 : Calculer les nouveaux champs dérivés**

Dans `buildEvaluationContext`, **supprimer** les blocs `sectorEntries` / `currencyEntries` et les propriétés `sectorAllocation` / `currencyAllocation` de l'objet retourné. **Ajouter** avant le `return`, après le calcul de `weeklyChangeWindows` :

```ts
const fieldAverageReturnPct =
  leaderboard.length > 0
    ? leaderboard.reduce((sum, entry) => sum + entry.cumulativeReturnPct, 0) / leaderboard.length
    : 0;

const weeklyValues = leaderboard
  .map((entry) => entry.weeklyReturnPct)
  .filter((value): value is number => value !== null);
const bestWeekly = weeklyValues.length > 0 ? Math.max(...weeklyValues) : null;
const hasBestWeeklyReturn =
  weeklyValues.length >= 2 && row.weeklyReturnPct !== null && bestWeekly !== null && row.weeklyReturnPct >= bestWeekly;

const distinctAssetsTradedCount = new Set(transactions.map((transaction) => transaction.assetId)).size;

const openAssetTypes = new Set(openPositions.map((position) => position.asset.type));
const holdsStockAndCrypto = openAssetTypes.has("STOCK") && openAssetTypes.has("CRYPTO");

const totalMarketValue = positionSnapshots.reduce((total, position) => total + position.marketValue, 0);
const maxPositionConcentrationPct =
  positionSnapshots.length > 0 && totalMarketValue > 0
    ? (Math.max(...positionSnapshots.map((position) => position.marketValue)) / totalMarketValue) * 100
    : null;

const ANCHOR_MIN_AGE_MS = 21 * 24 * 60 * 60 * 1000;
const ANCHOR_MIN_GAIN_PCT = 10;
const touchedAssetIds = new Set(
  transactions
    .filter(
      (transaction) =>
        transaction.type === TransactionType.INCREASE ||
        transaction.type === TransactionType.SELL_PARTIAL ||
        transaction.type === TransactionType.DECREASE,
    )
    .map((transaction) => transaction.assetId),
);
const hasAnchorPosition = openPositions.some((position) => {
  if (now.getTime() - position.openedAt.getTime() < ANCHOR_MIN_AGE_MS) return false;
  if (touchedAssetIds.has(position.assetId)) return false;
  const avgEntryPrice = Number(position.avgEntryPrice);
  const currentPrice = currentPriceByAsset.get(position.assetId) ?? avgEntryPrice;
  const pnlPct = avgEntryPrice > 0 ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100 : 0;
  return pnlPct >= ANCHOR_MIN_GAIN_PCT;
});

const historyRanks = rankHistory.map((point) => point.rank); // le plus récent en premier
const lostLeadIndex = historyRanks.findIndex((rank) => rank !== null && rank > 1);
const regainedFirstPlace =
  row.rank === 1 && lostLeadIndex !== -1 && historyRanks.slice(lostLeadIndex + 1).some((rank) => rank === 1);
```

> `TransactionType` est déjà importé en tête du fichier. `openPositions`, `positionSnapshots`,
> `currentPriceByAsset`, `rankHistory` existent déjà dans la fonction.

Dans l'objet retourné par `buildEvaluationContext`, ajouter :

```ts
    fieldAverageReturnPct,
    hasBestWeeklyReturn,
    distinctAssetsTradedCount,
    holdsStockAndCrypto,
    maxPositionConcentrationPct,
    hasAnchorPosition,
    regainedFirstPlace,
```

- [ ] **Step 3 : Enrichir `AwardedBadge` et l'exclusivité `LEVE_TOT`**

- Modifier l'interface :
  ```ts
  export interface AwardedBadge {
    code: string;
    name: string;
    rarity: BadgeRarity;
    icon: string;
    description: string;
  }
  ```
- Dans `awardBadgesForContext`, remplacer `if (code === "PIONNIER")` par `if (code === "LEVE_TOT")` et la sous-requête `badge: { code: "PIONNIER" }` par `badge: { code: "LEVE_TOT" }`.
- Dans `awardBadgesForContext`, la boucle `for (const badge of badgeRows)` : le `push` devient
  ```ts
  awarded.push({ code: badge.code, name: badge.name, rarity: badge.rarity, icon: badge.icon, description: badge.description });
  ```
  (`db.badge.findMany` renvoie déjà `icon` et `description` — vérifier qu'aucun `select` ne les exclut ; il n'y en a pas).

- [ ] **Step 4 : Mettre à jour le test**

Dans `src/lib/gamification/evaluate-badges.test.ts` :
- Le mock `dbMock.badge.findMany` (ligne ~59) : ajouter `icon` et `description` à l'objet renvoyé :
  ```ts
  return { id: `badge-${code}`, code, name: spec.name, rarity: spec.rarity, icon: spec.icon, description: spec.description };
  ```
- Le mock `dbMock.position.findMany` retour par défaut : garder `[]`. Le test « PIONNIER » (ligne ~125) : renommer en `LEVE_TOT`, remplacer `"PIONNIER"` par `"LEVE_TOT"` dans le corps et l'assertion, et l'`asset` mocké `{ sector: "Tech", currency: "EUR", prices: [{ price: 100 }] }` par `{ type: "STOCK", prices: [{ price: 100 }] }`.
- Le test `evaluateUserBadgesForUser` (ligne ~162) : l'assertion `expect(results).toEqual([{ code: "PREMIER_PAS", name: "Premier pas", rarity: "COMMON" }])` devient
  ```ts
  expect(results).toEqual([
    { code: "PREMIER_PAS", name: "Premier pas", rarity: "COMMON", icon: "🐣", description: expect.any(String) },
  ]);
  ```
- Ajouter un `describe("buildEvaluationContext (champs dérivés)")` qui appelle `evaluateAndAwardBadges` avec un leaderboard à 3 rows et vérifie qu'`ALPHA` est attribué au bon participant :
  ```ts
  it("attribue ALPHA au participant qui surperforme la moyenne de +12 pts", async () => {
    getLeaderboardMock.mockResolvedValue([
      { ...EMPTY_ROW, userId: "user-a", portfolioId: "portfolio-a", rank: 1, cumulativeReturnPct: 20 },
      { ...EMPTY_ROW, userId: "user-b", portfolioId: "portfolio-b", rank: 2, cumulativeReturnPct: 2 },
      { ...EMPTY_ROW, userId: "user-c", portfolioId: "portfolio-c", rank: 3, cumulativeReturnPct: 1 },
    ]);
    dbMock.user.findUnique.mockResolvedValue({ promotionId: "promo-1", currentStreakDays: 0, longestStreakDays: 0 });

    const results = await evaluateAndAwardBadges("promo-1", NOW);

    const a = results.find((r) => r.userId === "user-a");
    expect(a?.awarded).toContain("ALPHA");
    const b = results.find((r) => r.userId === "user-b");
    expect(b?.awarded ?? []).not.toContain("ALPHA");
  });
  ```
  (moyenne = (20+2+1)/3 ≈ 7.67 ; user-a à 20 → écart ≈ 12.33 ≥ 12 ✓ ; user-b à 2 → écart négatif ✗)

- [ ] **Step 5 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/evaluate-badges.test.ts`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add src/lib/gamification/evaluate-badges.ts src/lib/gamification/evaluate-badges.test.ts
git commit -m "feat: derived badge-context fields + enrich AwardedBadge with icon/description"
```

---

## Task 10 : `award-close-only-badges.ts` — renommages + import

**Files:**
- Modify: `src/lib/gamification/award-close-only-badges.ts`
- Test: `src/lib/gamification/award-close-only-badges.test.ts`

**Interfaces:**
- Consumes: `computeMaxPostBuyGainPct` depuis `./badges/post-buy-gain` (Task 3).
- Produces: `computeCloseOnlyWinners` attribue `MEILLEUR_TACTICIEN` (ex-`MEILLEUR_TRADER`) et `OEIL_DE_LYNX` (ex-`MEILLEUR_TIMING`). Les autres codes inchangés : `STRATEGE_ASSIDU`, `SANS_FAUTE`, `LE_PHENIX`, `FIDELE_AU_POSTE`, `CHAMPION_DU_CONCOURS`, `MEILLEUR_STOCK_PICKER`.

- [ ] **Step 1 : Mettre à jour le test**

Dans `src/lib/gamification/award-close-only-badges.test.ts`, remplacer partout `"MEILLEUR_TRADER"` par `"MEILLEUR_TACTICIEN"` et `"MEILLEUR_TIMING"` par `"OEIL_DE_LYNX"` (assertions sur `computeCloseOnlyWinners`).

- [ ] **Step 2 : Lancer — doit échouer**

Run: `npx vitest run src/lib/gamification/award-close-only-badges.test.ts`
Expected: FAIL

- [ ] **Step 3 : Modifier `award-close-only-badges.ts`**

- Remplacer `import { computeMaxPostBuyGainPct } from "./badges/conviction";` par `import { computeMaxPostBuyGainPct } from "./badges/post-buy-gain";`
- Dans `computeCloseOnlyWinners` / `pushBestOf`, remplacer la chaîne `"MEILLEUR_TRADER"` par `"MEILLEUR_TACTICIEN"` et `"MEILLEUR_TIMING"` par `"OEIL_DE_LYNX"`.

- [ ] **Step 4 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/award-close-only-badges.test.ts`
Expected: PASS

- [ ] **Step 5 : Lancer toute la gamification**

Run: `npx vitest run src/lib/gamification/`
Expected: PASS

- [ ] **Step 6 : `tsc` doit être clean sur le moteur**

Run: `npx tsc --noEmit 2>&1 | grep -E "gamification|badges" || echo "OK gamification"`
Expected: `OK gamification` (aucune erreur dans ces chemins ; il peut rester des erreurs UI à ce stade, traitées Task 11+)

- [ ] **Step 7 : Commit**

```bash
git add src/lib/gamification/award-close-only-badges.ts src/lib/gamification/award-close-only-badges.test.ts
git commit -m "refactor: rename MEILLEUR_TRADER/TIMING -> TACTICIEN/OEIL_DE_LYNX in close-only"
```

---

## Task 11 : `get-badge-board.ts` + `badge-display.ts` (données UI)

**Files:**
- Modify: `src/lib/gamification/get-badge-board.ts`
- Modify: `src/lib/gamification/badge-display.ts`
- Modify: `src/lib/gamification/get-unseen-badges.ts`
- Test: `src/lib/gamification/get-badge-board.test.ts`

**Interfaces:**
- Produces: `BadgeBoard` gagne :
  - `byCategory: { category: BadgeCategory; label: string; icon: string; earned: number; total: number; entries: BadgeBoardEntry[] }[]` (ordre : PERFORMANCE, RANKING, TRADING, RISK_MANAGEMENT, DIVERSIFICATION, DISTINCTION, SPECIAL_EVENT — la catégorie `CONVICTION`, vide, est omise si `total === 0`)
  - `byRarity: { rarity: BadgeRarity; earned: number; total: number }[]` (ordre COMMON, RARE, EPIC, LEGENDARY)
- Produces: `badge-display.ts` : `CATEGORY_LABEL` relibellé, `CATEGORY_ICON: Record<BadgeCategory, string>` ajouté.
- Produces: `UnseenBadge` gagne `icon: string` et `description: string`.

- [ ] **Step 1 : Écrire les tests (échouent)**

Ajouter à `src/lib/gamification/get-badge-board.test.ts` un `describe` (garder les tests existants, adapter les comptes si besoin — le total est maintenant 40) :

```ts
describe("getBadgeBoard — regroupements UI", () => {
  it("byRarity couvre les 4 raretés et somme au total du catalogue", async () => {
    // (réutiliser le mock existant du fichier : getUserBadges renvoie [])
    const board = await getBadgeBoard("user-a", "promo-1");
    expect(board.byRarity.map((r) => r.rarity)).toEqual(["COMMON", "RARE", "EPIC", "LEGENDARY"]);
    expect(board.byRarity.reduce((s, r) => s + r.total, 0)).toBe(board.totalCount);
    expect(board.byRarity.every((r) => r.earned === 0)).toBe(true);
  });

  it("byCategory est ordonné et chaque section somme correctement", async () => {
    const board = await getBadgeBoard("user-a", "promo-1");
    expect(board.byCategory.map((c) => c.category)).toEqual([
      "PERFORMANCE", "RANKING", "TRADING", "RISK_MANAGEMENT", "DIVERSIFICATION", "DISTINCTION", "SPECIAL_EVENT",
    ]);
    expect(board.byCategory.reduce((s, c) => s + c.total, 0)).toBe(board.totalCount);
    for (const c of board.byCategory) {
      expect(c.entries).toHaveLength(c.total);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});
```

> Vérifier en tête du fichier de test comment `getUserBadges` est mocké et l'imiter si le
> nouveau `describe` a besoin d'un `beforeEach`.

- [ ] **Step 2 : Lancer — doit échouer**

Run: `npx vitest run src/lib/gamification/get-badge-board.test.ts`
Expected: FAIL

- [ ] **Step 3 : `badge-display.ts`**

Remplacer intégralement :

```ts
import type { BadgeCategory, BadgeRarity } from "@/generated/prisma/enums";

export const RARITY_LABEL: Record<BadgeRarity, string> = {
  COMMON: "Commun",
  RARE: "Rare",
  EPIC: "Épique",
  LEGENDARY: "Légendaire",
};

export const RARITY_ORDER: BadgeRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

/** Palette de raretés façon jeu vidéo (commun neutre → légendaire doré) — Tailwind pur. */
export const RARITY_CLASSNAME: Record<BadgeRarity, string> = {
  COMMON: "border-border/60 bg-muted/50 text-muted-foreground",
  RARE: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  EPIC: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  LEGENDARY: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

/** Classe de liseré appliquée à la carte d'un badge débloqué, selon sa rareté. */
export const RARITY_CARD_ACCENT: Record<BadgeRarity, string> = {
  COMMON: "border-border",
  RARE: "border-blue-500/50",
  EPIC: "border-violet-500/50",
  LEGENDARY: "border-amber-500/60 shadow-[0_0_16px_-4px_var(--color-amber-500)]",
};

/** Largeur du segment de rareté dans la barre de progression de l'en-tête. */
export const RARITY_BAR_CLASSNAME: Record<BadgeRarity, string> = {
  COMMON: "bg-muted-foreground/40",
  RARE: "bg-blue-500",
  EPIC: "bg-violet-500",
  LEGENDARY: "bg-amber-500",
};

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  PERFORMANCE: "Performance",
  RANKING: "Compétition",
  TRADING: "Trading",
  RISK_MANAGEMENT: "Sang-froid",
  DIVERSIFICATION: "Diversification",
  DISTINCTION: "Exploits",
  SPECIAL_EVENT: "Fun",
  CONVICTION: "Convictions",
};

export const CATEGORY_ICON: Record<BadgeCategory, string> = {
  PERFORMANCE: "📈",
  RANKING: "🏆",
  TRADING: "🎯",
  RISK_MANAGEMENT: "🛡️",
  DIVERSIFICATION: "🌍",
  DISTINCTION: "🔥",
  SPECIAL_EVENT: "😄",
  CONVICTION: "💡",
};

/** Ordre d'affichage des catégories dans l'onglet Badges. `CONVICTION` (vide) exclue. */
export const CATEGORY_ORDER: BadgeCategory[] = [
  "PERFORMANCE",
  "RANKING",
  "TRADING",
  "RISK_MANAGEMENT",
  "DIVERSIFICATION",
  "DISTINCTION",
  "SPECIAL_EVENT",
];
```

- [ ] **Step 4 : `get-badge-board.ts`**

Modifier :
- Importer : `import { CATEGORY_ORDER, CATEGORY_LABEL, CATEGORY_ICON, RARITY_ORDER } from "./badge-display";`
- Étendre `BadgeBoard` avec :
  ```ts
  export interface BadgeCategoryGroup {
    category: BadgeCategory;
    label: string;
    icon: string;
    earned: number;
    total: number;
    entries: BadgeBoardEntry[];
  }
  export interface BadgeRarityCount {
    rarity: BadgeRarity;
    earned: number;
    total: number;
  }
  ```
  et dans `BadgeBoard` : `byCategory: BadgeCategoryGroup[];` et `byRarity: BadgeRarityCount[];`
- Avant le `return`, calculer :
  ```ts
  const byCategory: BadgeCategoryGroup[] = CATEGORY_ORDER.map((category) => {
    const catEntries = entries.filter((entry) => entry.category === category);
    return {
      category,
      label: CATEGORY_LABEL[category],
      icon: CATEGORY_ICON[category],
      earned: catEntries.filter((entry) => entry.earned).length,
      total: catEntries.length,
      entries: catEntries,
    };
  }).filter((group) => group.total > 0);

  const byRarity: BadgeRarityCount[] = RARITY_ORDER.map((rarity) => {
    const rarEntries = entries.filter((entry) => entry.rarity === rarity);
    return { rarity, earned: rarEntries.filter((entry) => entry.earned).length, total: rarEntries.length };
  });
  ```
- Ajouter `byCategory` et `byRarity` à l'objet retourné.

- [ ] **Step 5 : `get-unseen-badges.ts`**

- `UnseenBadge` gagne `icon: string;` et `description: string;`
- Le `select` : `include: { badge: { select: { code: true, name: true, rarity: true, icon: true, description: true } } }`
- Le `.map` renvoie aussi `icon: userBadge.badge.icon, description: userBadge.badge.description`.

- [ ] **Step 6 : Lancer — doit passer**

Run: `npx vitest run src/lib/gamification/get-badge-board.test.ts`
Expected: PASS

- [ ] **Step 7 : Commit**

```bash
git add src/lib/gamification/get-badge-board.ts src/lib/gamification/badge-display.ts src/lib/gamification/get-unseen-badges.ts src/lib/gamification/get-badge-board.test.ts
git commit -m "feat: badge board groupings (by category, by rarity) + display tokens"
```

---

## Task 12 : Composant de toast de déblocage

**Files:**
- Create: `src/components/badges/badge-unlock-toast.tsx`
- Modify: `src/components/badges/unseen-badge-toaster.tsx`
- Modify: `src/app/dashboard/use-badge-toast.ts`

**Interfaces:**
- Consumes: `UnseenBadge` (Task 11, avec `icon` + `description`), `AwardedBadge` (Task 9).
- Produces: `export function showBadgeUnlockToasts(badges: { code: string; name: string; rarity: BadgeRarity; icon: string; description: string }[]): void` — affiche 1 toast custom par badge si ≤ 2, sinon un toast récap ; appelle `toast.custom` de `sonner`.

- [ ] **Step 1 : Créer `badge-unlock-toast.tsx`**

```tsx
"use client";

import { toast } from "sonner";
import { RARITY_LABEL } from "@/lib/gamification/badge-display";
import type { BadgeRarity } from "@/generated/prisma/enums";

export interface UnlockToastBadge {
  code: string;
  name: string;
  rarity: BadgeRarity;
  icon: string;
  description: string;
}

const ACCENT: Record<BadgeRarity, string> = {
  COMMON: "border-l-border",
  RARE: "border-l-blue-500",
  EPIC: "border-l-violet-500",
  LEGENDARY: "border-l-amber-500",
};

function isFlashy(rarity: BadgeRarity): boolean {
  return rarity === "EPIC" || rarity === "LEGENDARY";
}

function BadgeToastCard({ badge }: { badge: UnlockToastBadge }) {
  return (
    <a
      href="/badges"
      className={`flex w-[340px] max-w-[86vw] items-start gap-3 rounded-lg border border-l-4 ${ACCENT[badge.rarity]} bg-popover p-3 text-popover-foreground shadow-lg ${
        isFlashy(badge.rarity) ? "ring-1 ring-amber-500/20" : ""
      }`}
    >
      <span className="text-3xl leading-none">{badge.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          🏆 Badge débloqué · {RARITY_LABEL[badge.rarity]}
        </p>
        <p className="truncate text-sm font-semibold">{badge.name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>
      </div>
      <span className="ml-auto shrink-0 self-center text-xs text-muted-foreground">Voir →</span>
    </a>
  );
}

function BadgeSummaryToastCard({ badges }: { badges: UnlockToastBadge[] }) {
  return (
    <a
      href="/badges"
      className="flex w-[340px] max-w-[86vw] items-center gap-3 rounded-lg border border-l-4 border-l-amber-500 bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <span className="text-2xl leading-none">🏆</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{badges.length} nouveaux badges !</p>
        <p className="mt-0.5 truncate text-lg leading-none">{badges.map((b) => b.icon).join(" ")}</p>
      </div>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">Voir →</span>
    </a>
  );
}

/** Affiche les toasts de déblocage : ≤ 2 badges → un toast chacun ; ≥ 3 → un toast récap. */
export function showBadgeUnlockToasts(badges: UnlockToastBadge[]): void {
  if (badges.length === 0) return;
  if (badges.length >= 3) {
    toast.custom(() => <BadgeSummaryToastCard badges={badges} />, { duration: 7000 });
    return;
  }
  for (const badge of badges) {
    toast.custom(() => <BadgeToastCard badge={badge} />, { duration: isFlashy(badge.rarity) ? 7000 : 5000 });
  }
}
```

- [ ] **Step 2 : Réécrire `unseen-badge-toaster.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { acknowledgeBadges } from "@/lib/gamification/badge-actions";
import { showBadgeUnlockToasts } from "./badge-unlock-toast";
import type { UnseenBadge } from "@/lib/gamification/get-unseen-badges";

/** Affiche un toast pour chaque badge attribué par le cron nocturne et jamais encore vu, puis
 * les marque comme vus — ne rend rien à l'écran. À monter une fois par page où des badges
 * peuvent être consultés (/dashboard, /badges). */
export function UnseenBadgeToaster({ badges }: { badges: UnseenBadge[] }) {
  const acknowledged = useRef(false);

  useEffect(() => {
    if (acknowledged.current || badges.length === 0) return;
    acknowledged.current = true;

    showBadgeUnlockToasts(badges);
    void acknowledgeBadges(badges.map((badge) => badge.code));
  }, [badges]);

  return null;
}
```

- [ ] **Step 3 : Réécrire `use-badge-toast.ts`**

```ts
"use client";

import { useEffect, useRef } from "react";
import { showBadgeUnlockToasts } from "@/components/badges/badge-unlock-toast";
import type { TradeFormState } from "./actions";

/** Affiche un toast de déblocage pour chaque nouveau badge renvoyé par une action de trading —
 * dédupliqué par code pour ne jamais répéter un toast déjà montré depuis le montage. */
export function useBadgeToast(state: TradeFormState): void {
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = (state.newBadges ?? []).filter((badge) => !shown.current.has(badge.code));
    if (fresh.length === 0) return;
    for (const badge of fresh) shown.current.add(badge.code);
    showBadgeUnlockToasts(fresh);
  }, [state.newBadges]);
}
```

> `state.newBadges` est de type `AwardedBadge[]` qui a désormais `icon` + `description` (Task 9) —
> compatible avec `UnlockToastBadge`.

- [ ] **Step 4 : Vérifier le build (pas de test unitaire de composant)**

Run: `npx tsc --noEmit 2>&1 | grep -E "badge-unlock-toast|unseen-badge-toaster|use-badge-toast" || echo "OK toasts"`
Expected: `OK toasts`

- [ ] **Step 5 : Commit**

```bash
git add src/components/badges/badge-unlock-toast.tsx src/components/badges/unseen-badge-toaster.tsx src/app/dashboard/use-badge-toast.ts
git commit -m "feat: custom badge-unlock toast with rarity accent + multi-badge summary"
```

---

## Task 13 : Refonte de l'onglet `/badges`

**Files:**
- Create: `src/app/badges/badges-header.tsx`
- Modify (remplacer) : `src/app/badges/badge-grid.tsx`
- Modify (remplacer) : `src/app/badges/badge-card.tsx`
- Modify: `src/app/badges/page.tsx`
- Delete: `src/app/badges/progress-header.tsx`, `src/app/badges/xp-level-panel.tsx`

**Interfaces:**
- Consumes: `BadgeBoard` avec `byCategory`, `byRarity`, `level`, `xp`, `earnedCount`, `totalCount` (Task 11).
- Produces: `BadgesHeader` (server component), `BadgeGrid` (client — filtres), `BadgeCard` (server).

- [ ] **Step 1 : `badges-header.tsx`**

```tsx
import { RARITY_LABEL, RARITY_BAR_CLASSNAME, RARITY_ORDER } from "@/lib/gamification/badge-display";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";

type Props = { board: BadgeBoard };

export function BadgesHeader({ board }: Props) {
  const { level } = board;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Collection</p>
          <p className="text-3xl font-semibold tabular-nums">
            {board.earnedCount} <span className="text-lg font-normal text-muted-foreground">/ {board.totalCount}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Niveau {level.level} · <span className="font-medium text-foreground">{level.label}</span> · {level.xp} XP
          {level.xpForNextLevel !== null && (
            <span className="text-muted-foreground"> · +{level.xpForNextLevel - level.xpIntoLevel} → niv. suiv.</span>
          )}
        </p>
      </div>

      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {RARITY_ORDER.map((rarity) => {
          const row = board.byRarity.find((r) => r.rarity === rarity);
          if (!row || row.total === 0) return null;
          const widthPct = (row.total / board.totalCount) * 100;
          const earnedPct = row.total > 0 ? (row.earned / row.total) * 100 : 0;
          return (
            <div key={rarity} style={{ width: `${widthPct}%` }} className="h-full bg-muted-foreground/10">
              <div className={`h-full ${RARITY_BAR_CLASSNAME[rarity]}`} style={{ width: `${earnedPct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {board.byRarity.map((row) => (
          <span key={row.rarity} className="tabular-nums">
            {RARITY_LABEL[row.rarity]} {row.earned}/{row.total}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : `badge-card.tsx`**

```tsx
import { Lock, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RARITY_LABEL, RARITY_CLASSNAME, RARITY_CARD_ACCENT } from "@/lib/gamification/badge-display";
import { cn } from "@/lib/utils";
import type { BadgeBoardEntry } from "@/lib/gamification/get-badge-board";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

type Props = { entry: BadgeBoardEntry; justUnlocked: boolean };

export function BadgeCard({ entry, justUnlocked }: Props) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-2 border p-3 transition-all",
        entry.earned ? RARITY_CARD_ACCENT[entry.rarity] : "border-border/60 bg-muted/30",
        justUnlocked && "animate-in zoom-in-95 fade-in duration-500",
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn("text-3xl", !entry.earned && "opacity-40 grayscale")}>{entry.icon}</span>
        {entry.earned ? (
          <Check className="size-4 text-emerald-500" />
        ) : (
          <Lock className="size-4 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{entry.name}</p>
        <span className={cn("mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", RARITY_CLASSNAME[entry.rarity])}>
          {RARITY_LABEL[entry.rarity]}
        </span>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">
        {entry.earned ? entry.description : entry.condition}
      </p>
      {entry.earned && entry.awardedAt && (
        <p className="mt-auto text-[11px] text-muted-foreground">Obtenu le {dateFormatter.format(entry.awardedAt)}</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3 : `badge-grid.tsx`**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RARITY_LABEL, RARITY_ORDER } from "@/lib/gamification/badge-display";
import { BadgeCard } from "./badge-card";
import type { BadgeBoard } from "@/lib/gamification/get-badge-board";
import type { BadgeRarity } from "@/generated/prisma/enums";

type OwnershipFilter = "ALL" | "EARNED" | "LOCKED";
type Props = { board: BadgeBoard; justUnlockedCodes: Set<string> };

export function BadgeGrid({ board, justUnlockedCodes }: Props) {
  const [ownership, setOwnership] = useState<OwnershipFilter>("ALL");
  const [rarity, setRarity] = useState<BadgeRarity | null>(null);

  const matches = (earned: boolean, entryRarity: BadgeRarity) => {
    if (ownership === "EARNED" && !earned) return false;
    if (ownership === "LOCKED" && earned) return false;
    if (rarity !== null && entryRarity !== rarity) return false;
    return true;
  };

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "EARNED", "LOCKED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setOwnership(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              ownership === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {value === "ALL" ? "Tous" : value === "EARNED" ? "Débloqués" : "À débloquer"}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {RARITY_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRarity(rarity === value ? null : value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              rarity === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
            )}
          >
            {RARITY_LABEL[value]}
          </button>
        ))}
      </div>

      {board.byCategory.map((group) => {
        const visible = group.entries.filter((entry) => matches(entry.earned, entry.rarity));
        if (visible.length === 0) return null;
        return (
          <section key={group.category}>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">
                {group.icon} {group.label}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {group.earned} / {group.total}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((entry) => (
                <BadgeCard key={entry.code} entry={entry} justUnlocked={justUnlockedCodes.has(entry.code)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4 : `page.tsx`**

Dans `src/app/badges/page.tsx` :
- Remplacer les imports `ProgressHeader` / `XpLevelPanel` par `import { BadgesHeader } from "./badges-header";`
- Dans le JSX final (le bloc `return (<> ... </>)` du cas nominal), remplacer :
  ```tsx
        <div className="mt-6">
          <ProgressHeader board={board} />
        </div>
        <XpLevelPanel board={board} />
        <PersonalRecordsSection records={records} />
        <BadgeGrid entries={board.entries} justUnlockedCodes={justUnlockedCodes} />
  ```
  par :
  ```tsx
        <div className="mt-6">
          <BadgesHeader board={board} />
        </div>
        <BadgeGrid board={board} justUnlockedCodes={justUnlockedCodes} />
        <div className="mt-10">
          <PersonalRecordsSection records={records} />
        </div>
  ```

- [ ] **Step 5 : Supprimer les composants obsolètes**

```bash
git rm src/app/badges/progress-header.tsx src/app/badges/xp-level-panel.tsx
```

- [ ] **Step 6 : Build**

Run: `npm run build`
Expected: exit 0. Corriger toute erreur de type (imports résiduels de `ProgressHeader` / `XpLevelPanel`, prop `entries` vs `board`).

- [ ] **Step 7 : Vérification visuelle locale**

Run: lancer le dev server (`npm run dev`), se connecter en participant, ouvrir `/badges`. Vérifier : en-tête compteur + barre segmentée, filtres cliquables, sections par catégorie avec compteur, cartes verrouillées lisibles (condition affichée), liseré doré sur un légendaire débloqué (si applicable). Sur mobile (viewport 375) : 2 colonnes, pas de débordement horizontal.

- [ ] **Step 8 : Commit**

```bash
git add src/app/badges/
git commit -m "feat: /badges collection view — header, category sections, filters, richer cards"
```

---

## Task 14 : Script de vérification dry-run + contrôles finaux

**Files:**
- Create: `scripts/badge-dryrun.ts`

**Interfaces:**
- Consumes: `evaluateBadgeCatalog`, `BADGE_CATALOG`, `CLOSE_ONLY_CODES`.

- [ ] **Step 1 : Écrire `scripts/badge-dryrun.ts`**

> Le script réutilise le vrai chemin d'évaluation. `evaluate-badges.ts` porte `server-only` :
> l'exécuter via tsx nécessite le stub CJS documenté dans la mémoire projet. Approche plus simple
> et suffisante ici : recalculer un `BadgeEvaluationContext` minimal par participant à partir des
> données brutes, puis appliquer `evaluateBadgeCatalog`. On ne teste QUE les badges non
> close-only (les close-only sont attribués à la clôture).

```ts
/**
 * Dry-run lecture seule : pour chaque participant de la promotion la plus récente,
 * liste les badges NON close-only que le nouveau catalogue attribuerait aujourd'hui.
 * Sert de garde-fou avant le lancement du concours suivant — repère un badge
 * « exploit » distribué à tort, ou un catalogue qui n'attribuerait jamais rien.
 *
 *   DATABASE_URL="<prod>" npx tsx scripts/badge-dryrun.ts
 *
 * N'écrit rien.
 */
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { evaluateBadgeCatalog } from "@/lib/gamification/badges/catalog";
import { baseContext } from "@/lib/gamification/badges/badge-test-context";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+)/)?.[1] ?? "(inconnue)";
  console.log(`BASE : ${ref}   (dry-run, lecture seule)\n`);

  const promo = await db.promotion.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  const portfolios = await db.portfolio.findMany({
    where: { promotionId: promo.id },
    include: { user: { select: { name: true, currentStreakDays: true, longestStreakDays: true } } },
  });

  for (const pf of portfolios) {
    const [snapshots, transactions] = await Promise.all([
      db.performanceSnapshot.findMany({ where: { portfolioId: pf.id }, orderBy: { timestamp: "desc" } }),
      db.transaction.findMany({ where: { portfolioId: pf.id }, select: { assetId: true } }),
    ]);
    const latest = snapshots[0];

    // Contexte partiel : suffisant pour un contrôle « rien d'aberrant ». Les badges
    // qui dépendent de champs non renseignés ici resteront simplement non attribués.
    const ctx = baseContext({
      cumulativeReturnPct: latest ? Number(latest.cumulativeReturnPct) : 0,
      dailyReturnPct: latest ? Number(latest.dailyReturnPct) : null,
      currentRank: latest?.rank ?? null,
      transactionCount: transactions.length,
      distinctAssetsTradedCount: new Set(transactions.map((t) => t.assetId)).size,
      rankHistory: snapshots.map((s) => ({ timestamp: s.timestamp, rank: s.rank })),
      currentStreakDays: pf.user.currentStreakDays,
      longestStreakDays: pf.user.longestStreakDays,
      participantCount: portfolios.length,
    });

    const earned = evaluateBadgeCatalog(ctx);
    console.log(`  ${pf.user.name.padEnd(24)} → ${earned.length ? earned.join(", ") : "(aucun)"}`);
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2 : Lancer le dry-run sur la prod**

Run: `DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | cut -d= -f2- | tr -d '\"')" npx tsx scripts/badge-dryrun.ts`
Expected: une ligne par participant, aucune erreur. **Contrôle manuel** : aucun participant ne reçoit un badge « exploit » qui n'aurait pas de sens (ex. `INTOUCHABLE` sur quelqu'un jamais 1er). Le concours Août 2026 étant clos, ces attributions ne seront jamais écrites — c'est juste un sanity check du catalogue.

- [ ] **Step 3 : Contrôles finaux**

Run: `npx tsc --noEmit`
Expected: aucune sortie (clean).

Run: `npx vitest run`
Expected: tous les fichiers passent (le nombre total de tests a augmenté).

Run: `npx eslint src/lib/gamification src/app/badges src/components/badges scripts/badge-dryrun.ts`
Expected: aucune sortie.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4 : Commit**

```bash
git add scripts/badge-dryrun.ts
git commit -m "chore: badge-dryrun read-only sanity script for the new catalogue"
```

- [ ] **Step 5 : Mettre à jour le rapport avant/après dans la spec**

Dans `docs/superpowers/specs/2026-08-31-badges-redesign-design.md` §13, si le décompte final diffère (badges retirés en cours de route), aligner les nombres. Commit :

```bash
git add docs/superpowers/specs/2026-08-31-badges-redesign-design.md
git commit -m "docs: align badges spec report with the implemented catalogue"
```

---

## Self-review (effectuée)

**Couverture de la spec :**
- §1 objectif → Tasks 4–13. §2 périmètre Phase 1 → couvert ; Phase 2 explicitement hors plan.
- §3 contraintes données → Tasks 2, 9 (champs dérivés depuis les données réellement dispo).
- §4 architecture (pas de migration, catalogue code, chemins d'attribution, nouveaux champs) → Tasks 2, 8, 9.
- §5 catégories & rareté → Tasks 8, 11 (`badge-display.ts`).
- §6 catalogue 40 badges → Tasks 4–8 (chaque badge a une condition testée). §6.2 supprimés → Task 6 (`conviction` + module) et absence dans les nouveaux tableaux.
- §7 refonte visuelle → Tasks 11, 13. Barres de progression par badge : explicitement hors périmètre (spec §7.3).
- §8 notifications → Task 12.
- §9 vérification → Task 14 + assertions monotonie dans les tests catalogue (Task 8).
- §10 défauts admin → Task 1.
- §11 tests → chaque task porte ses tests.
- §12 ordre → suivi.

**Placeholders :** aucun `TODO`/`TBD` ; chaque étape de code montre le code complet.

**Cohérence des types :** `AwardedBadge` (icon+description) défini Task 9, consommé Task 12. `UnseenBadge` (icon+description) défini Task 11, consommé Task 12. `BadgeBoard.byCategory` / `byRarity` définis Task 11, consommés Task 13. `computeMaxPostBuyGainPct` déplacé Task 3, réimporté Tasks 9 et 10. `CLOSE_ONLY_CODES` dérivé de l'absence de `evaluate` (Task 8) — cohérent avec les specs close-only sans `evaluate` (Tasks 5, 7, 8).

**Écart connu :** le catalogue est à 40 badges (la présentation annonçait ~34). Chaque badge a une condition distincte et atteignable ; candidats à retirer notés dans la spec §6.1 si l'utilisateur veut resserrer — décision utilisateur avant/pendant l'exécution.
