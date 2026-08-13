# Déploiement — Vercel + Supabase

Architecture retenue : **Vercel** (hébergement Next.js, gratuit sur le plan Hobby) + **Supabase**
(PostgreSQL managé, gratuit sur le plan Free). Aucune carte bancaire n'est requise pour ces deux
plans à cette échelle (une trentaine d'utilisateurs par promotion).

**Historique** : le projet a démarré sur Neon plutôt que Supabase, précisément pour éviter le
défaut de Supabase décrit plus bas (pause après inactivité). En pratique, Neon s'est révélé plus
risqué pour un usage continu : son plan gratuit impose un plafond mensuel dur (heures de calcul /
transfert de données) qui, une fois atteint, **met le projet en pause de force** jusqu'au
renouvellement mensuel ou à un upgrade payant — sans marge de manœuvre gratuite pour repartir
immédiatement. Ça s'est produit en plein concours actif, coupant l'accès à tous les participants
sans avertissement préalable. Le projet est donc repassé sur Supabase : son seul vrai défaut
(pause après 7 jours d'inactivité, réactivable en un clic depuis le dashboard, sans dépendre d'un
plafond d'usage cumulé) est sans risque pour un concours actif consulté en continu, et largement
préférable à un mur dur payant en cours de saison.

**Incident du 2026-08-13** : le quota gratuit d'egress Supabase (5 Go/mois) a fini par être
dépassé, plaçant l'organisation en grace period jusqu'au 15 août. Cause racine identifiée : la
page `/leaderboard` retransmettait la photo de profil (base64) de **tous** les participants à
chaque exécution, et `AutoRefresh` (`src/components/auto-refresh.tsx`) rafraîchissait cette page
toutes les 60s — un fan-out qui dominait largement l'egress, bien plus que la fréquence de poll
en elle-même. Corrigé côté code en plusieurs passes le même jour :

- `get-leaderboard.ts` ne récupère plus l'avatar que pour le podium (top 3, indépendant du nombre
  de participants) au lieu de tous.
- **Découverte d'un second trou** : `AutoRefresh` ne protège que le rafraîchissement automatique —
  un rechargement manuel (F5), un premier chargement ou une navigation ré-exécutaient toutes les
  requêtes Supabase sans aucune limite, contournant entièrement l'intervalle de poll. Corrigé en
  enveloppant les requêtes des 4 pages les plus visitées (leaderboard, dashboard, badges,
  statistiques — `get-leaderboard.ts`, `portfolio-view.ts`, `get-contest-stats.ts`,
  `get-personal-records.ts`, `get-participant-stats.ts`, `get-promotion-performance-series.ts`)
  dans `unstable_cache`, un cache serveur **partagé entre tous les participants et toutes les
  requêtes**, pas seulement par utilisateur. Ses actions restent instantanées pour l'auteur grâce à
  `updateTag` appelé à chaque point de mutation (trades participant dans `dashboard/actions.ts`,
  corrections admin dans `admin/portfolios/[portfolioId]/actions.ts` et
  `admin/promotions/[id]/actions.ts`, changement d'avatar dans `profil/actions.ts`) — la fenêtre de
  cache n'est donc plus qu'un filet de sécurité pour les changements passifs (évolution des prix),
  jamais un facteur de latence sur ses propres actions.
- Le cron GitHub Actions d'ingestion des prix est passé de 5 à 15 min.
- Une fois le cache serveur en place, l'intervalle d'`AutoRefresh` et les 6 fenêtres
  `unstable_cache` ont été unifiés à **15 min partout** : rien de plus court n'apporte de fraîcheur
  réelle, les prix ne changeant de toute façon jamais plus vite que `STOCK_PRICE_STALE_MS` (voir
  `staleness.ts`).

Résultat : l'egress ne dépend plus ni de la fréquence de poll ni du comportement des
participants (rafraîchissement manuel compris) — plafond dur d'environ une requête Supabase réelle
toutes les 15 min par promotion, quel que soit le trafic.

Comme la mécanique exacte de fin de grace period n'est pas entièrement documentée par Supabase
(voir discussions GitHub officielles sur le sujet), et par prudence pour un concours encore actif,
le projet a aussi été migré vers une **nouvelle organisation Supabase** (quota gratuit totalement
indépendant de celle restreinte, les quotas Supabase sont par organisation et non par compte) en
région **Paris (`eu-west-3`)** — via `pg_dump`/`pg_restore` du schéma + données, puis changement de
`DATABASE_URL`/`DIRECT_URL` sur le même projet Vercel (même URL pour les participants, aucune
interruption). L'ancienne organisation Supabase restreinte n'est plus utilisée et peut être
ignorée ou supprimée.

## 1. Créer la base de données (Supabase)

1. Créer un compte sur [supabase.com](https://supabase.com) (gratuit, pas de carte bancaire —
   une adresse email suffit).
2. Créer un nouveau projet — nommez-le par exemple `makor-portfolio-contest`, choisissez une
   région proche des utilisateurs (ex. `eu-west-3` pour la France, `eu-west-1` pour l'Europe en
   général — le projet actuel tourne sur `eu-west-3` depuis l'incident du 2026-08-13 ci-dessus).
3. **Décocher** les options suivantes à la création — aucune n'est utilisée par ce projet, qui se
   connecte directement en Postgres via Prisma et n'utilise jamais l'API publique ni
   l'authentification Supabase (auth maison, voir `src/lib/auth/`) :
   - **Enable Data API** (API REST publique inutile ici)
   - **Automatically expose new tables**
   - **Enable automatic RLS**
4. Une fois le projet créé, dans **Project Settings → Database**, récupérer les deux chaînes de
   connexion (bouton **"Connect"** en haut du dashboard, onglet **ORM → Prisma** donne les deux
   directement formatées) :
   - le pooler **"Transaction mode"** (port `6543`, `?pgbouncer=true`) → variable `DATABASE_URL`
   - le pooler **"Session mode"** (port `5432`) → variable `DIRECT_URL`

   Le mot de passe de la base n'est affiché qu'une seule fois (à la création, ou après un clic
   sur "Reset database password" dans Database Settings) — le noter immédiatement.

   **Attention aux caractères spéciaux** : si le mot de passe contient `@`, `/`, `:` ou autre
   caractère réservé d'URL, il faut l'encoder (`@` → `%40`, etc.) dans les deux chaînes de
   connexion, sinon la connexion échoue silencieusement (le caractère casse le parsing de l'URL).

## 2. Déployer sur Vercel

1. Pousser le dépôt sur GitHub (ou GitLab/Bitbucket).
2. Sur [vercel.com](https://vercel.com), **Add New → Project**, importer le dépôt.
3. Vercel détecte automatiquement Next.js — ne rien changer aux réglages de build.
4. Dans **Environment Variables**, ajouter :
   - `DATABASE_URL` = la chaîne de connexion **Transaction pooler** Supabase (port 6543) —
     utilisée par l'app en fonctionnement (voir `src/lib/db.ts`)
   - `DIRECT_URL` = la chaîne de connexion **Session pooler** Supabase (port 5432) — utilisée
     uniquement par `prisma migrate deploy` au build (voir `prisma.config.ts`). Le pooler
     "transaction mode" de Supabase (PgBouncer) ne supporte pas fiablement les opérations DDL
     des migrations, d'où la nécessité de cette seconde URL, distincte de celle utilisée à
     l'exécution.
   - `TWELVE_DATA_API_KEY` = votre clé gratuite [twelvedata.com](https://twelvedata.com) (optionnel,
     mais recommandé pour une recherche de tickers et des prix fiables en production)
   - `CRON_SECRET` = une valeur aléatoire de votre choix (ex. générée avec
     `openssl rand -base64 32`) — protège les routes `/api/cron/*` contre des appels externes
     non autorisés
5. **Deploy**. Le premier déploiement échouera si la base est vide — c'est normal, on applique
   le schéma à l'étape suivante.

> **Note** : le blocage `P1002` (verrou advisory Postgres bloqué) déjà documenté par le passé sur
> ce projet était spécifique à l'interaction entre PgBouncer et Neon — il ne s'est pas reproduit
> depuis le passage à Supabase. Si un verrou advisory bloquait malgré tout un déploiement futur
> (erreur Prisma `P1002`), la même méthode de résolution s'applique : se connecter à la base (avec
> `DIRECT_URL`), trouver la session bloquante (`select * from pg_locks where locktype =
> 'advisory'`), et la terminer (`select pg_terminate_backend(<pid>)`) — ça ne touche aucune donnée.

## 3. Appliquer le schéma et créer le compte admin

Depuis votre machine locale, avec `DATABASE_URL` et `DIRECT_URL` pointées temporairement vers
Supabase :

```bash
DATABASE_URL="<transaction pooler>" DIRECT_URL="<session pooler>" npx prisma migrate deploy
DATABASE_URL="<transaction pooler>" DIRECT_URL="<session pooler>" npm run db:seed
```

La deuxième commande crée le compte administrateur par défaut (`Makor` / `makor2023`) — sûre à
relancer, elle ne fait rien si le compte existe déjà. **Ne jamais lancer `npm run db:seed:demo`
contre la base de production** : il crée des comptes de démonstration avec un mot de passe
prévisible.

Redéployer sur Vercel (ou simplement re-déclencher le build) une fois le schéma appliqué.

## 4. Les crons planifiés

`vercel.json` déclare deux crons, tous deux compatibles avec le plan Hobby (limité à une
exécution par jour et par cron) :

```json
{
  "crons": [
    { "path": "/api/cron/ingest-prices", "schedule": "0 21 * * *" },
    { "path": "/api/cron/snapshot-portfolios", "schedule": "0 22 * * *" }
  ]
}
```

Vercel les active automatiquement au déploiement — rien à configurer côté dashboard. Le premier
rafraîchit une dernière fois tous les prix avant que le second calcule l'historique de
performance du jour (classement, badges). Voir la section "Recherche de tickers et
rafraîchissement des prix" du README pour le détail du cache pull-through qui garde les prix à
jour le reste de la journée sans dépendre de ces crons.

Si `CRON_SECRET` est défini sur Vercel, celui-ci est automatiquement envoyé en
`Authorization: Bearer <valeur>` par l'infrastructure de cron de Vercel — aucune configuration
supplémentaire n'est nécessaire.

Un rafraîchissement plus fréquent (`.github/workflows/ingest-prices.yml`, toutes les 15 minutes —
même cadence que le reste de l'app depuis l'incident du 2026-08-13 ci-dessus) tourne en parallèle
via GitHub Actions — voir ce fichier pour les secrets requis (`APP_URL`, `CRON_SECRET`).

## 5. Domaine

Le domaine `<projet>.vercel.app` fourni par défaut est utilisable tel quel — c'est l'URL simple,
accessible depuis n'importe quel navigateur, que les stagiaires utiliseront. Un domaine
personnalisé (ex. `concours.makorgroup.com`) peut être ajouté depuis **Project Settings →
Domains** si souhaité, sans configuration supplémentaire côté application.

## 6. Préparer une nouvelle promotion

Une fois déployé, voir [ADMINISTRATION.md](ADMINISTRATION.md) pour créer un concours, ajouter les
participants de la nouvelle promotion, et transmettre les identifiants.

## Reprise par un futur stagiaire

Toute la configuration nécessaire au redéploiement tient dans les quatre variables
d'environnement listées à l'étape 2. Aucun accès à un compte Google, aucune clé secrète héritée
d'un stagiaire précédent : un nouveau compte Vercel + Supabase (gratuits) suffit pour repartir de
zéro sur un déploiement entièrement neuf.

**Surveiller les limites du plan gratuit Supabase** (500 Mo de base, 5 Go de transfert/mois au
moment de l'écriture — à vérifier sur supabase.com, ces chiffres évoluent) pour éviter de revivre
l'incident du 2026-08-13 décrit plus haut, qui a nécessité une migration en urgence. Les
mitigations déjà en place (fan-out d'avatars limité au podium dans `get-leaderboard.ts`, cache
serveur partagé `unstable_cache` sur les 4 pages les plus visitées, intervalle `AutoRefresh` et
cron d'ingestion unifiés à 15 min) devraient largement suffire pour cette échelle de concours (~10
participants) — si l'usage remonte malgré tout près du quota, créer une nouvelle organisation
Supabase (quota gratuit indépendant, voir procédure de l'incident) est un levier de secours rapide,
avant d'envisager un plan payant. Si ce projet grossit significativement (beaucoup plus de 30
participants, plusieurs promotions actives en parallèle), reposer la question de l'hébergement
auprès de l'entreprise plutôt que de dépendre indéfiniment d'un plan gratuit personnel.
