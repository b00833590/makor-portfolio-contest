# Guide administrateur

Ce guide couvre les opérations qu'un administrateur (rôle `ADMIN`) effectue depuis l'interface
`/admin`, accessible une fois connecté avec un compte administrateur.

## Se connecter en tant qu'administrateur

Identifiant `Makor`, mot de passe `makor2023` par défaut (créé par `npm run db:seed`). Changer ce
mot de passe dès la première connexion :

1. Aller sur `/admin/participants`.
2. Repérer la ligne du compte `Makor`, cliquer sur **Modifier**.
3. Renseigner un nouveau mot de passe dans le champ dédié, **Réinitialiser le mot de passe**.

## Créer un nouveau concours (promotion)

Une **promotion** représente une saison du concours — chaque nouvelle cohorte de stagiaires en
a une nouvelle. Depuis `/admin/promotions` :

1. Remplir le formulaire **Nouvelle promotion** :
   - **Nom** — libellé affiché partout (ex. "Promotion Été 2026")
   - **Date de début / Date de fin** — bornes du concours
   - **Capital initial (€)** — capital fictif de départ pour chaque participant (défaut : 1 000 000 €)
   - **Nombre max de positions** — nombre de lignes distinctes qu'un portefeuille peut détenir
   - **Taille min / max position (€)** — force une vraie diversification (empêche le saupoudrage
     extrême comme la concentration excessive)
   - **Cryptomonnaies max / participant** — nombre de cryptomonnaies distinctes qu'un
     participant peut détenir simultanément (défaut : 1 ; mettre 0 pour interdire la crypto)
   - **Sessions de changement / semaine** et **Changements max / session** — cadence à laquelle
     les participants peuvent modifier leurs positions
   - **Gel avant la fin (heures)** — période avant la clôture pendant laquelle plus aucun
     changement n'est autorisé (évite un pari "tout ou rien" de dernière minute)
2. **Créer la promotion**. Elle démarre au statut `DRAFT` — passez-la à `ACTIVE` quand le concours
   doit réellement commencer (les participants ne peuvent trader que sur une promotion active).

Ces règles sont versionnées par promotion (stockées en JSON sur chaque `Promotion`) : modifier
le règlement d'une nouvelle saison n'affecte jamais l'historique des saisons précédentes, qui
reste figé pour le Hall of Fame.

## Modifier les règles d'un concours en cours

Aucune règle n'est figée après la création d'une promotion. Depuis la page d'une promotion
(`/admin/promotions/[id]`), bouton **Paramètres** : capital initial, nombre max de positions,
tailles min/max, cryptomonnaies max, changements par session, gel avant la fin, fenêtre de
constitution — tout est modifiable à tout moment, effet immédiat pour tous les participants dès
leur prochain ordre.

Avant d'enregistrer, la page vérifie si le changement crée une incohérence avec l'état réel des
portefeuilles (ex. baisser le nombre max de cryptomonnaies alors que des participants en
détiennent déjà plus) et affiche un avertissement détaillé si c'est le cas — rien n'est jamais
modifié de force chez les participants, un second clic confirme explicitement le changement malgré
l'avertissement. Le **capital initial** est le seul champ verrouillé dès qu'une transaction existe
dans la promotion (le concours a réellement commencé — le changer rétroactivement à ce stade
fausserait le capital disponible de tout le monde).

Toute modification est journalisée dans `/admin/audit` (qui, quand, ancienne valeur, nouvelle
valeur).

## Ajouter, modifier, retirer des participants

Depuis `/admin/participants` :

- **Ajouter** : renseigner l'identifiant (format "Prénom Nom", ex. "Adam Dupont"), un mot de
  passe initial, et la promotion à laquelle rattacher le participant. Communiquez ces
  identifiants au stagiaire par le canal de votre choix (Slack, email, oral) — la plateforme ne
  les envoie jamais elle-même.
- **Modifier** : réinitialiser le mot de passe d'un participant (utile s'il l'a oublié), ou le
  faire changer de promotion.
- **Retirer** : détache le participant de sa promotion (`Retirer`) sans supprimer son compte ni
  son historique — utile pour un participant qui quitte le concours en cours de route.
- **Supprimer** : suppression définitive du compte et de tout son historique (positions,
  transactions, badges). Irréversible — à réserver aux comptes créés par erreur.

**C'est ce mécanisme qui garantit qu'un stagiaire ayant quitté Makor ne peut jamais rejoindre un
futur concours** : chaque nouvelle promotion ne contient que les comptes explicitement créés (ou
réaffectés) par l'admin. Aucune auto-inscription n'est possible.

