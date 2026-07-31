# Concours de portefeuille Makor

Plateforme web interne remplaçant l'ancien Google Sheets / Apps Script pour le concours de
gestion de portefeuille des stagiaires Makor. Voir [docs/CONCEPTION.md](docs/CONCEPTION.md)
pour l'architecture complète, le modèle de données et le règlement.

État actuel : **phases 1 à 6 livrées** (roadmap initial complet).

- Phase 1 — fondations : auth Google SSO, modèle de données, admin CRUD, ingestion des prix
- Phase 2 — moteur de règles de trading (achats/ventes/renforcements), sessions de changement
- Phase 3 — performance snapshots, graphique et historique des transactions
- Phase 4 — classement en temps réel, système de badges
- Phase 5 — Hall of Fame, notifications, connexion de démonstration
- Phase 6 — identité visuelle premium (dark mode, TradingView/Robinhood), vérification de charge

Prochaines pistes possibles (non planifiées) : hall of fame étendu (heatmap sectorielle,
positions les plus populaires), notifications par email, tests E2E automatisés.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) ·
Recharts · PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) · Auth.js v5 (Google SSO) ·
Vitest.

## Prérequis

- Node.js 20.9+ (voir `node -v`)
- Docker (pour Postgres en local)

## Démarrage

```bash
docker compose up -d          # Postgres local (port 5432)
npm install
cp .env.example .env          # puis remplir les variables (voir ci-dessous)
npx prisma migrate dev        # applique le schéma + génère le client Prisma
npm run db:seed               # données de démonstration (voir section dédiée)
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
- **`ENABLE_DEV_LOGIN`** : voir section "Connexion de démonstration" ci-dessous. Ne jamais
  activer en production (une double garde l'en empêche de toute façon).
- **`TWELVE_DATA_API_KEY`** : optionnel. Sans clé, les prix actions/ETF utilisent un provider
  mock déterministe (voir `src/lib/prices/providers`) — la crypto utilise toujours CoinGecko,
  qui ne nécessite pas de clé.
- **`CRON_SECRET`** : protège les routes `/api/cron/*`. Laisser vide en local.

## Connexion de démonstration (dev uniquement)

Sans identifiants Google OAuth réels, impossible de se connecter via le flux normal. Pour
explorer la plateforme en local :

1. `ENABLE_DEV_LOGIN="true"` dans `.env` (déjà fait si vous avez copié `.env.example` puis modifié
   cette ligne — elle vaut `"false"` par défaut dans le template).
2. `npm run db:seed` pour créer les comptes de démonstration.
3. Sur `/login`, une section "Mode démonstration" liste les comptes seedés (1 admin, 3
   participants) — cliquer dessus crée une vraie session DB, sans passer par Google.

Cette fonctionnalité est gardée par une double condition (`NODE_ENV !== "production"` **et**
`ENABLE_DEV_LOGIN === "true"`) codée en dur dans `src/lib/dev-login-constants.ts` — elle ne peut
pas s'activer accidentellement en production même si la variable d'environnement y était définie
par erreur.

## Données de démonstration (`npm run db:seed`)

`prisma/seed.ts` crée (et nettoie/recrée si rejoué) :

- une promotion active avec 3 participants (profils volontairement différents : pari concentré,
  portefeuille diversifié, position en perte) pour illustrer les badges et le classement,
- un univers de 6 actifs avec prix,
- une session de changement ouverte,
- un historique de `PerformanceSnapshot` sur 10 jours,
- une saison passée déjà clôturée, pour peupler le Hall of Fame dès le premier seed.

## Ajouter un premier admin / participant réel

Les comptes réels sont créés au premier login Google. Pour se donner le rôle admin en local,
ajouter son email dans `ADMIN_EMAILS` avant de se connecter. Un admin peut ensuite inviter des
participants par email depuis `/admin/participants` (le compte est pré-provisionné et se lie
automatiquement à leur première connexion Google).

## Scripts

```bash
npm run dev      # serveur de développement (Turbopack)
npm run build    # build de production
npm run lint     # ESLint
npm test         # Vitest (tests unitaires)
npm run db:seed  # données de démonstration (rejouable)
```

## Tests

98 tests unitaires (Vitest) couvrent la logique métier critique en TDD :

- moteur de règles de trading (`src/lib/trading/rules-engine.test.ts`) : taille de position,
  quota de changements, gel avant la fin, plafond crypto, capital disponible
- exécution des ordres, snapshots de performance, classement, critères de badges, Hall of Fame,
  notifications de fermeture de session — chacun avec le service DB mocké (`vi.mock("@/lib/db")`)
- schémas de validation Zod des formulaires admin

Les scénarios de bout en bout contre la vraie base Postgres (achat → renforcement → vente,
classement, badges, Hall of Fame) sont vérifiés ponctuellement pendant le développement puis
retirés — pas encore d'infrastructure CI avec Postgres dédié pour les garder dans `npm test`.

## Sécurité — risque accepté

`npm audit` signale une vulnérabilité DoS dans `brace-expansion` (via `minimatch@3.1.5`, utilisé
uniquement par la chaîne de résolution de config d'ESLint). C'est un risque **dev-only** : le
correctif casse la compatibilité avec `eslint-config-next` pour Next 16 sans bénéfice réel ici
(aucune entrée attaquant ne traverse ce chemin). Réévaluer lors de la prochaine mise à jour
majeure d'`eslint-config-next`.

## Structure

```
src/
  app/
    login/, dashboard/, leaderboard/, hall-of-fame/, admin/*, api/*
  auth.ts         # config Auth.js (Google SSO, Prisma adapter)
  proxy.ts        # garde d'accès (ex-middleware.ts) — protection optimiste des routes
  lib/
    db.ts         # client Prisma (driver adapter Postgres)
    dal.ts        # Data Access Layer — vérifications de session/rôle côté serveur
    audit.ts      # journalisation des actions admin
    promotion-rules.ts
    dev-login-constants.ts
    portfolio-provisioning.ts
    prices/       # ingestion de prix, providers interchangeables
    trading/      # rules-engine, execute-order, snapshots, historique
    gamification/ # classement, badges, Hall of Fame
prisma/
  schema.prisma
  seed.ts         # npm run db:seed
docker-compose.yml
vercel.json       # crons (ingestion des prix, snapshot quotidien + badges)
docs/CONCEPTION.md  # document de conception complet
```
