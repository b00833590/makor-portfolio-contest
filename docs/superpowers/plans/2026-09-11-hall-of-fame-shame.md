# Hall of Fame / Shame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Hall of Shame" section (worst-ever performance + full worst-performances list) to the existing `/hall-of-fame` page, reusing the historical data that already exists, without touching the promotion-closure logic or the Prisma schema.

**Architecture:** `HallOfFameEntry` already stores one row per participant per closed promotion (not just the podium), sorted by `getHallOfFame()` into `entries` (best-first). The worst-ever entry is simply `entries.at(-1)`. The only real gap is that participant photos are only fetched for the podium (rank ≤ 3) and the viewer — that fetch needs to also cover the worst entry. Presentation is a new sibling component (`HallOfShameSection`) rendered at the bottom of the existing page, styled with the app's existing `--loss` token instead of `--primary`.

**Tech Stack:** Next.js App Router (Server Components), Prisma, Vitest.

## Global Constraints

- No schema changes, no changes to `promotion-lifecycle.ts` closure logic (spec: "déjà remplie — rien à construire côté clôture").
- No new color tokens — reuse `--loss` / `--destructive` (spec section "Contexte technique").
- No "lanterne rouge" per-season section, no Shame-side "participations" aggregation (spec "Décisions produit" #1-2).
- Nav label stays "Hall of Fame" in `site-header.tsx` — only the page H1 becomes "Hall of Fame / Shame" (spec "Décisions produit" #3).
- No pagination/limit added to any list (spec "Hors périmètre").
- `HallOfShameSection` must be a pure Server Component, no `"use client"` (spec "Risques").

---

### Task 1: Data layer — surface the worst-ever entry's photo

**Files:**
- Modify: `src/lib/gamification/hall-of-fame.ts:58-73`
- Test: `src/lib/gamification/hall-of-fame.test.ts`

**Interfaces:**
- Consumes: existing `db.hallOfFameEntry.findMany` (Prisma), existing `HallOfFameEntryView`, `HallOfFameData` types (unchanged shapes — no new exported fields).
- Produces: `getHallOfFame(viewerUserId?: string): Promise<HallOfFameData>` — same signature and return shape as today, but `entries.at(-1).avatarUrl` is now populated when available, exactly like `entries[0].avatarUrl` already is.

- [ ] **Step 1: Write the failing tests**

Add these two `it` blocks inside the existing `describe("getHallOfFame", ...)` block in `src/lib/gamification/hall-of-fame.test.ts`, right after the existing `"ne renvoie la photo que pour le podium (rang ≤ 3) et pour le visiteur"` test (after its closing `});` around line 141):

```ts
  it("renvoie aussi la photo de la pire performance historique, même hors podium et hors visiteur", async () => {
    storedEntries = [
      entry({ userId: "u1", userName: "A", finalRank: 1, avatarUrl: "img-a", promotionId: "p1", promotionName: "S1", finalReturnPct: 30 }),
      entry({ userId: "u2", userName: "B", finalRank: 2, avatarUrl: "img-b", promotionId: "p1", promotionName: "S1", finalReturnPct: 10 }),
      entry({ userId: "u3", userName: "C", finalRank: 3, avatarUrl: "img-c", promotionId: "p1", promotionName: "S1", finalReturnPct: 5 }),
      entry({ userId: "u4", userName: "D", finalRank: 4, avatarUrl: "img-d", promotionId: "p1", promotionName: "S1", finalReturnPct: 2 }),
      entry({ userId: "u5", userName: "E", finalRank: 5, avatarUrl: "img-e", promotionId: "p1", promotionName: "S1", finalReturnPct: -12 }),
    ];
    const data = await getHallOfFame();
    const worst = data.entries.at(-1);
    expect(worst?.userName).toBe("E");
    expect(worst?.avatarUrl).toBe("img-e");
    // Rang 4 : ni podium, ni pire, ni visiteur — sa photo ne doit toujours pas remonter.
    const rankFour = data.entries.find((e) => e.userName === "D");
    expect(rankFour?.avatarUrl).toBeNull();
  });

  it("la pire performance historique = la meilleure quand il n'existe qu'une seule entrée au total", async () => {
    storedEntries = [
      entry({ userId: "solo", userName: "Solo", finalRank: 1, avatarUrl: "img-solo", promotionId: "p1", promotionName: "S1", finalReturnPct: 4 }),
    ];
    const data = await getHallOfFame();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toBe(data.entries.at(-1));
    expect(data.entries[0].avatarUrl).toBe("img-solo");
  });
```

The mock's `AvatarOrCond`/filter logic (top of the file) does not yet understand an exact `{ promotionId, finalRank }` condition, so these tests will fail. Update the mock now, in the same file, before running anything:

Replace:
```ts
interface AvatarOrCond {
  finalRank?: { lte: number };
  userId?: string;
}
interface FindManyOptions {
  orderBy?: { finalReturnPct?: "asc" | "desc" };
  where?: { avatarUrl?: { not: null }; OR?: AvatarOrCond[] };
}

// Le mock reproduit le contrat Prisma dont dépend getHallOfFame : `orderBy`
// (tri délégué à la base) et le `where` de la 2e requête (photos du podium +
// du visiteur uniquement). Si l'un ou l'autre est retiré du code, les tests
// ci-dessous doivent casser.
const dbMock = {
  hallOfFameEntry: {
    findMany: vi.fn(async (options: FindManyOptions) => {
      let data = [...storedEntries];
      if (options?.where) {
        const w = options.where;
        data = data.filter((row) => {
          if (w.avatarUrl?.not === null && row.avatarUrl == null) return false;
          if (w.OR) {
            return w.OR.some((cond) => {
              if (cond.finalRank?.lte != null) return (row.finalRank as number) <= cond.finalRank.lte;
              if (cond.userId != null) return row.userId === cond.userId;
              return false;
            });
          }
          return true;
        });
      }
      if (options?.orderBy?.finalReturnPct === "desc") {
        data.sort((a, b) => (b.finalReturnPct as number) - (a.finalReturnPct as number));
      }
      return data;
    }),
  },
};
```

With:
```ts
interface AvatarOrCond {
  finalRank?: { lte: number } | number;
  userId?: string;
  promotionId?: string;
}
interface FindManyOptions {
  orderBy?: { finalReturnPct?: "asc" | "desc" };
  where?: { avatarUrl?: { not: null }; OR?: AvatarOrCond[] };
}

// Le mock reproduit le contrat Prisma dont dépend getHallOfFame : `orderBy`
// (tri délégué à la base) et le `where` de la 2e requête (photos du podium,
// du visiteur, et de la pire performance historique). Si l'un ou l'autre est
// retiré du code, les tests ci-dessous doivent casser.
const dbMock = {
  hallOfFameEntry: {
    findMany: vi.fn(async (options: FindManyOptions) => {
      let data = [...storedEntries];
      if (options?.where) {
        const w = options.where;
        data = data.filter((row) => {
          if (w.avatarUrl?.not === null && row.avatarUrl == null) return false;
          if (w.OR) {
            return w.OR.some((cond) => {
              if (cond.promotionId != null) {
                return row.promotionId === cond.promotionId && row.finalRank === cond.finalRank;
              }
              if (cond.userId != null) return row.userId === cond.userId;
              if (cond.finalRank != null && typeof cond.finalRank === "object") {
                return (row.finalRank as number) <= cond.finalRank.lte;
              }
              return false;
            });
          }
          return true;
        });
      }
      if (options?.orderBy?.finalReturnPct === "desc") {
        data.sort((a, b) => (b.finalReturnPct as number) - (a.finalReturnPct as number));
      }
      return data;
    }),
  },
};
```

- [ ] **Step 2: Run tests to verify the two new tests fail**

Run: `npx vitest run src/lib/gamification/hall-of-fame.test.ts`
Expected: FAIL — the two new tests fail (`worst?.avatarUrl` is `null`/`undefined` instead of `"img-e"` / `"img-solo"`), because `getHallOfFame` doesn't request the worst entry's photo yet. All pre-existing tests in the file still PASS (the mock change above is additive/backward-compatible).

- [ ] **Step 3: Implement the fix**

In `src/lib/gamification/hall-of-fame.ts`, replace lines 58-73:

```ts
export async function getHallOfFame(viewerUserId?: string): Promise<HallOfFameData> {
  const [rows, avatarRows] = await Promise.all([
    db.hallOfFameEntry.findMany({ orderBy: { finalReturnPct: "desc" }, omit: { avatarUrl: true } }),
    db.hallOfFameEntry.findMany({
      where: {
        avatarUrl: { not: null },
        OR: [
          { finalRank: { lte: PODIUM_RANK } },
          ...(viewerUserId ? [{ userId: viewerUserId }] : []),
        ],
      },
      // finalRank est unique par promotion → clé stable (promotionId, finalRank).
      select: { promotionId: true, finalRank: true, avatarUrl: true },
    }),
  ]);
  const avatarByEntry = new Map(avatarRows.map((r) => [`${r.promotionId}:${r.finalRank}`, r.avatarUrl]));
```

With:

```ts
export async function getHallOfFame(viewerUserId?: string): Promise<HallOfFameData> {
  // Séquentiel (pas Promise.all) : la 2e requête a besoin de connaître la pire
  // entrée pour demander sa photo, ce qui suppose que la 1ère ait déjà répondu.
  const rows = await db.hallOfFameEntry.findMany({ orderBy: { finalReturnPct: "desc" }, omit: { avatarUrl: true } });
  const worstEntry = rows.at(-1);

  const avatarRows = await db.hallOfFameEntry.findMany({
    where: {
      avatarUrl: { not: null },
      OR: [
        { finalRank: { lte: PODIUM_RANK } },
        ...(viewerUserId ? [{ userId: viewerUserId }] : []),
        ...(worstEntry ? [{ promotionId: worstEntry.promotionId, finalRank: worstEntry.finalRank }] : []),
      ],
    },
    // finalRank est unique par promotion → clé stable (promotionId, finalRank).
    select: { promotionId: true, finalRank: true, avatarUrl: true },
  });
  const avatarByEntry = new Map(avatarRows.map((r) => [`${r.promotionId}:${r.finalRank}`, r.avatarUrl]));
```

The rest of the function (entries mapping, seasons grouping, participations, return statement) is unchanged.

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx vitest run src/lib/gamification/hall-of-fame.test.ts`
Expected: PASS — all tests in the file green, including the two new ones and every pre-existing one.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamification/hall-of-fame.ts src/lib/gamification/hall-of-fame.test.ts
git commit -m "feat: surface the worst historical Hall of Fame entry's avatar"
```

---

### Task 2: `HallOfShameSection` presentational component

**Files:**
- Create: `src/app/hall-of-fame/hall-of-shame-section.tsx`

**Interfaces:**
- Consumes: `HallOfFameEntryView` (exported from `src/lib/gamification/hall-of-fame.ts`), `signedPct` (exported from `src/app/statistiques/format.ts`, signature `signedPct(value: number, digits = 1): string`), `UserAvatar` (`src/components/user-avatar.tsx`), `Card`/`CardContent`/`CardHeader`/`CardTitle` (`src/components/ui/card.tsx`).
- Produces: `HallOfShameSection({ worstRecord, worstEntries }: { worstRecord: HallOfFameEntryView | null; worstEntries: HallOfFameEntryView[] })` — a Server Component, default export not used (named export, matching the rest of the codebase's component convention e.g. `UserAvatar`, `SiteHeader`). Renders `null` when `worstRecord` is `null` (no closed promotion yet — same guard the Hall of Fame side already uses).

- [ ] **Step 1: Create the component file**

```tsx
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signedPct } from "@/app/statistiques/format";
import type { HallOfFameEntryView } from "@/lib/gamification/hall-of-fame";

/**
 * Miroir "pire performance" du Hall of Fame — réutilise `entries` (même liste
 * triée par getHallOfFame, lue par l'autre bout) donc jamais de source de
 * vérité divergente entre les deux moitiés de la page.
 */
export function HallOfShameSection({
  worstRecord,
  worstEntries,
}: {
  worstRecord: HallOfFameEntryView | null;
  worstEntries: HallOfFameEntryView[];
}) {
  if (!worstRecord) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hall of Shame</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Parce que ça aussi, ça fait partie de l&rsquo;histoire.
      </p>

      <Card className="mt-6 border-loss/40 bg-loss/5">
        <CardHeader>
          <CardTitle>Pire performance historique 🍌</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <UserAvatar name={worstRecord.userName} avatarUrl={worstRecord.avatarUrl} className="size-10 shrink-0" />
          <p>
            Pire performance jamais enregistrée :{" "}
            <span className="font-semibold text-foreground">{worstRecord.userName}</span> avec{" "}
            <span className="font-semibold text-loss">{signedPct(worstRecord.finalReturnPct)}</span> lors de «&nbsp;
            {worstRecord.promotionName}&nbsp;».
          </p>
        </CardContent>
      </Card>

      {worstEntries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Pires performances de tous les temps</h2>
          <Card className="mt-4 border-loss/20">
            <CardContent className="flex flex-col gap-1.5 pt-6">
              {worstEntries.map((e, i) => (
                <div
                  key={`${e.promotionId}-${e.finalRank}`}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0"
                >
                  <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{i + 1}</span>
                  <UserAvatar name={e.userName} avatarUrl={e.avatarUrl} size="sm" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{e.userName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{e.promotionName}</span>
                  </span>
                  <span
                    className={
                      e.finalReturnPct >= 0 ? "shrink-0 text-gain tabular-nums" : "shrink-0 text-loss tabular-nums"
                    }
                  >
                    {signedPct(e.finalReturnPct)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check the new file**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep hall-of-shame-section`
Expected: no output (no type errors referencing the new file).

- [ ] **Step 3: Commit**

```bash
git add src/app/hall-of-fame/hall-of-shame-section.tsx
git commit -m "feat: add HallOfShameSection presentational component"
```

---

### Task 3: Wire `HallOfShameSection` into the Hall of Fame page

**Files:**
- Modify: `src/app/hall-of-fame/page.tsx`

**Interfaces:**
- Consumes: `HallOfShameSection` from Task 2 (`src/app/hall-of-fame/hall-of-shame-section.tsx`), `getHallOfFame` from Task 1 (unchanged signature, `entries` now carries the worst entry's avatar).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Update the import and the H1**

In `src/app/hall-of-fame/page.tsx`, add the import alongside the existing ones (after the `Card` import on line 8):

```tsx
import { HallOfShameSection } from "./hall-of-shame-section";
```

Replace line 26:
```tsx
        <h1 className="text-2xl font-semibold tracking-tight">Hall of Fame</h1>
```
With:
```tsx
        <h1 className="text-2xl font-semibold tracking-tight">Hall of Fame / Shame</h1>
```

- [ ] **Step 2: Compute the worst-record props**

Replace line 20:
```tsx
  const record = entries[0] ?? null;
```
With:
```tsx
  const record = entries[0] ?? null;
  const worstRecord = entries.length > 0 ? entries[entries.length - 1] : null;
  const worstEntries = [...entries].reverse();
```

- [ ] **Step 3: Render the section**

Find the closing of the "Participations" section (the last `section` block in the file, ending just before the final `</div>\n      </>` — currently lines 124-135) and insert the new section immediately after its closing `)}` (i.e. right after line 135, still inside the outer `<div className="mx-auto w-full max-w-3xl ...">`):

```tsx
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

        <HallOfShameSection worstRecord={worstRecord} worstEntries={worstEntries} />
      </div>
    </>
  );
}
```

(This replaces the file's existing final four lines — `      </div>\n    </>\n  );\n}` — by inserting the new line before them; the rest of the "Participations" block above is unchanged.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -E "hall-of-fame/page|hall-of-shame-section"`
Expected: no output.

- [ ] **Step 5: Run the full existing test suite for this area to confirm no regression**

Run: `npx vitest run src/lib/gamification`
Expected: PASS — every test file in `src/lib/gamification` (including `hall-of-fame.test.ts` from Task 1) passes.

- [ ] **Step 6: Manual smoke check in the browser**

Run: `npm run dev` (or the project's existing dev script), then in a browser:
1. Navigate to `/hall-of-fame` while logged in as any user (participant, directeur, or admin — all three roles can reach this route per `site-header.tsx`).
2. Confirm the page title reads "Hall of Fame / Shame".
3. Confirm the existing Hall of Fame sections (Record historique, Podiums par saison, Meilleures performances de tous les temps, Participations) render exactly as before.
4. Scroll down: confirm a "Hall of Shame" divider appears below Participations, followed by a red/loss-tinted "Pire performance historique 🍌" card and a "Pires performances de tous les temps" list in descending-badness order.
5. Confirm the nav bar still reads "Hall of Fame" (not the longer title) in the top navigation, for all three roles that show it (`site-header.tsx`'s `mainNavLinks`, `adminNavLinks`, `directeurNavLinks`).
6. If no promotion has ever closed yet in your local data, confirm neither the Hall of Fame nor the Hall of Shame sections render (both guarded by `entries.length === 0` / `worstRecord === null`), and the "Aucune saison terminée..." message still shows.

Stop the dev server once verified.

- [ ] **Step 7: Commit**

```bash
git add src/app/hall-of-fame/page.tsx
git commit -m "feat: wire Hall of Shame section into the Hall of Fame page"
```

---

## Self-Review Notes

- **Spec coverage:** "historique automatique" → already true, documented, no task needed (Task 1's docstring makes this explicit in the commit). Data layer worst-avatar fetch → Task 1. Visual identity (`--loss` palette, 🍌, divider, playful-but-light copy) → Task 2. Page title change + nav unchanged → Task 3 Step 1. "Version allégée" (no per-season lanterne rouge, no Shame participations) → honored by omission (no task creates them). Regression check on existing Hall of Fame → Task 3 Steps 5-6.
- **Type consistency:** `HallOfFameEntryView` (Task 1's existing export) is the single type threaded through `HallOfShameSection`'s props (Task 2) and `page.tsx`'s `worstRecord`/`worstEntries` locals (Task 3) — no renamed or redefined shape anywhere.
- **No placeholders:** every step above contains the literal code to write, exact file paths/line numbers from the current file contents, and exact run commands with expected outcomes.
