# Concours de portefeuille Makor

Plateforme web interne pour le concours de gestion de portefeuille des stagiaires Makor —
identifiant/mot de passe géré par l'administrateur (pas d'OAuth, pas d'email requis),
recherche de tickers en direct (actions, crypto), rafraîchissement automatique des prix,
classement et badges. Conçue pour être **reprise sans effort par un futur stagiaire** à chaque
nouvelle promotion : voir la section [Transmission du projet](#transmission-du-projet) ci-dessous.

Documents complémentaires :
- [docs/CONCEPTION.md](docs/CONCEPTION.md) — document de conception d'origine (modèle de
  données, game design, raisonnement). Certains choix y ont depuis évolué ; voir la note en tête
  de ce document.
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — déployer la plateforme en production (Vercel + Neon).
- [docs/ADMINISTRATION.md](docs/ADMINISTRATION.md) — créer un concours, gérer les participants,
  modifier le règlement, restreindre l'univers d'actifs.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) ·
Recharts · PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) · Vitest.

Authentification maison (identifiant/mot de passe, sessions en base) — pas de dépendance à un
fournisseur d'identité externe. Données de marché : Twelve Data (actions) + CoinGecko
(crypto), toutes deux gratuites.

## Prérequis

- Node.js 20.9+ (voir `node -v`)
- Docker (pour Postgres en local)

## Démarrage local

```bash
docker compose up -d          # Postgres local (port 5432)
npm install
cp .env.example .env          # puis remplir les variables si besoin (voir ci-dessous)
npx prisma migrate deploy     # applique toutes les migrations
npx prisma generate           # génère le client Prisma
npm run db:seed               # crée le compte admin par défaut (Makor / makor2023)
npm run dev
```

L'app tourne sur http://localhost:3000. Connectez-vous avec l'identifiant **Makor** et le mot de
passe **makor2023**, puis changez ce mot de passe dès la première connexion (voir
[docs/ADMINISTRATION.md](docs/ADMINISTRATION.md)).

Pour explorer l'interface avec des données réalistes (promotion active, participants, positions,
historique de performance, saison passée pour le Hall of Fame) :

```bash
npm run db:seed:demo
```

Ce seed est **dev/démo uniquement** — ne jamais le lancer en production (il crée des comptes
`demo1234` prévisibles). `npm run db:seed` (sans `:demo`) est le seul seed sûr en production :
idempotent, crée uniquement le compte admin par défaut s'il n'existe pas déjà.

## Variables d'environnement

Voir `.env.example` pour la liste complète.

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | Oui | Connexion Postgres. Déjà configurée pour le `docker-compose.yml` local. En production, pointer vers Neon (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)). |
| `TWELVE_DATA_API_KEY` | Non | Sans clé, les prix et la recherche d'actions utilisent un provider mock déterministe (`src/lib/prices/providers/mock-provider.ts`) et Twelve Data en mode non-authentifié (limité). Avec une clé gratuite ([twelvedata.com](https://twelvedata.com)), l'ingestion et la recherche sont fiables. La crypto (CoinGecko) ne nécessite jamais de clé. |
| `CRON_SECRET` | Non (recommandé en prod) | Protège les routes `/api/cron/*` — Vercel l'envoie automatiquement en `Authorization: Bearer <valeur>` si défini dans les deux endroits. Laisser vide en local. |

Aucune autre variable n'est nécessaire : il n'y a plus de fournisseur OAuth, plus de secret de
session à générer — les sessions sont des lignes en base, identifiées par un cookie httpOnly
opaque (`src/lib/auth/session.ts`).

## Authentification

Identifiant (format "Prénom Nom") + mot de passe, choisis par l'administrateur à la création du
compte — jamais d'auto-inscription. C'est ce qui garantit qu'un stagiaire qui quitte Makor ne
peut plus jamais se reconnecter à un futur concours : il suffit que l'admin ne le réinscrive pas
dans la nouvelle promotion (voir [docs/ADMINISTRATION.md](docs/ADMINISTRATION.md)).

