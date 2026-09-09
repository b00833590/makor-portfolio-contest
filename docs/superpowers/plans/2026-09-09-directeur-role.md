# Rôle Directeur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `DIRECTEUR` account role — strictly read-only, transversal consultation of all contests/participants — with its own `/directeur/*` navigation space, reusing existing data-fetching functions and UI components rather than duplicating them.

**Architecture:** Prisma enum gains `DIRECTEUR`. Auth/permission plumbing (`proxy.ts`, `dal.ts`, `site-header.tsx`, role redirects) is extended to a third branch. A new `/directeur/*` route tree is built from thin Server Component pages that call the *same* `lib/gamification/*` and `lib/trading/*` query functions the participant pages already use (they already take explicit `userId`/`promotionId` params, not `session.user.*`). Two presentational blocks that are today written inline inside `leaderboard/page.tsx` and `dashboard/page.tsx` are extracted into shared components so both the participant pages and the new Directeur pages render identical UI from one source.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Prisma/PostgreSQL, Zod, Vitest, Tailwind, shadcn-style UI primitives already in `src/components/ui`.

Full design rationale: `docs/superpowers/specs/2026-09-09-directeur-role-design.md`.

## Global Constraints

- **Never run `npm run build` or `npx prisma migrate deploy` during this work.** `npm run build` runs `prisma migrate deploy` against `.env` first, and `.env` in this project points at the **production** Supabase database (see project memory `feedback_build_script_deploys_prod_migrations.md`). Use `npx tsc --noEmit` for type-checking and `npx vitest run` for tests instead.
- `npx prisma generate` is safe to run locally at any time (regenerates the TypeScript client from `schema.prisma`, touches no database).
- Applying the new migration to the real database (`npx prisma migrate deploy` against `DIRECT_URL`) and running the one-off Directeur-account script against production are **explicit manual steps requiring the user's go-ahead** — do not run them automatically as part of executing this plan.
- All dynamic route pages use the existing `{ params }: { params: Promise<{ ... }> }` convention (Next 16 async params) — copy this pattern exactly, do not use the older synchronous form.
- All new/edited UI copy is in French, matching the existing tone (see any existing page for register).
- No new npm dependencies — every task is achievable with what's already installed.
- Follow existing per-file local `currencyFormatter`/`pctFormatter` convention (each file defines its own `Intl.NumberFormat`, there is no shared formatter util in this codebase) — do not introduce one.
- Server Components fetch their own data independently; do not thread fetched data between a `layout.tsx` and its `page.tsx` via context — an extra small query is preferred over that coupling (matches existing codebase style, e.g. `admin/layout.tsx` vs `admin/portfolios/[id]/page.tsx`).

---

### Task 1: Add the `DIRECTEUR` role to the data model

**Files:**
- Modify: `prisma/schema.prisma:29-32`
- Create: `prisma/migrations/20260909120000_add_directeur_role/migration.sql`

**Interfaces:**
- Produces: Prisma enum value `UserRole.DIRECTEUR`, available from `@/generated/prisma/enums` after `prisma generate`.

- [ ] **Step 1: Add the enum value to the schema**

In `prisma/schema.prisma`, change:

```prisma
enum UserRole {
  PARTICIPANT
  ADMIN
}
```

to:

```prisma
enum UserRole {
  PARTICIPANT
  ADMIN
  DIRECTEUR
}
```

- [ ] **Step 2: Hand-write the migration**

Create `prisma/migrations/20260909120000_add_directeur_role/migration.sql`:

```sql
-- Ajoute le rôle "Directeur" : consultation globale en lecture seule de tous
-- les concours et portefeuilles, sans accès trading ni administration. Voir
-- docs/superpowers/specs/2026-09-09-directeur-role-design.md.

ALTER TYPE "UserRole" ADD VALUE 'DIRECTEUR';
```

- [ ] **Step 3: Regenerate the Prisma client (safe, local only)**

Run: `npx prisma generate`
Expected: `Generated Prisma Client ...` with no errors. This updates `src/generated/prisma/enums.ts` to include `DIRECTEUR` — every later task that types against `UserRole` depends on this.

- [ ] **Step 4: Verify the generated enum**

Run (PowerShell): `Select-String -Path src\generated\prisma\enums.ts -Pattern "DIRECTEUR"`
Expected: at least one match, confirming the generated client knows about the new value.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260909120000_add_directeur_role
git commit -m "$(cat <<'EOF'
feat: add DIRECTEUR role to the user role enum

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Do NOT commit `src/generated/prisma/**` (already gitignored/generated) and do NOT run `prisma migrate deploy` — the migration is applied to production only when the user explicitly asks for it, as a separate step outside this plan.

---

### Task 2: Role display helpers (`roleHomePath`, `roleLabel`)

Seven call sites across the app need to turn a `UserRole` into "which page is home for this role" and "what do we call this role in French" — worth one small shared, pure module instead of repeating a 3-way branch seven times.

**Files:**
- Create: `src/lib/auth/role-display.ts`
- Test: `src/lib/auth/role-display.test.ts`

