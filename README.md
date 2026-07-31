# Concours de portefeuille Makor

Plateforme web interne remplaçant l'ancien Google Sheets / Apps Script pour le concours de
gestion de portefeuille des stagiaires Makor. Voir [docs/CONCEPTION.md](docs/CONCEPTION.md)
pour l'architecture complète, le modèle de données et le règlement.

État actuel : **Phase 1 — fondations** (auth, modèle de données, admin CRUD, ingestion des prix).
Le moteur de règles de trading (achats/ventes) arrive en phase 2.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) ·
PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) · Auth.js v5 (Google SSO) · Vitest.

## Prérequis

- Node.js 20.9+ (voir `node -v`)
- Docker (pour Postgres en local)

## Démarrage

```bash
docker compose up -d          # Postgres local (port 5432)
npm install
cp .env.example .env          # puis remplir les variables (voir ci-dessous)
npx prisma migrate dev        # applique le schéma + génère le client Prisma
npm run dev
```

L'app tourne sur http://localhost:3000.

## Variables d'environnement

Voir `.env.example` pour la liste complète. Points d'attention :

- **`DATABASE_URL`** : déjà configuré pour le Postgres du `docker-compose.yml` local. En
  production, pointer vers Supabase/Neon (voir docs/CONCEPTION.md section 3.2).
- **`AUTH_SECRET`** : générer avec `npx auth secret` ou `openssl rand -base64 32`.
- **`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`** : créer un OAuth Client ID sur
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials), type
  "Application Web", redirect URI `http://localhost:3000/api/auth/callback/google` (et
  l'équivalent en production).
- **`AUTH_GOOGLE_HD`** : restreint la connexion à un domaine Google Workspace donné (ex.
  `makorgroup.com`). Laisser vide pour autoriser n'importe quel compte Google pendant les tests.
- **`ADMIN_EMAILS`** : emails (séparés par des virgules) qui reçoivent le rôle `ADMIN` à leur
  première connexion.
- **`TWELVE_DATA_API_KEY`** : optionnel. Sans clé, les prix actions/ETF utilisent un provider
  mock déterministe (voir `src/lib/prices/providers`) — la crypto utilise toujours CoinGecko,
  qui ne nécessite pas de clé.
- **`CRON_SECRET`** : protège `/api/cron/ingest-prices`. Laisser vide en local.

## Ajouter un premier admin / participant

Les comptes sont créés au premier login Google. Pour se donner le rôle admin en local, ajouter
son email dans `ADMIN_EMAILS` avant de se connecter. Un admin peut ensuite inviter des
participants par email depuis `/admin/participants` (le compte est pré-provisionné et se lie
automatiquement à leur première connexion Google).

## Scripts

```bash
npm run dev      # serveur de développement (Turbopack)
npm run build    # build de production
npm run lint     # ESLint
npm test         # Vitest (tests unitaires)
```

## Tests

Les tests couvrent le moteur d'ingestion des prix (`src/lib/prices/ingest.test.ts`, providers
injectés en mock) et les schémas de validation Zod des formulaires admin. Les Server Actions et
composants React ne sont pas encore couverts par des tests automatisés — le règlement complet
d'achat/vente (phase 2) sera développé en TDD dès le départ.

## Sécurité — risque accepté

`npm audit` signale une vulnérabilité DoS dans `brace-expansion` (via `minimatch@3.1.5`, utilisé
uniquement par la chaîne de résolution de config d'ESLint). C'est un risque **dev-only** : le
correctif casse la compatibilité avec `eslint-config-next` pour Next 16 sans bénéfice réel ici
(aucune entrée attaquant ne traverse ce chemin). Réévaluer lors de la prochaine mise à jour
majeure d'`eslint-config-next`.

## Structure

```
src/
  app/            # routes App Router (login, dashboard, admin/*, api/*)
  auth.ts         # config Auth.js (Google SSO, Prisma adapter)
  proxy.ts        # garde d'accès (ex-middleware.ts) — protection optimiste des routes
  lib/
    db.ts         # client Prisma (driver adapter Postgres)
    dal.ts        # Data Access Layer — vérifications de session/rôle côté serveur
    audit.ts       # journalisation des actions admin
    promotion-rules.ts
    prices/       # ingestion de prix, providers interchangeables
prisma/schema.prisma
docker-compose.yml
docs/CONCEPTION.md  # document de conception complet
```