Un compte administrateur par défaut existe après `npm run db:seed` : identifiant `Makor`, mot de
passe `makor2023`. À changer immédiatement depuis `/admin/participants` une fois connecté.

## Scripts

```bash
npm run dev           # serveur de développement (Turbopack)
npm run build         # build de production
npm run start         # démarre le build de production
npm run lint          # ESLint
npm test              # Vitest (tests unitaires)
npm run db:seed       # compte admin par défaut — sûr en production, idempotent
npm run db:seed:demo  # données de démonstration complètes — dev/local uniquement
```

## Tests

Tests unitaires Vitest (`npm test`) couvrant la logique métier critique :

- moteur de règles de trading (`src/lib/trading/rules-engine.test.ts`) : taille de position,
  quota de changements, gel avant la fin, plafond crypto, capital disponible
- exécution des ordres, snapshots de performance, classement (rang, meilleure/pire position),
  critères de badges, Hall of Fame, notifications de fermeture de session
- cache pull-through des prix (`src/lib/prices/pull-through.test.ts`), création dynamique
  d'actifs à l'achat (`src/lib/assets/ensure-asset.test.ts`), recherche de tickers
  (`src/lib/assets/search-providers.test.ts`)
- schémas de validation Zod des formulaires admin et participant

Chaque service DB est mocké (`vi.mock("@/lib/db")`) — les tests n'ont pas besoin d'une base
Postgres pour s'exécuter.

## Recherche de tickers et rafraîchissement des prix

Les participants recherchent n'importe quel ticker action (Twelve Data) ou crypto
(CoinGecko) directement dans le formulaire d'achat — aucune liste d'actifs pré-créée par
l'admin n'est nécessaire. L'actif est créé automatiquement en base au premier achat
(`src/lib/assets/ensure-asset.ts`). Seules les actions et les cryptomonnaies sont
investissables : les ETF sont exclus de la recherche par construction (voir
`src/lib/assets/search-providers.ts`).

### Fraîcheur des prix

Les prix se rafraîchissent en "pull-through" : à chaque affichage d'une page qui montre un prix
(dashboard, classement, statistiques), les actifs dont le dernier prix connu est périmé sont
rafraîchis à la demande, en parallèle, avant l'affichage (`src/lib/prices/pull-through.ts`). Un
prix encore frais n'est jamais redemandé au fournisseur. Le seuil de péremption dépend du type
d'actif (`src/lib/prices/staleness.ts`) :

- **Crypto** : 10 secondes — via **Binance** (marché public, sans clé, sans quota
  significatif). Le règlement n'autorisant qu'une seule cryptomonnaie active à la fois
  (`docs/CONCEPTION.md` section 6), la fraîcheur est quasi temps réel sans aucun risque de
  quota. CoinGecko reste utilisé uniquement pour la *recherche* de tickers crypto (nom, logo,
  rang par capitalisation), pas pour le prix.
- **Actions** : 10 minutes — via **Twelve Data** (gratuit : 8 requêtes/min, 800/jour). Ce seuil
  suppose environ 5 actions suivies en continu sur toute une journée ; au-delà, remonter la
  constante `STOCK_PRICE_STALE_MS` ou passer sur une clé Twelve Data payante.

