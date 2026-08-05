# Déploiement — Vercel + Neon

Architecture retenue : **Vercel** (hébergement Next.js, gratuit sur le plan Hobby) + **Neon**
(PostgreSQL serverless, gratuit sur le plan Free). Aucune carte bancaire n'est requise pour ces
deux plans à cette échelle (une trentaine d'utilisateurs par promotion).

Pourquoi Neon plutôt que Supabase : les deux offrent un plan Postgres gratuit, mais Supabase met
en pause un projet inactif après 7 jours et nécessite une réactivation manuelle depuis le
dashboard — problématique pour un outil utilisé intensément pendant un concours puis totalement
dormant entre deux promotions. Neon scale-to-zero automatiquement (juste un léger délai de
réveil sur la première requête après une pause), sans jamais nécessiter d'intervention manuelle.

## 1. Créer la base de données (Neon)

1. Créer un compte sur [neon.tech](https://neon.tech) (gratuit, pas de carte bancaire).
2. Créer un nouveau projet — nommez-le par exemple `makor-portfolio-contest`.
3. Dans l'onglet **Connection Details**, copier la chaîne de connexion (`postgresql://...`).
   Utiliser la variante **pooled connection** (recommandée par Neon pour les environnements
   serverless comme Vercel).

## 2. Déployer sur Vercel

1. Pousser le dépôt sur GitHub (ou GitLab/Bitbucket).
2. Sur [vercel.com](https://vercel.com), **Add New → Project**, importer le dépôt.
3. Vercel détecte automatiquement Next.js — ne rien changer aux réglages de build.
4. Dans **Environment Variables**, ajouter :
   - `DATABASE_URL` = la chaîne de connexion **pooled** Neon (celle avec `-pooler` dans le nom
     d'hôte) copiée à l'étape précédente — utilisée à la fois par l'application en runtime et par
     `prisma migrate deploy` au build (voir note ci-dessous)
   - `TWELVE_DATA_API_KEY` = votre clé gratuite [twelvedata.com](https://twelvedata.com) (optionnel,
     mais recommandé pour une recherche de tickers et des prix fiables en production)
   - `CRON_SECRET` = une valeur aléatoire de votre choix (ex. générée avec
     `openssl rand -base64 32`) — protège les routes `/api/cron/*` contre des appels externes
     non autorisés
5. **Deploy**. Le premier déploiement échouera si la base est vide — c'est normal, on applique
   le schéma à l'étape suivante.

> **Note** : `prisma migrate deploy` prend un verrou Postgres (advisory lock) le temps de la
> migration. Ce verrou est attaché à la connexion, pas à la commande — si un build est interrompu
> avant que la migration se termine (crash, timeout), la connexion peut être recyclée par le
> pooler PgBouncer de Neon sans que le verrou soit relâché, et bloquer tous les déploiements
> suivants avec une erreur `P1002` (timeout d'acquisition de verrou). Passer par la connexion
> **directe** Neon (sans `-pooler`) pour la migration semble la solution logique, mais ne
> fonctionne pas de manière fiable depuis les serveurs de build Vercel (erreur `P1001`, connexion
> injoignable — limitation réseau connue, pas un bug ici). Si `P1002` se reproduit : se connecter à
> la base (`DATABASE_URL`), trouver la session bloquante (`select * from pg_locks where locktype =
> 'advisory'`), et la terminer (`select pg_terminate_backend(<pid>)`) — ça ne touche aucune donnée.

## 3. Appliquer le schéma et créer le compte admin

Depuis votre machine locale, avec `DATABASE_URL` pointée temporairement vers Neon :

```bash
DATABASE_URL="<chaîne de connexion Neon>" npx prisma migrate deploy
DATABASE_URL="<chaîne de connexion Neon>" npm run db:seed
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

## 5. Domaine

Le domaine `<projet>.vercel.app` fourni par défaut est utilisable tel quel — c'est l'URL simple,
accessible depuis n'importe quel navigateur, que les stagiaires utiliseront. Un domaine
personnalisé (ex. `concours.makorgroup.com`) peut être ajouté depuis **Project Settings →
Domains** si souhaité, sans configuration supplémentaire côté application.

## 6. Préparer une nouvelle promotion

Une fois déployé, voir [ADMINISTRATION.md](ADMINISTRATION.md) pour créer un concours, ajouter les
participants de la nouvelle promotion, et transmettre les identifiants.

## Reprise par un futur stagiaire

Toute la configuration nécessaire au redéploiement tient dans les trois variables
d'environnement listées à l'étape 2. Aucun accès à un compte Google, aucune clé secrète héritée
d'un stagiaire précédent : un nouveau compte Vercel + Neon (gratuits) suffit pour repartir de
zéro sur un déploiement entièrement neuf.