**Interfaces:**
- Produces: `roleHomePath(role: UserRole): string`, `roleLabel(role: UserRole): string` — both pure, importable from server and client code (no `"server-only"`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/role-display.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { roleHomePath, roleLabel } from "./role-display";

describe("roleHomePath", () => {
  it("sends ADMIN to /admin", () => {
    expect(roleHomePath("ADMIN")).toBe("/admin");
  });

  it("sends DIRECTEUR to /directeur", () => {
    expect(roleHomePath("DIRECTEUR")).toBe("/directeur");
  });

  it("sends PARTICIPANT to /dashboard", () => {
    expect(roleHomePath("PARTICIPANT")).toBe("/dashboard");
  });
});

describe("roleLabel", () => {
  it("labels ADMIN as Administrateur", () => {
    expect(roleLabel("ADMIN")).toBe("Administrateur");
  });

  it("labels DIRECTEUR as Directeur", () => {
    expect(roleLabel("DIRECTEUR")).toBe("Directeur");
  });

  it("labels PARTICIPANT as Participant", () => {
    expect(roleLabel("PARTICIPANT")).toBe("Participant");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/role-display.test.ts`
Expected: FAIL — `Cannot find module './role-display'`.

- [ ] **Step 3: Implement**

Create `src/lib/auth/role-display.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/role-display.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/role-display.ts src/lib/auth/role-display.test.ts
git commit -m "$(cat <<'EOF'
feat: add roleHomePath/roleLabel helpers for the three account roles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `requireDirecteur` + proxy route gate

**Files:**
- Modify: `src/lib/dal.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `roleHomePath` from Task 2.
- Produces: `requireDirecteur(): Promise<Session>` (cached, mirrors `requireAdmin`), importable from `@/lib/dal`.

- [ ] **Step 1: Rewrite `src/lib/dal.ts`**

```ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { roleHomePath } from "@/lib/auth/role-display";
import type { UserRole } from "@/generated/prisma/enums";

export interface Session {
  user: SessionUser;
}

export const verifySession = cache(async (): Promise<Session> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return { user };
});

export const requireAdmin = cache(async (): Promise<Session> => {
  const session = await verifySession();
  if (session.user.role !== ("ADMIN" satisfies UserRole)) {
    redirect(roleHomePath(session.user.role));
  }
  return session;
});

export const requireDirecteur = cache(async (): Promise<Session> => {
  const session = await verifySession();
  if (session.user.role !== ("DIRECTEUR" satisfies UserRole)) {
    redirect(roleHomePath(session.user.role));
  }
  return session;
});
```

(`requireAdmin`'s redirect target changes from the hardcoded `"/dashboard"` to `roleHomePath(session.user.role)` — a Directeur hitting `/admin/*` now goes straight to `/directeur` instead of bouncing through `/dashboard` first.)

- [ ] **Step 2: Add the directeur route gate to `src/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionGate } from "@/lib/auth/session";

const protectedPrefixes = ["/dashboard", "/leaderboard", "/hall-of-fame", "/resultats", "/admin", "/directeur", "/change-password"];
const adminPrefixes = ["/admin"];
const directeurPrefixes = ["/directeur"];
const CHANGE_PASSWORD_PATH = "/change-password";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAdminRoute = adminPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isDirecteurRoute = directeurPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();

  const user = await getSessionGate();

  if (!user) {
    const signInUrl = new URL("/login", req.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Force le changement de mot de passe temporaire avant tout autre accès —
  // seule la page de changement de mot de passe elle-même y échappe.
  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, req.nextUrl));
  }

  if (isAdminRoute && user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (isDirecteurRoute && user.role !== "DIRECTEUR") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Le prefetch Next.js (déclenché dès qu'un <Link> du header entre
      // dans le viewport, pas seulement au clic) traverse quand même
      // `proxy` par défaut — sans ce filtre, chaque page charge jusqu'à 6
      // requêtes Postgres de vérification de session (une par lien de
      // navigation jamais cliqué), en plus de celle de la page réellement
      // visitée. Sans risque : une requête de prefetch n'affiche jamais son
      // contenu à l'utilisateur, la vraie navigation (non-prefetch) qui
      // suivra passera normalement par ce même proxy.
      source: "/((?!api|_next/static|_next/image|.*\\.png$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
```

(The middleware redirect target for a wrong-role directeur-route hit stays the simple hardcoded `"/dashboard"`, matching the existing admin-route precedent above it — the page-level `requireDirecteur`/`requireAdmin` guards then route the user the rest of the way correctly on their next navigation. This avoids importing extra app code into the edge middleware bundle.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/lib/dal.ts` or `src/proxy.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dal.ts src/proxy.ts
git commit -m "$(cat <<'EOF'
feat: gate /directeur routes behind the DIRECTEUR role

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire role-aware redirects after login and password change

**Files:**
- Modify: `src/app/login/actions.ts`
- Modify: `src/app/change-password/actions.ts`

**Interfaces:**
- Consumes: `roleHomePath` from Task 2.

- [ ] **Step 1: Update `src/app/login/actions.ts`**

Replace the whole file:

```ts
"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { roleHomePath } from "@/lib/auth/role-display";

export interface LoginFormState {
  error?: string;
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const name = formData.get("name");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");

  if (typeof name !== "string" || !name.trim() || typeof password !== "string" || !password) {
    return { error: "Identifiant et mot de passe requis." };
  }

  const user = await db.user.findUnique({ where: { name: name.trim() } });
  const isValid = user ? await verifyPassword(password, user.passwordHash) : false;

  // Message volontairement générique dans les deux cas (identifiant inconnu ou
  // mot de passe incorrect) — ne pas révéler si le compte existe.
  if (!user || !isValid) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }

  await createSession(user.id);
  const defaultHome = roleHomePath(user.role);
  redirect(typeof callbackUrl === "string" && callbackUrl ? callbackUrl : defaultHome);
}
```

- [ ] **Step 2: Update `src/app/change-password/actions.ts`**

In the imports, add:

```ts
import { roleHomePath } from "@/lib/auth/role-display";
```

Replace the final line of `changePassword`:

```ts
  redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
```

with:

```ts
  redirect(roleHomePath(session.user.role));
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/actions.ts src/app/change-password/actions.ts
git commit -m "$(cat <<'EOF'
feat: route Directeur accounts home after login and password change

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `SiteHeader` gains a Directeur navigation mode

**Files:**
- Modify: `src/components/site-header.tsx`

**Interfaces:**
- Consumes: `roleLabel` from Task 2.
- Produces: `SiteHeader` now accepts `role: "ADMIN" | "PARTICIPANT" | "DIRECTEUR"`.

- [ ] **Step 1: Rewrite `src/components/site-header.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { handleSignOut } from "@/lib/auth-actions";
import { roleLabel } from "@/lib/auth/role-display";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavLink {
  href: string;
  label: string;
}

const participantNavLinks: NavLink[] = [
  { href: "/dashboard", label: "Portefeuille" },
  { href: "/badges", label: "Badges" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/reglement", label: "Règlement" },
  { href: "/contact", label: "Contact" },
];

// L'admin ne joue pas — pas de portefeuille, pas de classement/stats personnels
// (voir les redirections dans leaderboard/page.tsx et statistiques/page.tsx) ;
// seuls le Hall of Fame et le Contact restent pertinents hors espace admin.
const adminNavLinks: NavLink[] = [
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/contact", label: "Contact" },
];

// Le Directeur consulte, il ne joue pas non plus — sa navigation part de la
// liste des concours (espace dédié /directeur) ; le détail d'un concours
// (classement/statistiques/règlement) et d'un participant (portefeuille/badges)
// se navigue depuis l'intérieur de cet espace, pas depuis la barre du haut.
const directeurNavLinks: NavLink[] = [
  { href: "/directeur", label: "Concours" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({
  name,
  role,
  avatarUrl = null,
}: {
  name: string;
  role: "ADMIN" | "PARTICIPANT" | "DIRECTEUR";
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const homeHref = role === "ADMIN" ? "/admin" : role === "DIRECTEUR" ? "/directeur" : "/dashboard";
  const navLinks = role === "ADMIN" ? adminNavLinks : role === "DIRECTEUR" ? directeurNavLinks : participantNavLinks;
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const isLinkActive = (href: string) => (href === "/admin/promotions" ? pathname.startsWith("/admin") : pathname === href);
  const allLinks = role === "ADMIN" ? [...navLinks, { href: "/admin/promotions", label: "Admin" }] : navLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 size-10 sm:hidden"
                  aria-label="Ouvrir le menu de navigation"
                />
              }
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {allLinks.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={<Link href={link.href} />}
                    className={cn(
                      "rounded-md px-3 py-3 text-base font-medium transition-colors",
                      isLinkActive(link.href)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href={homeHref} className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_theme(colors.primary)]" />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Makor <span className="text-muted-foreground font-normal">Concours</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isLinkActive(link.href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <UserAvatar name={name} avatarUrl={avatarUrl} className="size-8 text-xs" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="font-medium">{name}</p>
                <p className="text-xs font-normal text-muted-foreground">{roleLabel(role)}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profil" />}>Mon profil</DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/change-password" />}>
              Changer mon mot de passe
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void handleSignOut();
              }}
            >
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: this will currently still show errors from other files that pass `role="ADMIN" | "PARTICIPANT"` typed session objects into `SiteHeader` — those resolve automatically once `SessionUser.role` is `UserRole` (already true today) and callers pass `session.user.role` directly (already true today). No action needed here; just confirm no error originates from `site-header.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "$(cat <<'EOF'
feat: add Directeur navigation mode to SiteHeader

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Role label on the profile page

**Files:**
- Modify: `src/app/profil/page.tsx`

**Interfaces:**
- Consumes: `roleLabel` from Task 2.

- [ ] **Step 1: Add the import**

At the top of `src/app/profil/page.tsx`, add:

```ts
import { roleLabel } from "@/lib/auth/role-display";
```

- [ ] **Step 2: Replace the inline ternary**

Replace:

```tsx
              <span className="font-medium">{user.role === "ADMIN" ? "Administrateur" : "Participant"}</span>
```

with:

```tsx
              <span className="font-medium">{roleLabel(user.role)}</span>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/profil/page.tsx
git commit -m "$(cat <<'EOF'
feat: show Directeur role label on the profile page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Correct the "not a participant" redirect on the 5 participant-only pages

Today these pages redirect only `ADMIN` away, hardcoded to `/admin`. A Directeur hitting them would currently fall through and see broken/empty participant UI (no `promotionId`). Fix: redirect anyone who isn't `PARTICIPANT`, to their own role home.

**Files:**
- Modify: `src/app/dashboard/page.tsx:30-32`
- Modify: `src/app/leaderboard/page.tsx:299-301`
- Modify: `src/app/statistiques/page.tsx:17-19`
- Modify: `src/app/badges/page.tsx:21-23`
- Modify: `src/app/resultats/page.tsx:29`

**Interfaces:**
- Consumes: `roleHomePath` from Task 2.

- [ ] **Step 1: `src/app/dashboard/page.tsx`**

Add import: `import { roleHomePath } from "@/lib/auth/role-display";`

Replace:

```tsx
  // L'admin ne joue pas — pas de portefeuille, le panneau d'administration le remplace.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
```

with:

```tsx
  // Seul un participant a un portefeuille personnel — admin et Directeur ont
  // leurs propres espaces.
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
```

(This edit is superseded by the full-file rewrite in Task 14 — apply it here first so the file type-checks standalone; Task 14 preserves it.)

- [ ] **Step 2: `src/app/leaderboard/page.tsx`**

Add import: `import { roleHomePath } from "@/lib/auth/role-display";`

Replace:

```tsx
  // L'admin ne joue pas — le classement ne le concerne pas, voir dashboard/page.tsx pour le même choix.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
```

with:

```tsx
  // Seul un participant a un classement personnel à consulter ici — admin et
  // Directeur ont leurs propres espaces (voir dashboard/page.tsx pour le même choix).
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
```

(This edit is superseded by the full-file rewrite in Task 13 — apply it here first, Task 13 preserves it.)

- [ ] **Step 3: `src/app/statistiques/page.tsx`**

Add import: `import { roleHomePath } from "@/lib/auth/role-display";`

Replace:

```tsx
  // L'admin ne joue pas — les statistiques personnelles ne le concernent pas, voir dashboard/page.tsx pour le même choix.
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
```

with:

```tsx
  // Seul un participant a des statistiques personnelles à consulter ici —
  // admin et Directeur ont leurs propres espaces (voir dashboard/page.tsx pour le même choix).
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
```

- [ ] **Step 4: `src/app/badges/page.tsx`**

Add import: `import { roleHomePath } from "@/lib/auth/role-display";`

Replace:

```tsx
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
```

with:

```tsx
  // Seul un participant a une collection de badges personnelle — admin et
  // Directeur ont leurs propres espaces (voir dashboard/page.tsx pour le même choix).
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
```

- [ ] **Step 5: `src/app/resultats/page.tsx`**

Add import: `import { roleHomePath } from "@/lib/auth/role-display";`

Replace:

```tsx
  if (session.user.role === "ADMIN") redirect("/admin");
```

with:

```tsx
  // Flux propre aux participants (bandeau de fin de concours) — admin et
  // Directeur ont leurs propres espaces.
  if (session.user.role !== "PARTICIPANT") redirect(roleHomePath(session.user.role));
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/leaderboard/page.tsx src/app/statistiques/page.tsx src/app/badges/page.tsx src/app/resultats/page.tsx
git commit -m "$(cat <<'EOF'
fix: redirect Directeur accounts away from participant-only pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Let `createParticipantWithTempPassword` create a Directeur account

The existing helper already generates a random temp password and sets `mustChangePassword: true` — exactly the mechanism the Directeur account needs. Add an optional `role`, defaulting to `PARTICIPANT` (zero behavior change for every existing caller).

**Files:**
- Modify: `src/lib/participants/create-participant.ts`
- Modify: `src/lib/participants/create-participant.test.ts` (add one case, don't touch existing ones)

**Interfaces:**
- Produces: `createParticipantWithTempPassword(input: { name: string; role?: UserRole }): Promise<ParticipantCreationResult>` — existing signature widened, existing behavior unchanged when `role` is omitted.

- [ ] **Step 1: Write the failing test (append to the existing file)**

Add to `src/lib/participants/create-participant.test.ts`, inside the existing `describe("createParticipantWithTempPassword", ...)` block, as a new `it`:

```ts
  it("crée un compte avec le rôle demandé quand il est fourni", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-directeur" });

    const result = await createParticipantWithTempPassword({ name: "Stéphane Chouffan", role: "DIRECTEUR" });

    expect(result.status).toBe("created");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Stéphane Chouffan", role: "DIRECTEUR" }),
      }),
    );
  });

  it("crée un participant par défaut quand le rôle n'est pas fourni", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "user-z" });

    await createParticipantWithTempPassword({ name: "Adam Dupont" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "PARTICIPANT" }),
      }),
    );
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/participants/create-participant.test.ts`
Expected: the two new tests FAIL (current `data` object has no `role` key at all, so `objectContaining({ role: ... })` doesn't match); the three pre-existing tests still PASS.

- [ ] **Step 3: Implement**

Replace `src/lib/participants/create-participant.ts`:

```ts
import "server-only";
import { db } from "@/lib/db";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import type { UserRole } from "@/generated/prisma/enums";

export interface ParticipantCreationInput {
  name: string;
  /** Rôle du compte créé — `PARTICIPANT` par défaut. Le seul autre appelant aujourd'hui est la création de comptes Directeur (voir admin/directeurs/actions.ts). */
  role?: UserRole;
}

export type ParticipantCreationResult =
  | { name: string; status: "created"; id: string; tempPassword: string }
  | { name: string; status: "exists" };

/**
 * Crée UN compte avec un mot de passe temporaire généré (jamais choisi par
 * l'admin) — `mustChangePassword: true` force le changement à la première
 * connexion (voir src/proxy.ts). Ne fait rien si l'identifiant existe déjà.
 * L'inscription à une promotion (participants uniquement) est une étape
 * séparée : l'appelant enchaîne `registerParticipants` (voir
 * promotion-membership.ts).
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
    data: { name, passwordHash, mustChangePassword: true, role: input.role ?? "PARTICIPANT" },
  });

  return { name, status: "created", id: user.id, tempPassword };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/participants/create-participant.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/participants/create-participant.ts src/lib/participants/create-participant.test.ts
git commit -m "$(cat <<'EOF'
feat: allow createParticipantWithTempPassword to create non-participant roles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Admin UI — manage Directeur accounts

Mirrors `/admin/participants` (form + table + row actions), simplified: no promotion assignment.

**Files:**
- Create: `src/app/admin/directeurs/schema.ts`
- Test: `src/app/admin/directeurs/schema.test.ts`
- Create: `src/app/admin/directeurs/actions.ts`
- Create: `src/app/admin/directeurs/directeur-form.tsx`
- Create: `src/app/admin/directeurs/directeur-row-actions.tsx`
- Create: `src/app/admin/directeurs/page.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `createParticipantWithTempPassword` (Task 8), `requireAdmin` (`@/lib/dal`), `logAudit` (`@/lib/audit`), `hashPassword`/`generateTempPassword` (`@/lib/auth/password`), `destroyAllSessionsForUser` (`@/lib/auth/session`), `CredentialsResult` (`@/components/credentials-result`).
- Produces: server actions `createDirecteur`, `resetDirecteurPassword`, `deleteDirecteur`.

- [ ] **Step 1: Write the failing schema test**

Create `src/app/admin/directeurs/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createDirecteurSchema, resetDirecteurPasswordSchema } from "./schema";

describe("createDirecteurSchema", () => {
  it("accepts a valid name", () => {
    const result = createDirecteurSchema.safeParse({ name: "Stéphane Chouffan" });
    expect(result.success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    const result = createDirecteurSchema.safeParse({ name: "S" });
    expect(result.success).toBe(false);
  });
});

describe("resetDirecteurPasswordSchema", () => {
  it("accepts a valid user id", () => {
    const result = resetDirecteurPasswordSchema.safeParse({ userId: "user-1" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing user id", () => {
    const result = resetDirecteurPasswordSchema.safeParse({ userId: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/admin/directeurs/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Implement the schema**

Create `src/app/admin/directeurs/schema.ts`:

```ts
import { z } from "zod";

export const createDirecteurSchema = z.object({
  name: z.string().trim().min(2, "Identifiant trop court (Prénom Nom)"),
});

export const resetDirecteurPasswordSchema = z.object({
  userId: z.string().min(1),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/admin/directeurs/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the server actions**

Create `src/app/admin/directeurs/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import { destroyAllSessionsForUser } from "@/lib/auth/session";
import { createParticipantWithTempPassword } from "@/lib/participants/create-participant";
import { createDirecteurSchema, resetDirecteurPasswordSchema } from "./schema";

export interface DirecteurFormState {
  error?: string;
  created?: { name: string; tempPassword: string };
}

export async function createDirecteur(
  _prevState: DirecteurFormState,
  formData: FormData,
): Promise<DirecteurFormState> {
  const session = await requireAdmin();

  const parsed = createDirecteurSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await createParticipantWithTempPassword({ name: parsed.data.name, role: "DIRECTEUR" });
  if (result.status === "exists") {
    return { error: `L'identifiant "${parsed.data.name}" est déjà utilisé.` };
  }

  await logAudit({
    adminId: session.user.id,
    action: "directeur.create",
    target: parsed.data.name,
  });

  revalidatePath("/admin/directeurs");
  return { created: { name: result.name, tempPassword: result.tempPassword } };
}

export async function resetDirecteurPassword(
  _prevState: DirecteurFormState,
  formData: FormData,
): Promise<DirecteurFormState> {
  const session = await requireAdmin();

  const parsed = resetDirecteurPasswordSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await db.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash, mustChangePassword: true },
  });
  await destroyAllSessionsForUser(parsed.data.userId);

  await logAudit({
    adminId: session.user.id,
    action: "directeur.reset-password",
    target: parsed.data.userId,
  });

  revalidatePath("/admin/directeurs");
  return { created: { name: user.name, tempPassword } };
}

export async function deleteDirecteur(userId: string): Promise<void> {
  const session = await requireAdmin();

  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.delete({ where: { id: userId } });

  await logAudit({
    adminId: session.user.id,
    action: "directeur.delete",
    target: userId,
    before: { name: before.name },
  });

  revalidatePath("/admin/directeurs");
}
```

- [ ] **Step 6: Implement the create form**

Create `src/app/admin/directeurs/directeur-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createDirecteur, type DirecteurFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredentialsResult } from "@/components/credentials-result";

const initialState: DirecteurFormState = {};

export function DirecteurForm() {
  const [state, formAction, pending] = useActionState(createDirecteur, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="name">Identifiant (Prénom Nom)</Label>
          <Input id="name" name="name" required placeholder="Prénom Nom" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Création..." : "Créer le compte Directeur"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.created && <CredentialsResult name={state.created.name} tempPassword={state.created.tempPassword} />}
    </form>
  );
}
```

- [ ] **Step 7: Implement the row actions**

Create `src/app/admin/directeurs/directeur-row-actions.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { resetDirecteurPassword, deleteDirecteur, type DirecteurFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CredentialsResult } from "@/components/credentials-result";

const initialState: DirecteurFormState = {};

export function DirecteurRowActions({ userId, name }: { userId: string; name: string }) {
  const [resetOpen, setResetOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(resetDirecteurPassword, initialState);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteDirecteur(userId);
      setDeleteOpen(false);
    } catch {
      setDeleteError("La suppression a échoué. Réessayez.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Réinitialiser le mot de passe</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe de {name}</DialogTitle>
          </DialogHeader>
          <form action={resetAction} className="flex flex-col gap-2">
            <input type="hidden" name="userId" value={userId} />
            <Label>Mot de passe</Label>
            <p className="text-xs text-muted-foreground">
              Génère un nouveau mot de passe temporaire — {name} devra en choisir un nouveau à sa prochaine connexion.
            </p>
            <Button type="submit" size="sm" disabled={resetPending} className="self-start">
              {resetPending ? "Génération..." : "Réinitialiser le mot de passe"}
            </Button>
            {resetState.error && <p className="text-sm text-destructive">{resetState.error}</p>}
            {resetState.created && (
              <CredentialsResult name={resetState.created.name} tempPassword={resetState.created.tempPassword} />
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          Supprimer
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {name} ?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Cette action est <strong className="text-destructive">définitive et irréversible</strong>.
            </p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" size="sm" disabled={deletePending} onClick={handleDelete}>
                {deletePending ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 8: Implement the page**

Create `src/app/admin/directeurs/page.tsx`:

```tsx
import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DirecteurForm } from "./directeur-form";
import { DirecteurRowActions } from "./directeur-row-actions";

export default async function DirecteursPage() {
  const directeurs = await db.user.findMany({
    where: { role: "DIRECTEUR" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <DirecteurForm />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Identifiant</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {directeurs.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-sm text-muted-foreground">
                Aucun compte Directeur pour le moment.
              </TableCell>
            </TableRow>
          )}
          {directeurs.map((directeur) => (
            <TableRow key={directeur.id}>
              <TableCell className="font-medium">{directeur.name}</TableCell>
              <TableCell>
                <DirecteurRowActions userId={directeur.id} name={directeur.name} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 9: Add the nav item to `src/app/admin/layout.tsx`**

Replace:

```ts
const navItems = [
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/assets", label: "Univers d'actifs" },
  { href: "/admin/reglement", label: "Règlement" },
  { href: "/admin/audit", label: "Journal d'audit" },
];
```

with:

```ts
const navItems = [
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/directeurs", label: "Directeurs" },
  { href: "/admin/assets", label: "Univers d'actifs" },
  { href: "/admin/reglement", label: "Règlement" },
  { href: "/admin/audit", label: "Journal d'audit" },
];
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/admin/directeurs src/app/admin/layout.tsx
git commit -m "$(cat <<'EOF'
feat: add admin UI to create and manage Directeur accounts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: One-off script — create Stéphane Chouffan's account

Mirrors `prisma/seed-admin.ts`: idempotent, hashes the password directly with `bcryptjs` (not via `src/lib/auth/password.ts`, which is `"server-only"` and can't be imported outside the Next.js runtime), uses the literal password `"1234"` per the user's explicit request (this is *not* `generateTempPassword()` — the value is imposed, not generated).

**Files:**
- Create: `scripts/create-directeur.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Create `scripts/create-directeur.ts`:

```ts
/**
 * Crée le compte Directeur de Stéphane Chouffan avec le mot de passe
 * temporaire littéral demandé ("1234") — sûr à relancer (idempotent, ne
 * touche à rien d'autre). Usage : npm run db:create-directeur
 *
 * Mot de passe volontairement littéral, pas généré : contrairement au reset
 * admin (voir admin/directeurs/actions.ts), c'est ici une valeur imposée le
 * temps des vérifications de l'admin — voir
 * docs/superpowers/specs/2026-09-09-directeur-role-design.md.
 *
 * N'importe pas de modules "server-only" (voir prisma/seed-admin.ts pour
 * l'explication) : bcryptjs est appelé directement ici plutôt que via
 * src/lib/auth/password.ts.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { UserRole } from "../src/generated/prisma/enums";

const DIRECTEUR_NAME = "Stéphane Chouffan";
const TEMP_PASSWORD = "1234";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const existing = await db.user.findUnique({ where: { name: DIRECTEUR_NAME } });
  if (existing) {
    console.log(`Le compte Directeur "${DIRECTEUR_NAME}" existe déjà — rien à faire.`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
  await db.user.create({
    data: { name: DIRECTEUR_NAME, passwordHash, role: UserRole.DIRECTEUR, mustChangePassword: true },
  });

  console.log(`Compte Directeur créé : identifiant "${DIRECTEUR_NAME}", mot de passe temporaire "${TEMP_PASSWORD}".`);
  console.log("Le changement de mot de passe sera imposé dès la première connexion.");

  await db.$disconnect();
}

main().catch((error) => {
  console.error("Échec de la création du compte Directeur :", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, in `"scripts"`, add a line after `"db:seed:demo"`:

```json
    "db:create-directeur": "tsx scripts/create-directeur.ts"
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit (do NOT run the script yet)**

```bash
git add scripts/create-directeur.ts package.json
git commit -m "$(cat <<'EOF'
feat: add one-off script to create Stéphane Chouffan's Directeur account

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: STOP — get explicit confirmation before running against production**

`.env` in this project points at the production Supabase database. Running `npm run db:create-directeur` will create a real, live account. **Do not run it as part of executing this plan** — surface this step to the user and only run it after they explicitly confirm (they said in the request: "temporary password 1234, the time I do the necessary checks" — so they likely want to run/trigger this themselves, or ask you to at a moment of their choosing). Once confirmed, the command is:

Run: `npm run db:create-directeur`
Expected output: `Compte Directeur créé : identifiant "Stéphane Chouffan", mot de passe temporaire "1234".`

---

### Task 11: Leaderboard highlights (leader / best mover / underperformer)

Pure derivation from an already-computed `LeaderboardRow[]` — no new query.

**Files:**
- Create: `src/lib/gamification/leaderboard-highlights.ts`
- Test: `src/lib/gamification/leaderboard-highlights.test.ts`

**Interfaces:**
- Consumes: `LeaderboardRow` from `@/lib/gamification/get-leaderboard`.
- Produces: `computeLeaderboardHighlights(rows: LeaderboardRow[]): LeaderboardHighlights` where `LeaderboardHighlights = { leader: LeaderboardRow | null; bestMover: LeaderboardRow | null; underperformer: LeaderboardRow | null }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/gamification/leaderboard-highlights.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLeaderboardHighlights } from "./leaderboard-highlights";
import type { LeaderboardRow } from "./get-leaderboard";

function makeRow(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    userId: "u",
    name: "User",
    avatarUrl: null,
    portfolioId: "p",
    totalValue: 1000,
    cumulativeReturnPct: 0,
    rank: 1,
    previousRank: null,
    rankChange: 0,
    weeklyReturnPct: null,
    bestPosition: null,
    worstPosition: null,
    ...overrides,
  };
}

describe("computeLeaderboardHighlights", () => {
  it("returns all null for an empty leaderboard", () => {
    expect(computeLeaderboardHighlights([])).toEqual({ leader: null, bestMover: null, underperformer: null });
  });

  it("picks rank 1 as the leader", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, cumulativeReturnPct: 10 }),
      makeRow({ userId: "b", rank: 2, cumulativeReturnPct: 5 }),
    ];
    expect(computeLeaderboardHighlights(rows).leader?.userId).toBe("a");
  });

  it("picks the highest weeklyReturnPct as the best mover, ignoring nulls", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, weeklyReturnPct: 1 }),
      makeRow({ userId: "b", rank: 2, weeklyReturnPct: 8 }),
      makeRow({ userId: "c", rank: 3, weeklyReturnPct: null }),
    ];
    expect(computeLeaderboardHighlights(rows).bestMover?.userId).toBe("b");
  });

  it("returns a null best mover when nobody has a weekly return yet", () => {
    const rows = [makeRow({ userId: "a", weeklyReturnPct: null })];
    expect(computeLeaderboardHighlights(rows).bestMover).toBeNull();
  });

  it("picks the lowest cumulativeReturnPct as the underperformer", () => {
    const rows = [
      makeRow({ userId: "a", rank: 1, cumulativeReturnPct: 10 }),
      makeRow({ userId: "b", rank: 2, cumulativeReturnPct: -4 }),
      makeRow({ userId: "c", rank: 3, cumulativeReturnPct: 2 }),
    ];
    expect(computeLeaderboardHighlights(rows).underperformer?.userId).toBe("b");
  });

  it("returns a null underperformer for a single-participant leaderboard", () => {
    const rows = [makeRow({ userId: "a" })];
    expect(computeLeaderboardHighlights(rows).underperformer).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gamification/leaderboard-highlights.test.ts`
Expected: FAIL — `Cannot find module './leaderboard-highlights'`.

- [ ] **Step 3: Implement**

Create `src/lib/gamification/leaderboard-highlights.ts`:

```ts
import type { LeaderboardRow } from "./get-leaderboard";

export interface LeaderboardHighlights {
  leader: LeaderboardRow | null;
  bestMover: LeaderboardRow | null;
  underperformer: LeaderboardRow | null;
}

/**
 * Leader (rang 1), meilleure progression sur 7 jours, et sous-performance
 * (rendement cumulé le plus bas) — dérivés du classement déjà calculé, sans
 * requête supplémentaire. `rows` doit déjà être trié par rang croissant (voir
 * get-leaderboard.ts). Utilisé par la vue d'ensemble d'un concours dans
 * l'espace Directeur.
 */
export function computeLeaderboardHighlights(rows: LeaderboardRow[]): LeaderboardHighlights {
  if (rows.length === 0) {
    return { leader: null, bestMover: null, underperformer: null };
  }

  const leader = rows[0];

  const withWeeklyReturn = rows.filter((row) => row.weeklyReturnPct !== null);
  const bestMover =
    withWeeklyReturn.length > 0
      ? withWeeklyReturn.reduce((best, row) => (row.weeklyReturnPct! > best.weeklyReturnPct! ? row : best))
      : null;

  const underperformer =
    rows.length > 1
      ? rows.reduce((worst, row) => (row.cumulativeReturnPct < worst.cumulativeReturnPct ? row : worst))
      : null;

  return { leader, bestMover, underperformer };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gamification/leaderboard-highlights.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamification/leaderboard-highlights.ts src/lib/gamification/leaderboard-highlights.test.ts
git commit -m "$(cat <<'EOF'
feat: add leaderboard highlights (leader/mover/underperformer) helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Time-remaining formatter

**Files:**
- Create: `src/lib/format-duration.ts`
- Test: `src/lib/format-duration.test.ts`

**Interfaces:**
- Produces: `formatTimeRemaining(endDate: Date, now?: Date): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/format-duration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatTimeRemaining } from "./format-duration";

describe("formatTimeRemaining", () => {
  const now = new Date("2026-09-09T12:00:00Z");

  it("says Terminé when the end date is in the past", () => {
    expect(formatTimeRemaining(new Date("2026-09-08T12:00:00Z"), now)).toBe("Terminé");
  });

  it("pluralizes correctly for multiple days", () => {
    expect(formatTimeRemaining(new Date("2026-09-14T12:00:00Z"), now)).toBe("5 jours restants");
  });

  it("uses the singular for exactly one day", () => {
    expect(formatTimeRemaining(new Date("2026-09-10T13:00:00Z"), now)).toBe("1 jour restant");
  });

  it("falls back to hours under one day remaining", () => {
    expect(formatTimeRemaining(new Date("2026-09-09T18:00:00Z"), now)).toBe("6 heures restantes");
  });

  it("never reports zero hours remaining", () => {
    expect(formatTimeRemaining(new Date("2026-09-09T12:30:00Z"), now)).toBe("1 heure restante");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format-duration.test.ts`
Expected: FAIL — `Cannot find module './format-duration'`.

- [ ] **Step 3: Implement**

Create `src/lib/format-duration.ts`:

```ts
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Temps restant avant `endDate`, arrondi à l'unité la plus lisible — jours
 * s'il en reste au moins un, sinon heures (jamais "0 heure", au moins 1 pour
 * ne pas annoncer un concours terminé qui ne l'est pas encore). Utilisé par
 * la vue d'ensemble d'un concours dans l'espace Directeur.
 */
export function formatTimeRemaining(endDate: Date, now: Date = new Date()): string {
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return "Terminé";

  const days = Math.floor(diffMs / DAY_MS);
  if (days >= 1) return `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`;

  const hours = Math.max(1, Math.round(diffMs / HOUR_MS));
  return `${hours} heure${hours > 1 ? "s" : ""} restante${hours > 1 ? "s" : ""}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format-duration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format-duration.ts src/lib/format-duration.test.ts
git commit -m "$(cat <<'EOF'
feat: add formatTimeRemaining helper for contest countdowns

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Extract `LeaderboardBoard` / `FrozenLeaderboardBoard`, refactor `/leaderboard`

This is a pure extraction: the exact JSX that exists today inside `leaderboard/page.tsx` moves into a new shared file, unchanged, parametrized by `selfUserId: string | null` instead of always reading `session.user.id`. `/leaderboard/page.tsx` is rewritten to call the extracted components — visually, nothing should change for participants.

**Files:**
- Create: `src/components/leaderboard/leaderboard-board.tsx`
- Modify: `src/app/leaderboard/page.tsx` (full rewrite, much shorter)

**Interfaces:**
- Consumes: `PromotionPerformanceChart` from `@/app/leaderboard/promotion-performance-chart` (cross-segment import of an existing, unmodified component).
- Produces: `LeaderboardBoard({ leaderboard, gaps, selfUserId, performanceSeries, initialCapital })` and `FrozenLeaderboardBoard({ rows, endDate, selfUserId })`, both exported from `@/components/leaderboard/leaderboard-board`.

- [ ] **Step 1: Create the shared component file**

Create `src/components/leaderboard/leaderboard-board.tsx`:

```tsx
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatParisDateTimeLong } from "@/lib/timezone";
import type { BestWorstPosition, LeaderboardRow } from "@/lib/gamification/get-leaderboard";
import type { LeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import type { FrozenLeaderboardRow } from "@/lib/gamification/frozen-leaderboard";
import type { PromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { PromotionPerformanceChart } from "@/app/leaderboard/promotion-performance-chart";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const medals = ["🥇", "🥈", "🥉"];

/** En-tête compact façon terminal financier — petites majuscules espacées plutôt que le style de titre habituel de l'app, réservé à ce tableau. */
function ColHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TableHead className={cn("text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}>
      {children}
    </TableHead>
  );
}

function RankCell({ rank }: { rank: number }) {
  const medal = medals[rank - 1];
  return <span className="flex items-center justify-center gap-1 tabular-nums">{medal ?? rank}</span>;
}

function RankChangeIndicator({ change }: { change: number }) {
  if (change === 0) return <span className="text-muted-foreground">—</span>;
  const isPositive = change > 0;
  return (
    <span className={cn("tabular-nums", isPositive ? "text-gain" : "text-loss")}>
      {isPositive ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

/**
 * Écart avec le leader affiché directement (la comparaison la plus lue
 * d'un coup d'œil), écart avec les voisins immédiats du classement révélé
 * au survol — trois comparaisons utiles sans les étaler sur trois colonnes.
 */
function GapCell({ gaps }: { gaps: LeaderboardGaps }) {
  if (!gaps.toLeader) {
    return <span className="font-medium text-primary">🏆 Leader</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="cursor-help tabular-nums text-loss underline decoration-dotted underline-offset-4" />}
      >
        −{gaps.toLeader.pts.toFixed(1)} pts
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-1">
        <p>🥇 Leader : −{currencyFormatter.format(gaps.toLeader.eur)}</p>
        {gaps.toAhead && <p>▲ Devant : −{currencyFormatter.format(gaps.toAhead.eur)}</p>}
        {gaps.toBehind && <p>▼ Derrière : +{currencyFormatter.format(gaps.toBehind.eur)}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function PositionLine({ position, direction }: { position: BestWorstPosition; direction: "best" | "worst" }) {
  const isPositive = position.pnlPct >= 0;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className={cn("shrink-0", direction === "best" ? "text-gain" : "text-loss")}>
        {direction === "best" ? "▲" : "▼"}
      </span>
      <span className="min-w-0 truncate font-medium">{position.symbol}</span>
      <span className={cn("shrink-0 tabular-nums", isPositive ? "text-gain" : "text-loss")}>
        {isPositive ? "+" : ""}
        {position.pnlPct.toFixed(1)}%
      </span>
    </span>
  );
}

/** Meilleure et pire position d'un participant dans une seule colonne — deux colonnes séparées pour un seul type d'information (une position) n'apportait rien de plus. */
function PositionsCell({ best, worst }: { best: BestWorstPosition | null; worst: BestWorstPosition | null }) {
  if (!best) return <span className="text-muted-foreground">—</span>;
  const single = !worst || worst.symbol === best.symbol;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <PositionLine position={best} direction="best" />
      {!single && <PositionLine position={worst!} direction="worst" />}
    </div>
  );
}

/**
 * Même contenu que la ligne de tableau desktop, réorganisé en carte empilée — pas un
 * sous-ensemble masqué des colonnes, une vraie mise en page alternative pour que rien ne
 * nécessite de défilement horizontal ni de zoom sur petit écran.
 */
function LeaderboardRowCard({ row, gaps, isSelf }: { row: LeaderboardRow; gaps: LeaderboardGaps; isSelf: boolean }) {
  return (
    <Card className={cn("gap-3 p-4", isSelf && "ring-1 ring-primary")}>
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
          <RankCell rank={row.rank} />
        </span>
        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
        {isSelf && <Badge variant="secondary">Vous</Badge>}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-lg font-semibold tabular-nums">{currencyFormatter.format(row.totalValue)}</span>
        <span className={cn("text-base font-semibold tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
          {row.cumulativeReturnPct >= 0 ? "+" : ""}
          {row.cumulativeReturnPct.toFixed(1)}%
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <GapCell gaps={gaps} />
        <span className="flex items-center gap-1">
          24 h <RankChangeIndicator change={row.rankChange} />
        </span>
      </div>

      {(row.bestPosition || row.worstPosition) && (
        <div className="border-t border-border/60 pt-2">
          <PositionsCell best={row.bestPosition} worst={row.worstPosition} />
        </div>
      )}
    </Card>
  );
}

function PodiumCard({ row, place, isSelf }: { row: LeaderboardRow; place: number; isSelf: boolean }) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-1 py-6 text-center",
        place === 1 && "border-primary/40 bg-primary/5",
        isSelf && "ring-1 ring-primary",
      )}
    >
      <span className="text-3xl">{medals[place - 1]}</span>
      <UserAvatar name={row.name} avatarUrl={row.avatarUrl} className="mt-1 size-12 text-base" />
      <p className="mt-1 font-medium">
        {row.name}
        {isSelf && (
          <Badge variant="secondary" className="ml-2 align-middle">
            Vous
          </Badge>
        )}
      </p>
      <p className={cn("text-lg font-semibold tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
        {row.cumulativeReturnPct >= 0 ? "+" : ""}
        {row.cumulativeReturnPct.toFixed(1)}%
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">{currencyFormatter.format(row.totalValue)}</p>
    </Card>
  );
}

export interface LeaderboardBoardProps {
  leaderboard: LeaderboardRow[];
  gaps: LeaderboardGaps[];
  /** Identifiant à surligner comme "Vous" — `null` pour une consultation sans participant courant (espace Directeur). */
  selfUserId: string | null;
  performanceSeries: PromotionPerformanceSeries;
  initialCapital: number;
}

/**
 * Podium, graphique comparé et tableau de classement d'une promotion active —
 * utilisé par `/leaderboard` (vue participant) et par l'espace Directeur,
 * avec `selfUserId` à `null` dans ce second cas (aucune ligne "Vous").
 */
export function LeaderboardBoard({ leaderboard, gaps, selfUserId, performanceSeries, initialCapital }: LeaderboardBoardProps) {
  const podium = leaderboard.slice(0, 3);
  const weeklyChallengeLeader = leaderboard
    .filter((row) => row.weeklyReturnPct !== null)
    .sort((a, b) => (b.weeklyReturnPct ?? 0) - (a.weeklyReturnPct ?? 0))[0];
  const participantAvatars = Object.fromEntries(leaderboard.map((row) => [row.name, row.avatarUrl]));

  return (
    <>
      {weeklyChallengeLeader && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Défi de la semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Meilleure progression sur 7 jours :{" "}
              <span className="font-semibold text-foreground">{weeklyChallengeLeader.name}</span>{" "}
              avec{" "}
              <span className="font-semibold text-gain">
                +{weeklyChallengeLeader.weeklyReturnPct!.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {podium.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {podium.map((row, index) => (
            <PodiumCard key={row.userId} row={row} place={index + 1} isSelf={row.userId === selfUserId} />
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Évolution comparée des participants</CardTitle>
        </CardHeader>
        <CardContent>
          <PromotionPerformanceChart
            points={performanceSeries.points}
            participantNames={performanceSeries.participantNames}
            initialCapital={initialCapital}
            participantAvatars={participantAvatars}
          />
        </CardContent>
      </Card>

      {leaderboard.length > 0 && (
        <>
          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {leaderboard.map((row, index) => (
              <LeaderboardRowCard key={row.userId} row={row} gaps={gaps[index]} isSelf={row.userId === selfUserId} />
            ))}
          </div>

          <Card className="mt-6 hidden py-0 md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <ColHead className="w-14 text-center">Rang</ColHead>
                  <ColHead className="w-[22%]">Participant</ColHead>
                  <ColHead className="w-[15%] text-right">Valeur</ColHead>
                  <ColHead className="w-[11%] text-right">Rendement</ColHead>
                  <ColHead className="w-[13%] text-right">Écart</ColHead>
                  <ColHead className="w-[9%] text-right">24 h</ColHead>
                  <ColHead>Positions extrêmes</ColHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, index) => (
                  <TableRow key={row.userId} className={cn(row.userId === selfUserId && "bg-muted/50 font-medium")}>
                    <TableCell className="text-center">
                      <RankCell rank={row.rank} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                        <span className="min-w-0 truncate">{row.name}</span>
                        {row.userId === selfUserId && (
                          <Badge variant="secondary" className="shrink-0">
                            Vous
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{currencyFormatter.format(row.totalValue)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", row.cumulativeReturnPct >= 0 ? "text-gain" : "text-loss")}>
                      {row.cumulativeReturnPct >= 0 ? "+" : ""}
                      {row.cumulativeReturnPct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <GapCell gaps={gaps[index]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RankChangeIndicator change={row.rankChange} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <PositionsCell best={row.bestPosition} worst={row.worstPosition} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {leaderboard.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Aucun participant dans cette promotion pour le moment.</p>
      )}
    </>
  );
}

export interface FrozenLeaderboardBoardProps {
  rows: FrozenLeaderboardRow[];
  endDate: Date;
  selfUserId: string | null;
}

/**
 * Podium et tableau du classement définitif d'une promotion clôturée — lu
 * depuis l'historique figé, aucun recalcul. Utilisé par `/leaderboard` (vue
 * participant) et par l'espace Directeur (`selfUserId` à `null`).
 */
export function FrozenLeaderboardBoard({ rows, endDate, selfUserId }: FrozenLeaderboardBoardProps) {
  const podium = rows.slice(0, 3);
  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Concours clôturé le {formatParisDateTimeLong(endDate)}. La performance n&apos;évolue plus.
      </p>

      {podium.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {podium.map((row) => (
            <Card
              key={row.finalRank}
              className={cn(
                "flex flex-col items-center gap-1 py-6 text-center",
                row.finalRank === 1 && "border-primary/40 bg-primary/5",
                row.userId === selfUserId && "ring-1 ring-primary",
              )}
            >
              <span className="text-3xl">{medals[row.finalRank - 1] ?? row.finalRank}</span>
              <UserAvatar
                name={row.userName}
                avatarUrl={row.avatarUrl}
                className={cn("mt-1", row.finalRank === 1 ? "size-12" : "size-10")}
                fallbackClassName="text-base"
              />
              <p className="mt-1 font-medium">{row.userName}</p>
              <p className={cn("text-lg font-semibold tabular-nums", row.finalReturnPct >= 0 ? "text-gain" : "text-loss")}>
                {row.finalReturnPct >= 0 ? "+" : ""}
                {row.finalReturnPct.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{currencyFormatter.format(row.finalPnlEur)}</p>
            </Card>
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <Card className="mt-6 py-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <ColHead className="w-14 text-center">Rang</ColHead>
                <ColHead>Participant</ColHead>
                <ColHead className="w-[22%] text-right">Rendement</ColHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.finalRank} className={cn(row.userId === selfUserId && "bg-muted/50 font-medium")}>
                  <TableCell className="text-center">
                    <RankCell rank={row.finalRank} />
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={row.userName} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                      <span className="min-w-0 truncate">{row.userName}</span>
                      {row.userId === selfUserId && (
                        <Badge variant="secondary" className="shrink-0">
                          Vous
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", row.finalReturnPct >= 0 ? "text-gain" : "text-loss")}>
                    {row.finalReturnPct >= 0 ? "+" : ""}
                    {row.finalReturnPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Aucun classement figé pour cette promotion.</p>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/leaderboard/page.tsx`**

Replace the whole file:

```tsx
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { computeLeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import { PromotionStatus } from "@/generated/prisma/enums";
import { roleHomePath } from "@/lib/auth/role-display";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { LeaderboardBoard, FrozenLeaderboardBoard } from "@/components/leaderboard/leaderboard-board";

export default async function LeaderboardPage() {
  const session = await verifySession();
  // Seul un participant a un classement personnel à consulter ici — admin et
  // Directeur ont leurs propres espaces (voir dashboard/page.tsx pour le même choix).
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  const header = (
    <>
      <AutoRefresh />
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
    </>
  );

  if (!user?.promotionId) {
    return (
      <>
        {header}
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes assigné à aucune promotion pour le moment.
          </p>
        </div>
      </>
    );
  }

  await closePromotionIfEnded(user.promotionId);

  const promotion = await db.promotion.findUniqueOrThrow({
    where: { id: user.promotionId },
    select: { initialCapital: true, status: true, endDate: true },
  });

  if (promotion.status === PromotionStatus.CLOSED) {
    // Concours clôturé : classement figé, aucun recalcul live, pas de <AutoRefresh />.
    const frozenRows = await getFrozenLeaderboard(user.promotionId);
    return (
      <>
        <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>
            <Badge>Classement final</Badge>
          </div>
          <FrozenLeaderboardBoard rows={frozenRows} endDate={promotion.endDate} selfUserId={session.user.id} />
        </div>
      </>
    );
  }

  const [leaderboard, performanceSeries] = await Promise.all([
    getCachedLeaderboard(user.promotionId),
    getCachedPromotionPerformanceSeries(user.promotionId),
  ]);
  const gaps = computeLeaderboardGaps(leaderboard);

  return (
    <>
      {header}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Classement</h1>
        <LeaderboardBoard
          leaderboard={leaderboard}
          gaps={gaps}
          selfUserId={session.user.id}
          performanceSeries={performanceSeries}
          initialCapital={Number(promotion.initialCapital)}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. In particular, confirm there are no leftover unused-import warnings in `leaderboard/page.tsx` (it should no longer import `UserAvatar`, `Card*`, `Table*`, `Tooltip*`, or `cn` directly).

- [ ] **Step 4: Run the test suite**

Run: `npx vitest run`
Expected: all existing tests still PASS (this task touches no tested logic, only presentation).

- [ ] **Step 5: Manual visual check**

Start the dev server (`npm run dev`), log in as an existing participant, open `/leaderboard`, and confirm it looks byte-for-byte the same as before this task: podium, weekly challenge card, performance chart, mobile cards, desktop table, and (if you have a closed promotion to check) the frozen final-standings view.

- [ ] **Step 6: Commit**

```bash
git add src/components/leaderboard/leaderboard-board.tsx src/app/leaderboard/page.tsx
git commit -m "$(cat <<'EOF'
refactor: extract LeaderboardBoard/FrozenLeaderboardBoard for reuse by the Directeur space

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Extract `PortfolioSummary`, refactor `/dashboard`

Same pattern as Task 13, for the portfolio detail block. In read-only contexts (`readOnly` or `contestClosed`), the buy form and position trading buttons are hidden using the exact mechanism `PositionCard`/`BuyForm` already use for a closed contest — no changes to either of those two files.

**Files:**
- Create: `src/app/dashboard/portfolio-summary.tsx`
- Modify: `src/app/dashboard/page.tsx` (full rewrite, much shorter)

**Interfaces:**
- Consumes: `PortfolioView` (`@/lib/trading/portfolio-view`), `PerformancePoint` (`@/lib/trading/performance-history`), `TransactionHistoryItem` (`@/lib/trading/transaction-history`), and the existing `BuyForm`/`PositionCard`/`PerformanceChart`/`TransactionHistoryTable` components — unmodified.
- Produces: `PortfolioSummary({ portfolioView, performanceHistory, transactionHistory, contestClosed, readOnly? })`, exported from `./portfolio-summary` (used both by `/dashboard` and later by the Directeur participant page in Task 20).

- [ ] **Step 1: Create the shared component file**

Create `src/app/dashboard/portfolio-summary.tsx`:

```tsx
import type { PortfolioView } from "@/lib/trading/portfolio-view";
import type { PerformancePoint } from "@/lib/trading/performance-history";
import type { TransactionHistoryItem } from "@/lib/trading/transaction-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyForm } from "./buy-form";
import { PositionCard } from "./position-card";
import { PerformanceChart } from "./performance-chart";
import { TransactionHistoryTable } from "./transaction-history-table";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Bloc "portefeuille" complet (indicateurs, graphique, achat, positions,
 * historique) — utilisé par `/dashboard` (le participant lui-même,
 * `readOnly` absent) et par l'espace Directeur (`readOnly` vrai : aucun
 * formulaire d'achat, boutons de vente masqués sur chaque position, exactement
 * comme pour un concours clôturé).
 */
export function PortfolioSummary({
  portfolioView,
  performanceHistory,
  transactionHistory,
  contestClosed,
  readOnly = false,
}: {
  portfolioView: PortfolioView;
  performanceHistory: PerformancePoint[];
  transactionHistory: TransactionHistoryItem[];
  contestClosed: boolean;
  readOnly?: boolean;
}) {
  const isReadOnly = contestClosed || readOnly;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(portfolioView.initialCapital)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capital disponible</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(portfolioView.availableCash)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valeur investie</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(portfolioView.totalMarketValue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valeur du portefeuille</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(portfolioView.totalValue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Performance totale</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-semibold tabular-nums ${portfolioView.totalGainPct >= 0 ? "text-gain" : "text-loss"}`}
          >
            {portfolioView.totalGainPct >= 0 ? "+" : ""}
            {portfolioView.totalGainPct.toFixed(1)}%
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({portfolioView.totalGainEur >= 0 ? "+" : ""}
              {currencyFormatter.format(portfolioView.totalGainEur)})
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Positions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {portfolioView.positions.length}
            <span className="ml-1 text-base font-normal text-muted-foreground">/ {portfolioView.maxPositions}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution du portefeuille</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={performanceHistory} />
        </CardContent>
      </Card>

      {!isReadOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Nouvel achat</CardTitle>
          </CardHeader>
          <CardContent>
            <BuyForm contestClosed={contestClosed} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {portfolioView.positions.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune position ouverte pour le moment.</p>
        )}
        {portfolioView.positions.map((position) => (
          <PositionCard key={position.assetId} position={position} contestClosed={isReadOnly} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionHistoryTable transactions={transactionHistory} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/dashboard/page.tsx`**

Replace the whole file:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { getCachedPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { getUnseenBadges } from "@/lib/gamification/get-unseen-badges";
import { recordDailyVisit } from "@/lib/gamification/record-daily-visit";
import { getOpenChangeSession, getNextScheduledChangeSession, getChangesUsedCount } from "@/lib/trading/execute-order";
import { ChangeSessionKind, PromotionStatus } from "@/generated/prisma/enums";
import { roleHomePath } from "@/lib/auth/role-display";
import { SiteHeader } from "@/components/site-header";
import { UnseenBadgeToaster } from "@/components/badges/unseen-badge-toaster";
import { PortfolioSummary } from "./portfolio-summary";
import { InitializationWindowBanner } from "./initialization-window-banner";
import { ChangeSessionStatusBanner } from "./change-session-status-banner";
import { AutoRefresh } from "@/components/auto-refresh";
import { ContestEndedBanner } from "@/components/contest-ended-banner";

export default async function DashboardPage() {
  const session = await verifySession();
  // Seul un participant a un portefeuille personnel — admin et Directeur ont
  // leurs propres espaces.
  if (session.user.role !== "PARTICIPANT") {
    redirect(roleHomePath(session.user.role));
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { promotionId: true },
  });
  if (dbUser?.promotionId) {
    await closePromotionIfEnded(dbUser.promotionId);
  }

  const promotion = dbUser?.promotionId
    ? await db.promotion.findUnique({
        where: { id: dbUser.promotionId },
        select: { id: true, status: true },
      })
    : null;
  const contestClosed = promotion?.status === PromotionStatus.CLOSED;

  if (contestClosed) {
    const seen = (await cookies()).get(`seen_results_${promotion!.id}`);
    if (!seen) {
      redirect("/resultats");
    }
  }

  const [portfolioView] = await Promise.all([
    getCachedPortfolioView(session.user.id),
    recordDailyVisit(session.user.id),
  ]);

  const [performanceHistory, transactionHistory, unseenBadges, openChangeSession] = portfolioView
    ? await Promise.all([
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
        getUnseenBadges(session.user.id, portfolioView.promotionId),
        getOpenChangeSession(portfolioView.promotionId),
      ])
    : [[], [], [], null];

  const isInitializationWindow = openChangeSession?.kind === ChangeSessionKind.INITIALIZATION;
  const weeklySessionOpen = openChangeSession && !isInitializationWindow ? openChangeSession : null;
  const nextChangeSession =
    portfolioView && !openChangeSession ? await getNextScheduledChangeSession(portfolioView.promotionId) : null;
  const changesUsed = weeklySessionOpen
    ? await getChangesUsedCount(weeklySessionOpen.id, session.user.id)
    : undefined;

  return (
    <>
      {!contestClosed && <AutoRefresh />}
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <UnseenBadgeToaster badges={unseenBadges} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mon portefeuille</h1>

        {contestClosed && <ContestEndedBanner />}

        {!contestClosed && isInitializationWindow && portfolioView && (
          <InitializationWindowBanner
            closesAt={openChangeSession.closesAt.toISOString()}
            investedAmount={portfolioView.initialCapital - portfolioView.availableCash}
            initialCapital={portfolioView.initialCapital}
          />
        )}

        {!contestClosed && weeklySessionOpen && (
          <ChangeSessionStatusBanner
            status="OPEN"
            opensAt={weeklySessionOpen.opensAt.toISOString()}
            closesAt={weeklySessionOpen.closesAt.toISOString()}
            changesUsed={changesUsed}
            maxChangesPerParticipant={weeklySessionOpen.maxChangesPerParticipant}
          />
        )}

        {!contestClosed && !isInitializationWindow && !weeklySessionOpen && nextChangeSession && (
          <ChangeSessionStatusBanner
            status="UPCOMING"
            opensAt={nextChangeSession.opensAt.toISOString()}
            closesAt={nextChangeSession.closesAt.toISOString()}
          />
        )}

        {!contestClosed &&
          !isInitializationWindow &&
          !weeklySessionOpen &&
          !nextChangeSession &&
          portfolioView && (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune session de changement n&apos;est prévue pour le moment — votre portefeuille est verrouillé.
            </p>
          )}

        {!portfolioView && (
          <p className="mt-8 text-sm text-muted-foreground">
            Vous n&apos;êtes pas encore assigné à une promotion, ou votre portefeuille n&apos;a pas
            encore été créé par l&apos;administrateur.
          </p>
        )}

        {portfolioView && (
          <div className="mt-6">
            <PortfolioSummary
              portfolioView={portfolioView}
              performanceHistory={performanceHistory}
              transactionHistory={transactionHistory}
              contestClosed={Boolean(contestClosed)}
            />
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. `dashboard/page.tsx` should no longer import `Card*`, `BuyForm`, `PositionCard`, `PerformanceChart`, or `TransactionHistoryTable` directly.

- [ ] **Step 4: Run the test suite**

Run: `npx vitest run`
Expected: all existing tests still PASS.

- [ ] **Step 5: Manual visual check**

Log in as a participant with an active portfolio, open `/dashboard`, and confirm indicators, chart, buy form, position cards (including Renforcer/Vendre buttons), and transaction history all render exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/portfolio-summary.tsx src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
refactor: extract PortfolioSummary for reuse by the Directeur space

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: `/directeur` home — layout, overview page, participant quick-select

**Files:**
- Create: `src/app/directeur/layout.tsx`
- Create: `src/app/directeur/participant-quick-select.tsx`
- Create: `src/app/directeur/page.tsx`

**Interfaces:**
- Consumes: `requireDirecteur` (Task 3), `formatTimeRemaining` (Task 12).
- Produces: `QuickSelectParticipant` type and `ParticipantQuickSelect` component, used only within `/directeur/page.tsx` for this task (reused nowhere else, so no cross-file export concern beyond this directory).

- [ ] **Step 1: Create the layout**

Create `src/app/directeur/layout.tsx`:

```tsx
import { requireDirecteur } from "@/lib/dal";
import { SiteHeader } from "@/components/site-header";

export default async function DirecteurLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDirecteur();

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      {children}
    </>
  );
}
```

- [ ] **Step 2: Create the participant quick-select**

Create `src/app/directeur/participant-quick-select.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";

export interface QuickSelectParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  promotionName: string;
}

export function ParticipantQuickSelect({ participants }: { participants: QuickSelectParticipant[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? participants.filter((participant) => participant.name.toLowerCase().includes(normalizedQuery))
    : participants;

  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun participant actif pour le moment.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Rechercher un participant..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Rechercher un participant"
      />
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {filtered.map((participant) => (
          <Link
            key={participant.id}
            href={`/directeur/participants/${participant.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
          >
            <UserAvatar name={participant.name} avatarUrl={participant.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{participant.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{participant.promotionName}</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun résultat pour « {query} ».</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the overview page**

Create `src/app/directeur/page.tsx`:

```tsx
import Link from "next/link";
import { requireDirecteur } from "@/lib/dal";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { formatTimeRemaining } from "@/lib/format-duration";
import { formatParisDate } from "@/lib/timezone";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParticipantQuickSelect, type QuickSelectParticipant } from "./participant-quick-select";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function DirecteurHomePage() {
  await requireDirecteur();

  const [activePromotions, closedPromotions, activeParticipants] = await Promise.all([
    db.promotion.findMany({
      where: { status: PromotionStatus.ACTIVE },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.promotion.findMany({
      where: { status: PromotionStatus.CLOSED },
      orderBy: { endDate: "desc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.promotionParticipant.findMany({
      where: { promotion: { status: PromotionStatus.ACTIVE } },
      select: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        promotion: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const quickSelectParticipants: QuickSelectParticipant[] = activeParticipants.map((participation) => ({
    id: participation.user.id,
    name: participation.user.name,
    avatarUrl: participation.user.avatarUrl,
    promotionName: participation.promotion.name,
  }));

  return (
    <>
      <AutoRefresh />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Espace Directeur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi en direct des concours Makor — consultation uniquement.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="text-lg font-semibold">Concours en cours</h2>
              {activePromotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun concours en cours pour le moment.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {activePromotions.map((promotion) => (
                    <Link key={promotion.id} href={`/directeur/promotions/${promotion.id}`}>
                      <Card className="transition-colors hover:border-primary/40">
                        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                          <CardTitle>{promotion.name}</CardTitle>
                          <Badge>{formatTimeRemaining(promotion.endDate)}</Badge>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>{promotion._count.participants} participant(s)</span>
                          <span>Capital initial {currencyFormatter.format(Number(promotion.initialCapital))}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold">Historique</h2>
              {closedPromotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucun concours terminé pour le moment.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {closedPromotions.map((promotion) => (
                    <Link key={promotion.id} href={`/directeur/promotions/${promotion.id}`}>
                      <Card className="transition-colors hover:border-primary/40">
                        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 py-4">
                          <CardTitle className="text-base">{promotion.name}</CardTitle>
                          <span className="text-xs text-muted-foreground">
                            Terminé le {formatParisDate(promotion.endDate)} · {promotion._count.participants} participant(s)
                          </span>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Accès rapide à un participant</h2>
            <div className="mt-4">
              <ParticipantQuickSelect participants={quickSelectParticipants} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

You need a `DIRECTEUR` account to test — if Task 10's script hasn't been run against a database you can reach (e.g. a local/dev database), skip this manual check for now and cover it in Task 21's end-to-end pass instead.

- [ ] **Step 6: Commit**

```bash
git add src/app/directeur/layout.tsx src/app/directeur/participant-quick-select.tsx src/app/directeur/page.tsx
git commit -m "$(cat <<'EOF'
feat: add the Directeur space home page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: `/directeur/promotions/[promotionId]` layout + vue d'ensemble

**Files:**
- Create: `src/app/directeur/promotions/[promotionId]/layout.tsx`
- Create: `src/app/directeur/promotions/[promotionId]/page.tsx`

**Interfaces:**
- Consumes: `getCachedLeaderboard`/`getFrozenLeaderboard` (existing), `computeLeaderboardHighlights` (Task 11), `formatTimeRemaining` (Task 12).

- [ ] **Step 1: Create the promotion layout**

Create `src/app/directeur/promotions/[promotionId]/layout.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "", label: "Vue d'ensemble" },
  { href: "/classement", label: "Classement" },
  { href: "/statistiques", label: "Statistiques" },
  { href: "/reglement", label: "Règlement" },
];

const statusLabel: Record<string, string> = {
  [PromotionStatus.ACTIVE]: "En cours",
  [PromotionStatus.CLOSED]: "Terminé",
  [PromotionStatus.DRAFT]: "Brouillon",
};

export default async function DirecteurPromotionLayout({
  params,
  children,
}: {
  params: Promise<{ promotionId: string }>;
  children: React.ReactNode;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { id: true, name: true, status: true },
  });
  if (!promotion) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/directeur" className="text-sm text-muted-foreground hover:underline">
        ← Concours
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{promotion.name}</h1>
        <Badge variant={promotion.status === PromotionStatus.ACTIVE ? "default" : "secondary"}>
          {statusLabel[promotion.status]}
        </Badge>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1 border-b border-border pb-3 text-sm font-medium">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={`/directeur/promotions/${promotionId}${item.href}`}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

(No `isLinkActive` highlighting here, unlike `SiteHeader` — this sub-nav is small enough that highlighting the active tab is a nice-to-have, not load-bearing; skipped to keep this file simple. Add it later if it's missed in practice.)

- [ ] **Step 2: Create the overview page**

Create `src/app/directeur/promotions/[promotionId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { closePromotionIfEnded } from "@/lib/promotion-lifecycle";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { computeLeaderboardHighlights } from "@/lib/gamification/leaderboard-highlights";
import { formatTimeRemaining } from "@/lib/format-duration";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pctFormatter = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export default async function DirecteurPromotionOverviewPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  await closePromotionIfEnded(promotionId);

  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { status: true, endDate: true, initialCapital: true },
  });
  if (!promotion) {
    notFound();
  }

  const participantCount = await db.promotionParticipant.count({ where: { promotionId } });

  if (promotion.status === PromotionStatus.CLOSED) {
    const frozenRows = await getFrozenLeaderboard(promotionId);
    const podium = frozenRows.slice(0, 3);
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">{participantCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {currencyFormatter.format(Number(promotion.initialCapital))}
            </CardContent>
          </Card>
        </div>
        {podium.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold">Podium final</h2>
            <div className="mt-3 flex flex-col gap-2">
              {podium.map((row) => (
                <div
                  key={row.finalRank}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center">{["🥇", "🥈", "🥉"][row.finalRank - 1]}</span>
                    <UserAvatar name={row.userName} avatarUrl={row.avatarUrl} size="sm" className="shrink-0" />
                    <span className="min-w-0 truncate font-medium">{row.userName}</span>
                  </span>
                  <span className={row.finalReturnPct >= 0 ? "text-gain tabular-nums" : "text-loss tabular-nums"}>
                    {pctFormatter(row.finalReturnPct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const leaderboard = await getCachedLeaderboard(promotionId);
  const highlights = computeLeaderboardHighlights(leaderboard);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{participantCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temps restant</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatTimeRemaining(promotion.endDate)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capital initial</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {currencyFormatter.format(Number(promotion.initialCapital))}
          </CardContent>
        </Card>
      </div>

      {leaderboard.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {highlights.leader && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">🏆 Leader</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.leader.name} avatarUrl={highlights.leader.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.leader.name}</span>
                <span className="ml-auto shrink-0 text-gain tabular-nums">
                  {pctFormatter(highlights.leader.cumulativeReturnPct)}
                </span>
              </CardContent>
            </Card>
          )}
          {highlights.bestMover && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">▲ Meilleure progression (7j)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.bestMover.name} avatarUrl={highlights.bestMover.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.bestMover.name}</span>
                <span className="ml-auto shrink-0 text-gain tabular-nums">
                  {pctFormatter(highlights.bestMover.weeklyReturnPct ?? 0)}
                </span>
              </CardContent>
            </Card>
          )}
          {highlights.underperformer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">▼ Sous-performance</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <UserAvatar name={highlights.underperformer.name} avatarUrl={highlights.underperformer.avatarUrl} size="sm" />
                <span className="min-w-0 truncate font-medium">{highlights.underperformer.name}</span>
                <span className="ml-auto shrink-0 text-loss tabular-nums">
                  {pctFormatter(highlights.underperformer.cumulativeReturnPct)}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">Participants</h2>
        {leaderboard.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun participant dans cette promotion pour le moment.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1">
            {leaderboard.map((row) => (
              <Link
                key={row.userId}
                href={`/directeur/participants/${row.userId}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{row.rank}</span>
                  <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                  <span className="min-w-0 truncate font-medium">{row.name}</span>
                </span>
                <span className={row.cumulativeReturnPct >= 0 ? "shrink-0 text-gain tabular-nums" : "shrink-0 text-loss tabular-nums"}>
                  {pctFormatter(row.cumulativeReturnPct)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/directeur/promotions/\[promotionId\]/layout.tsx src/app/directeur/promotions/\[promotionId\]/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Directeur contest hub (overview, indicators, highlights)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: `/directeur/promotions/[promotionId]/classement`

**Files:**
- Create: `src/app/directeur/promotions/[promotionId]/classement/page.tsx`

**Interfaces:**
- Consumes: `LeaderboardBoard`/`FrozenLeaderboardBoard` (Task 13).

- [ ] **Step 1: Create the page**

Create `src/app/directeur/promotions/[promotionId]/classement/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getFrozenLeaderboard } from "@/lib/gamification/frozen-leaderboard";
import { getCachedPromotionPerformanceSeries } from "@/lib/gamification/get-promotion-performance-series";
import { computeLeaderboardGaps } from "@/lib/gamification/leaderboard-gaps";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { LeaderboardBoard, FrozenLeaderboardBoard } from "@/components/leaderboard/leaderboard-board";

export default async function DirecteurClassementPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { initialCapital: true, status: true, endDate: true },
  });
  if (!promotion) {
    notFound();
  }

  if (promotion.status === PromotionStatus.CLOSED) {
    const frozenRows = await getFrozenLeaderboard(promotionId);
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Classement</h2>
          <Badge>Classement final</Badge>
        </div>
        <FrozenLeaderboardBoard rows={frozenRows} endDate={promotion.endDate} selfUserId={null} />
      </div>
    );
  }

  const [leaderboard, performanceSeries] = await Promise.all([
    getCachedLeaderboard(promotionId),
    getCachedPromotionPerformanceSeries(promotionId),
  ]);
  const gaps = computeLeaderboardGaps(leaderboard);

  return (
    <div>
      <AutoRefresh />
      <h2 className="text-xl font-semibold tracking-tight">Classement</h2>
      <LeaderboardBoard
        leaderboard={leaderboard}
        gaps={gaps}
        selfUserId={null}
        performanceSeries={performanceSeries}
        initialCapital={Number(promotion.initialCapital)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/directeur/promotions/\[promotionId\]/classement/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Directeur classement page reusing LeaderboardBoard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: `/directeur/promotions/[promotionId]/statistiques`

**Files:**
- Create: `src/app/directeur/promotions/[promotionId]/statistiques/page.tsx`

**Interfaces:**
- Consumes: `ContestStatsSection` from `@/app/statistiques/contest-stats-section` (existing, unmodified).

- [ ] **Step 1: Create the page**

Create `src/app/directeur/promotions/[promotionId]/statistiques/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PromotionStatus } from "@/generated/prisma/enums";
import { getCachedLeaderboard, getLeaderboard } from "@/lib/gamification/get-leaderboard";
import { getCachedContestStats } from "@/lib/gamification/get-contest-stats";
import { ContestStatsSection } from "@/app/statistiques/contest-stats-section";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function DirecteurStatistiquesPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { status: true, endDate: true },
  });
  if (!promotion) {
    notFound();
  }

  const contestClosed = promotion.status === PromotionStatus.CLOSED;
  const leaderboard = contestClosed
    ? await getLeaderboard(promotionId, promotion.endDate, { frozen: true })
    : await getCachedLeaderboard(promotionId);
  const contestStats = await getCachedContestStats(promotionId, leaderboard);

  return (
    <div>
      {!contestClosed && <AutoRefresh />}
      <h2 className="text-xl font-semibold tracking-tight">Statistiques du concours</h2>
      <div className="mt-6">
        <ContestStatsSection stats={contestStats} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/directeur/promotions/\[promotionId\]/statistiques/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Directeur contest statistics page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: `/directeur/promotions/[promotionId]/reglement`

**Files:**
- Create: `src/app/directeur/promotions/[promotionId]/reglement/page.tsx`

**Interfaces:**
- Consumes: `RulesDocument` from `@/components/rules-document` (existing, unmodified).

- [ ] **Step 1: Create the page**

Create `src/app/directeur/promotions/[promotionId]/reglement/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { promotionRulesSchema } from "@/lib/promotion-rules";
import { computeChangeSessionStatus } from "@/lib/trading/change-session-status";
import { RulesDocument } from "@/components/rules-document";

export default async function DirecteurReglementPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { promotionId } = await params;
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    include: { changeSessions: { orderBy: { opensAt: "asc" } } },
  });
  if (!promotion) {
    notFound();
  }

  const now = new Date();

  return (
    <RulesDocument
      promotion={{
        name: promotion.name,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        initialCapital: Number(promotion.initialCapital),
        rules: promotionRulesSchema.parse(promotion.rules),
        rulesIntro: promotion.rulesIntro,
        rulesCustomNotes: promotion.rulesCustomNotes,
      }}
      changeSessions={promotion.changeSessions.map((session) => ({
        ...session,
        effectiveStatus: computeChangeSessionStatus(session, now),
      }))}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/directeur/promotions/\[promotionId\]/reglement/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Directeur contest rules page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: `/directeur/participants/[userId]` — read-only portfolio + badges

**Files:**
- Create: `src/app/directeur/participants/[userId]/badges-section.tsx`
- Create: `src/app/directeur/participants/[userId]/page.tsx`

**Interfaces:**
- Consumes: `PortfolioSummary` (Task 14), `BadgesTabs`/`BadgeTab` from `@/app/badges/badges-tabs` (existing, unmodified), `getBadgeBoard` (existing).

- [ ] **Step 1: Create the badges section**

Create `src/app/directeur/participants/[userId]/badges-section.tsx`:

```tsx
import { getBadgeBoard } from "@/lib/gamification/get-badge-board";
import { BadgesTabs, type BadgeTab } from "@/app/badges/badges-tabs";

/**
 * Deux onglets seulement (saison en cours + collection à vie), pas un onglet
 * par saison passée comme sur `/badges` — le Directeur suit l'état actuel
 * d'un participant, pas son historique saison par saison, et sans les
 * records personnels (propres au participant lui-même).
 */
export async function DirecteurBadgesSection({
  userId,
  activePromotionId,
  activePromotionName,
}: {
  userId: string;
  activePromotionId: string | null;
  activePromotionName: string | null;
}) {
  const [activeBoard, lifetimeBoard] = await Promise.all([
    activePromotionId ? getBadgeBoard(userId, activePromotionId) : Promise.resolve(null),
    getBadgeBoard(userId),
  ]);

  const tabs: BadgeTab[] = [
    ...(activeBoard && activePromotionName
      ? [{ value: activePromotionId!, label: activePromotionName, board: activeBoard }]
      : []),
    { value: "all", label: "Toutes saisons", board: lifetimeBoard },
  ];

  return <BadgesTabs tabs={tabs} defaultValue={tabs[0].value} justUnlockedCodes={new Set()} />;
}
```

- [ ] **Step 2: Create the page**

Create `src/app/directeur/participants/[userId]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCachedPortfolioView } from "@/lib/trading/portfolio-view";
import { getPerformanceHistory } from "@/lib/trading/performance-history";
import { getTransactionHistory } from "@/lib/trading/transaction-history";
import { PromotionStatus } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { PortfolioSummary } from "@/app/dashboard/portfolio-summary";
import { DirecteurBadgesSection } from "./badges-section";

export default async function DirecteurParticipantPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true, role: true },
  });
  if (!targetUser || targetUser.role !== "PARTICIPANT") {
    notFound();
  }

  const portfolioView = await getCachedPortfolioView(userId);
  const [performanceHistory, transactionHistory] = portfolioView
    ? await Promise.all([
        getPerformanceHistory(portfolioView.portfolioId),
        getTransactionHistory(portfolioView.portfolioId),
      ])
    : [[], []];

  const contestClosed = portfolioView?.promotionStatus === PromotionStatus.CLOSED;

  return (
    <>
      {portfolioView && !contestClosed && <AutoRefresh />}
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {portfolioView ? (
          <Link
            href={`/directeur/promotions/${portfolioView.promotionId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {portfolioView.promotionName}
          </Link>
        ) : (
          <Link href="/directeur" className="text-sm text-muted-foreground hover:underline">
            ← Concours
          </Link>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <UserAvatar name={targetUser.name} avatarUrl={targetUser.avatarUrl} className="size-10" />
          <h1 className="text-2xl font-semibold tracking-tight">Portefeuille de {targetUser.name}</h1>
          <Badge variant="secondary">Lecture seule</Badge>
        </div>

        {portfolioView ? (
          <div className="mt-6">
            <PortfolioSummary
              portfolioView={portfolioView}
              performanceHistory={performanceHistory}
              transactionHistory={transactionHistory}
              contestClosed={Boolean(contestClosed)}
              readOnly
            />
          </div>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Ce participant n&apos;a pas de portefeuille actif pour le moment.
          </p>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Badges</h2>
          <div className="mt-4">
            <DirecteurBadgesSection
              userId={userId}
              activePromotionId={portfolioView?.promotionId ?? null}
              activePromotionName={portfolioView?.promotionName ?? null}
            />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/directeur/participants/[userId]"
git commit -m "$(cat <<'EOF'
feat: add Directeur read-only participant portfolio and badges page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: End-to-end manual verification

Cannot be automated (no E2E harness in this repo — see `vitest.config.mts`, which only runs `src/**/*.test.ts`). Requires a `DIRECTEUR` account; use the account created in Task 10, or create a throwaway one via `/admin/directeurs` against whatever database `npm run dev` is currently pointed at.

**Files:** none — verification only.

- [ ] **Step 1: Full type-check and test suite**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npx vitest run`
Expected: all tests PASS, including every new test file added in Tasks 2, 8, 9, 11, 12.

- [ ] **Step 2: Read-only walkthrough**

Start `npm run dev`, log in as the Directeur account, and walk the full funnel:

1. `/directeur` — see the active contest card(s) with participant count + time remaining, and any closed contests under "Historique".
2. Click a contest → `/directeur/promotions/[id]` — see participant count, time remaining, leader/best-mover/underperformer cards, and the participant list.
3. Click "Classement" — same podium/table/chart as the participant-facing `/leaderboard`, with no "Vous" badge anywhere.
4. Click "Statistiques" — contest-wide stats only (no "Mes statistiques" tab).
5. Click "Règlement" — same rendered rules document as the participant-facing `/reglement`.
6. From the participant list (or the home page's quick-select), click a participant → `/directeur/participants/[userId]` — confirm: identical stat cards/chart/position list/transaction history as that participant would see on their own `/dashboard`, a "Lecture seule" badge, **no** "Nouvel achat" card, and **no** "Renforcer"/"Vendre" buttons on any position.
7. Click the Badges tabs on that same page — confirm the badge grid renders (earned + locked).
8. Top nav → "Hall of Fame" and "Contact" — confirm both existing pages render normally for this role.

- [ ] **Step 3: Permission boundary checks**

While logged in as the Directeur:

1. Navigate directly to `/admin` — expect an immediate redirect away (not an error page, not admin content).
2. Navigate directly to `/dashboard`, `/leaderboard`, `/badges`, `/statistiques` — expect a redirect to `/directeur`.
3. Confirm no page anywhere under `/directeur/*` renders a `<form>` that posts to a mutating server action (buy/sell/edit/delete) — a quick way to check: `Select-String -Path "src\app\directeur\**\*.tsx" -Pattern "action="` (PowerShell) should show no matches, since every page in this tree is read-only.

While logged in as an existing `ADMIN` account:

4. Navigate to `/directeur` — expect a redirect to `/admin` (not the Directeur home).

While logged in as an existing `PARTICIPANT` account:

5. Confirm `/dashboard`, `/leaderboard`, `/badges`, `/statistiques` still work exactly as before (this is the regression check for Tasks 7, 13, 14).
6. Navigate to `/directeur` — expect a redirect to `/dashboard`.

- [ ] **Step 4: Report results**

Note any visual or behavioral drift found during Step 2 (compare against the participant-facing pages side by side) and fix before considering this plan complete. No commit for this task — it's verification, not a code change.