Le cron `/api/cron/ingest-prices` sert de filet de sécurité pour les actifs que personne ne
consulte : il applique le même seuil de péremption (voir `src/lib/prices/ingest.ts`), donc la
plupart de ses exécutions ne coûtent aucun appel fournisseur (actif déjà frais → ignoré). C'est
ce qui permet de le déclencher bien plus souvent qu'une fois par jour sans jamais dépasser les
quotas gratuits. Le plan Vercel Hobby ne permet qu'une exécution de cron par jour
(`vercel.json`, conservé comme filet de secours) : la fréquence réelle vient d'un workflow
**GitHub Actions** qui l'appelle toutes les 5 minutes
(`.github/workflows/ingest-prices.yml`) — gratuit, ne nécessite aucun hébergement
supplémentaire. Secrets requis sur le dépôt GitHub (Settings → Secrets and variables →
Actions) : `APP_URL` (URL de déploiement) et `CRON_SECRET` (identique à la variable
d'environnement Vercel du même nom).

Côté navigateur, le dashboard, le classement et les statistiques se rafraîchissent eux-mêmes
toutes les 10 secondes (`src/components/auto-refresh.tsx`, en pause quand l'onglet n'est pas
visible) — prix, valeur des positions, P&L, classement et graphiques se mettent donc à jour
automatiquement à l'écran dès qu'un prix plus récent existe en base, sans que le participant
ait besoin de recharger la page.

**Ce qui n'est donc *pas* du vrai temps réel seconde par seconde :** les actions, par
construction du quota gratuit Twelve Data (voir ci-dessus). Un vrai flux temps réel pour les
actions existe gratuitement (WebSocket Finnhub, jusqu'à 50 symboles) mais nécessiterait une
connexion persistante que l'hébergement serverless Vercel Hobby ne peut pas maintenir — hors
scope volontairement pour ne pas complexifier la transmission du projet (voir section
suivante).

L'administrateur garde la main sur l'univers investissable : désactiver un actif depuis
`/admin/assets` empêche tout nouvel achat dessus (les positions déjà ouvertes ne sont pas
affectées).

## Transmission du projet

Ce projet est fait pour être repris par un stagiaire qui n'a jamais touché le code :

- **Architecture centralisée** : toute la logique de règles de trading vit dans
  `src/lib/trading/rules-engine.ts`, jamais dupliquée côté UI. Les prix vivent dans
  `src/lib/prices/`, la recherche de tickers dans `src/lib/assets/`.
- **Aucune dépendance à un fournisseur d'identité externe** ni à un ordinateur ou serveur
  personnel — hébergement Vercel + Neon, entièrement gratuit à cette échelle (voir
  [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)).
- **Configuration minimale** : deux variables d'environnement suffisent pour un déploiement
  fonctionnel (`DATABASE_URL`, et éventuellement `TWELVE_DATA_API_KEY`).
- **Tests comme documentation vivante** : chaque service critique a ses tests, qui montrent le
  comportement attendu mieux qu'un long texte.

## Structure

```
src/
  app/
    login/            # authentification identifiant/mot de passe
    dashboard/         # portefeuille participant, achat, positions
    leaderboard/       # classement, graphique comparatif multi-participants
    hall-of-fame/      # vainqueurs des saisons passées
    admin/             # promotions, participants, univers d'actifs
    api/
      assets/search/   # recherche de tickers (Twelve Data + CoinGecko)
      cron/            # ingestion des prix, snapshot quotidien + badges
  proxy.ts             # garde d'accès (ex-middleware.ts) — protection des routes
  lib/
    auth/              # session.ts (cookie + table Session), password.ts (bcrypt)
    dal.ts             # Data Access Layer — vérifications de session/rôle côté serveur
    db.ts              # client Prisma (driver adapter Postgres)
    audit.ts           # journalisation des actions admin
    promotion-rules.ts
    assets/            # ensure-asset.ts (création dynamique), search-providers.ts
    prices/            # pull-through.ts (cache), ingest.ts (cron), providers/
    trading/           # rules-engine, execute-order, snapshots, historique
    gamification/      # classement, badges, Hall of Fame
prisma/
  schema.prisma
  seed-admin.ts        # npm run db:seed — sûr en production
  seed-demo.ts         # npm run db:seed:demo — dev/local uniquement
docker-compose.yml     # Postgres local
vercel.json            # crons quotidiens (ingestion des prix, snapshot + badges)
docs/
  CONCEPTION.md        # document de conception d'origine
  DEPLOIEMENT.md       # guide de déploiement Vercel + Neon
  ADMINISTRATION.md    # guide admin : concours, participants, règlement, univers
```