## Restreindre l'univers d'actifs

Par défaut, tout ticker action/crypto trouvé par la recherche (`/api/assets/search`, Twelve
Data + CoinGecko) est achetable — l'actif est créé automatiquement en base au premier achat.
Les ETF sont exclus par construction : la recherche ne retourne que des actions (listings
« Common Stock ») et des cryptomonnaies.
Pour retirer un actif de l'univers investissable :

1. Aller sur `/admin/assets`.
2. Repérer l'actif (il n'apparaît que s'il a déjà été acheté au moins une fois par un
   participant), cliquer **Désactiver**.

Les positions déjà ouvertes sur cet actif ne sont pas affectées ; seul un nouvel achat est
bloqué. Réactiver un actif le rend de nouveau achetable.

Un seul actif de type crypto peut être actif à la fois sur toute la plateforme (règlement —
voir `docs/CONCEPTION.md` section 6) : si un participant a déjà acheté du Bitcoin, tenter d'en
acheter une autre (Ethereum, etc.) sera refusé tant que le Bitcoin reste actif.

## Modifier le règlement en cours de saison

Il n'existe pas encore d'écran dédié pour éditer les règles d'une promotion déjà créée (le champ
`rules` JSON de la table `Promotion` peut être modifié directement en base si un ajustement est
indispensable en cours de saison — à faire avec précaution, car cela s'applique immédiatement à
tous les participants). Pour une nouvelle saison, créez simplement une nouvelle promotion avec
les règles souhaitées.

## Mettre à jour les fournisseurs de données de marché

- **Twelve Data** (actions) : créer une clé gratuite sur
  [twelvedata.com](https://twelvedata.com), la renseigner dans `TWELVE_DATA_API_KEY` (voir
  [DEPLOIEMENT.md](DEPLOIEMENT.md)). Sans clé, la plateforme reste fonctionnelle mais bascule sur
  un provider de prix simulé (`src/lib/prices/providers/mock-provider.ts`).
- **Binance** (prix crypto) : aucune clé nécessaire, API publique sans quota significatif pour
  cet usage. **CoinGecko** reste utilisé séparément pour la *recherche* de tickers crypto
  (nom, logo, rang par capitalisation) — aucune clé non plus.
- Pour ajouter un nouveau fournisseur (ex. remplacer Twelve Data par Financial Modeling Prep) :
  implémenter l'interface `PriceProvider` (`src/lib/prices/types.ts`) et l'ajouter à la liste
  dans `src/lib/prices/index.ts` — aucun autre fichier à modifier, le reste de la plateforme
  (cache pull-through, cron d'ingestion) est agnostique du fournisseur.

## Fraîcheur des prix et rafraîchissement automatique

Voir la section "Fraîcheur des prix" du [README](../README.md) pour le détail de
l'architecture (seuils de péremption par type d'actif, rafraîchissement pull-through, workflow
GitHub Actions, auto-refresh côté navigateur).

Pour que le rafraîchissement toutes les 5 minutes fonctionne (au lieu d'une fois par jour sur le
cron Vercel gratuit), configurer sur le dépôt GitHub (Settings → Secrets and variables →
Actions → New repository secret) :

| Secret | Valeur |
|---|---|
| `APP_URL` | URL du déploiement, ex. `https://mon-concours.vercel.app` |
| `CRON_SECRET` | Identique à la variable d'environnement `CRON_SECRET` du déploiement Vercel |

Sans ces secrets, le workflow (`.github/workflows/ingest-prices.yml`) échoue silencieusement
(visible dans l'onglet "Actions" du dépôt) et la plateforme retombe sur le seul cron quotidien
Vercel — dégradé, mais toujours fonctionnel.

Si le nombre d'actions distinctes suivies par le concours grandit significativement, le seuil
`STOCK_PRICE_STALE_MS` (`src/lib/prices/staleness.ts`) peut nécessiter un ajustement à la hausse
pour rester sous le quota gratuit Twelve Data (8 requêtes/min, 800/jour) — le calcul est
documenté dans le commentaire du fichier.

## Maintenance long terme

- **Migrations de schéma** : `npx prisma migrate deploy` applique toute migration Prisma
  versionnée dans `prisma/migrations/`. Ne jamais modifier la base manuellement.
- **Tests** : `npm test` avant tout changement de code touchant au moteur de règles ou à
  l'authentification.
- **Logs d'audit** : chaque action admin (création/suppression de participant, changement de
  promotion, activation/désactivation d'actif) est journalisée dans la table `AuditLog` — utile
  pour retracer une dérive ou un incident.
