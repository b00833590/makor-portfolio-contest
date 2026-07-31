# Concours de Portefeuille Makor — Refonte complète
## Document de conception (v1 — à valider avant implémentation)

---

## 1. Synthèse

L'objectif est de remplacer le Google Sheets + Apps Script actuel (cassé, peu maintenable) par une **plateforme web interne** au niveau de finition d'un TradingView / eToro / Robinhood, réutilisable pour chaque nouvelle promotion de stagiaires.

Ce document couvre : l'architecture, la stack, le modèle de données, les fonctionnalités, une proposition de refonte du règlement (game design), et les risques techniques. **Rien n'est codé à ce stade** — c'est la phase de validation.

---

## 2. Pourquoi repartir de zéro (rappel du diagnostic)

- Scripts Apps Script obsolètes/vides, références de colonnes cassées après modification du tableur → **couplage fort entre UI (Sheet) et logique métier**, aucune séparation des responsabilités.
- La fonction de vente ne fonctionne plus → logique métier non testée, aucune protection contre la dérive du schéma de données.
- Un Google Sheet ne peut pas porter l'expérience "concours de trading" voulue (temps réel, animations, comparaisons, badges).

→ Conclusion actée : nouvelle plateforme, architecture propre dès le départ, pensée pour être **réutilisée à chaque promotion** (pas un one-shot).

---

## 3. Architecture technique

### 3.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  Dashboard | Trading | Leaderboard | Profil | Admin           │
└───────────────────────────┬───────────────────────────────────┘
                            │ Server Actions / API Routes (REST interne)
┌───────────────────────────▼───────────────────────────────────┐
│                     Backend (Next.js API / services)          │
│  - Rules Engine (validation des ordres)                       │
│  - Portfolio Service                                          │
│  - Session Service (fenêtres de changement)                   │
│  - Leaderboard/Performance Service                             │
│  - Gamification Service (badges, challenges)                  │
│  - Admin Service                                               │
└───────┬───────────────────────────────────────┬───────────────┘
        │                                       │
┌───────▼─────────┐                   ┌─────────▼───────────────┐
│   PostgreSQL     │                   │  Job planifié (cron)     │
│ (Supabase/Neon)  │◄──────────────────┤  Ingestion prix marché   │
│  données + audit │                   │  (actions/ETF/crypto)    │
└──────────────────┘                   └──────────────────────────┘
        ▲
        │ Realtime (Postgres changefeed / polling léger)
┌───────┴───────────────────────────────────────────────────────┐
│         Auth : Google Workspace SSO (comptes Makor existants)  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Choix structurants

| Sujet | Choix retenu | Justification |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | SSR pour perf, écosystème mature, DX rapide, permet un rendu "premium" avec peu d'efforts (shadcn) |
| Graphiques | `lightweight-charts` (TradingView) + Recharts pour les stats | `lightweight-charts` = rendu identique à TradingView pour l'historique de prix ; Recharts pour les graphes de classement/comparaison |
| Backend | Intégré à Next.js (API routes + server actions) | Échelle du projet (une trentaine d'utilisateurs, usage interne) ne justifie pas un service séparé — cf. YAGNI. Peut être extrait plus tard si besoin |
| Base de données | PostgreSQL (Supabase ou Neon) | Données fortement relationnelles (positions, transactions, sessions) → SQL plus adapté que NoSQL. Supabase apporte auth + realtime + storage gratuitement |
| ORM | Prisma | Migrations versionnées, types générés, lisible |
| Auth | Auth.js (NextAuth) + provider Google Workspace | Les stagiaires ont déjà un compte Google Makor → SSO natif, zéro friction, pas de gestion de mots de passe |
| Temps réel | Postgres LISTEN/NOTIFY via Supabase Realtime, ou simple revalidation SWR toutes les 30s | Le besoin réel est "ça a l'air vivant", pas du HFT — éviter la sur-ingénierie de websockets custom |
| Données de marché | Twelve Data ou Financial Modeling Prep (actions/ETF) + CoinGecko (la crypto) | Tiers gratuits suffisants à cette échelle ; alternative payante si limites atteintes |
| Ingestion prix | Vercel Cron / Supabase Edge Function, toutes les 15-30 min en heures de marché | Pas besoin de temps réel tick-by-tick pour un concours mensuel — limite aussi le risque de dépassement de quota API |
| Hébergement | Vercel (front+API) + Supabase (DB+Auth+Realtime) | Mise en place rapide, coût quasi nul à cette échelle, TLS/CDN/backups gérés |
| Tests | Vitest (unitaire) + Playwright (e2e) | Conforme aux standards du projet, 80% de couverture visée sur le moteur de règles en particulier |
| CI/CD | GitHub Actions | Lint, tests, build à chaque PR |

**Point ouvert** : si l'IT Makor impose un hébergement interne (pas de cloud SaaS externe), l'architecture reste portable — Docker Compose (Next.js + Postgres + Redis) sur un serveur interne, sans changer le modèle de données ni la logique métier. À confirmer avec vous.

### 3.3 Le "Rules Engine" — pièce centrale

Toute la logique qui a cassé dans l'ancien système (tailles de position, nombre de positions, fenêtres de changement, quota de changements) doit être **centralisée dans un seul service testé unitairement**, jamais dispersée dans l'UI. C'est le composant le plus critique du projet :

- Validation à la soumission d'un ordre (achat/vente/augmentation/diminution)
- Vérifie : capital 100% investi, taille min/max de position, nombre max de positions, fenêtre de session ouverte, quota de changements restant
- Rejette avec message explicite si une règle est violée
- Versionné par promotion (les règles peuvent différer d'une saison à l'autre sans casser l'historique)

---

## 4. Modèle de données (entités principales)

```
Promotion (saison)
 ├─ id, nom, date_debut, date_fin, statut, capital_initial, règles (JSON versionné)

User
 ├─ id, nom, email, rôle (participant/admin), promotion_id, avatar, date_arrivée

Asset (univers d'investissement)
 ├─ id, symbole, nom, type (action/etf/crypto), secteur, devise, actif (bool)

Price (série temporelle)
 ├─ asset_id, timestamp, prix, source

Portfolio
 ├─ id, user_id, promotion_id (un portefeuille par participant et par saison)

Position
 ├─ id, portfolio_id, asset_id, quantité, prix_moyen_entrée, ouverte_le, clôturée_le

Transaction
 ├─ id, portfolio_id, asset_id, type (achat/vente_totale/vente_partielle/augmentation/diminution),
 │  quantité, prix, montant, change_session_id, créée_le

ChangeSession (fenêtre de changement)
 ├─ id, promotion_id, semaine, ouverture, fermeture, statut, quota_max_par_participant

ChangeUsage
 ├─ change_session_id, user_id, changements_utilisés

PerformanceSnapshot (calculé, pas recalculé à la volée)
 ├─ portfolio_id, timestamp, valeur_totale, rendement_jour, rendement_cumulé

Badge / UserBadge
 ├─ badge: code, nom, description, icône, critère
 ├─ user_badge: user_id, badge_id, promotion_id, obtenu_le

AuditLog
 ├─ admin_id, action, cible, avant/après, horodatage
```

Règles de conception importantes :
- **Montants en entiers (centimes) ou `Decimal`, jamais en `float`** — évite les erreurs d'arrondi sur de l'argent.
- `Promotion` est une entité de premier ordre dès le départ → réutilisation immédiate pour les prochaines promos, historique multi-saisons natif (nécessaire pour le Hall of Fame).
- `PerformanceSnapshot` est pré-calculé (job quotidien) plutôt que recalculé à la demande → classement et graphiques rapides même avec beaucoup d'historique.

---

## 5. Fonctionnalités

### 5.1 Côté participant
- Dashboard portefeuille : valeur totale, P&L, répartition, positions en cours
- Achat / vente totale / vente partielle / augmentation / diminution d'une position, avec validation en temps réel des règles (feedback immédiat, pas de blocage après coup)
- Historique complet des transactions
- Graphiques de performance (perso, vs moyenne des stagiaires, vs benchmark type CAC40/S&P500)
- Leaderboard en temps réel avec animation des changements de rang
- Profil : badges, séries de bonnes performances, meilleure progression
- Comparateur de portefeuilles entre stagiaires
- Notifications avant fermeture d'une session de changement

### 5.2 Côté admin
- Ouvrir / fermer une session de changement
- Modifier les règles (taille de position, nombre de positions, quota de changements) — versionné, n'affecte pas l'historique
- Ajouter / retirer des participants
- Gérer l'univers d'investissement (ajout/retrait d'actifs)
- Journal d'audit de toutes les actions admin
- Vue globale des statistiques du concours

### 5.3 Gamification (votre demande explicite)
- Leaderboard temps réel animé (transitions de rang, pas juste un tableau qui saute)
- Badges : ex. "Diversificateur" (jamais >20% sur un seul actif), "Main de fer" (aucun changement pendant 2 semaines et bonne perf), "Comeback" (meilleure remontée de classement), "Sniper" (meilleur trade unique)
- Défis hebdomadaires (ex. "meilleure performance de la semaine", indépendant du classement général)
- Hall of Fame inter-promotions (vainqueurs de chaque saison, records historiques)
- Heatmap sectorielle du concours (où l'argent est investi collectivement)
- "Positions les plus populaires" (quels actifs les stagiaires choisissent le plus)
- Timeline des transactions (fil d'actu façon réseau social, sans révéler les positions en cours si vous voulez garder une part de bluff)

---

## 6. Proposition de refonte du règlement (game design)

Je garde l'esprit du règlement actuel, mais je propose des ajustements pour renforcer l'aspect stratégique et éviter les dérives (ex. tout miser sur la crypto en fin de concours pour un coup de chance).

| Règle actuelle | Proposition | Pourquoi |
|---|---|---|
| Capital 1 000 000 € fictif, investi à 100% | **Conservé** | Simple, lisible, oblige à une vraie prise de décision (pas de "cash de sécurité") |
| Max 20 positions, 1 seule crypto autorisée | Conservé, mais **plafonner la crypto à 20% du capital max** | Sans plafond, la forte volatilité de la crypto peut dominer le classement par pur hasard plutôt que par stratégie — un plafond garde l'actif comme "piment" sans qu'il écrase le jeu actions/ETF |
| Position min 25k€ / max 100k€ | Conservé | Bon équilibre : empêche le saupoudrage extrême tout en forçant une vraie diversification (min 10 positions, max 40) |
| 2 sessions de changement/semaine, 4 changements max | Conservé, + **changements non utilisés non reportables** (use it or lose it) | Évite l'accumulation stratégique qui favoriserait les calculateurs plutôt que les bons "traders" ; garde une cadence de décision régulière |
| Classement final = seule mesure | Ajouter un **classement secondaire "régularité"** (ex. ratio rendement/volatilité type Sharpe simplifié) affiché à titre indicatif | Valorise la gestion de risque, pas seulement le pari le plus chanceux — sans changer qui gagne le prix (qui reste la perf brute, pour rester simple et fidèle à l'esprit "concours") |
| Rien sur la fin de concours | **Gel des positions dans les dernières 48h** (plus aucun changement possible) | Évite qu'un participant fasse un pari "tout ou rien" à la toute dernière minute qui fausse la mesure de compétence sur tout le mois |
| Pas de structure multi-saison | **Introduire la notion de saison** dès le modèle de données, avec Hall of Fame cumulatif | Vous avez explicitement dit vouloir réutiliser l'outil — sans cela, chaque promo repart de zéro et perd la dimension "héritage/records" |
| Rien sur les défis courts | **Défi hebdomadaire indépendant** (meilleure perf de la semaine, récompense symbolique/badge) | Garde l'engagement même pour un stagiaire qui décroche du classement général tôt (évite le désengagement) |
| Aucune règle anti-abus | **Toute action admin est journalisée (audit log)**, et les règles sont versionnées par saison | Traçabilité totale — répond directement au problème actuel ("le code est peu maintenable, les règles ont dérivé sans trace") |

Point sur lequel j'aimerais votre avis avant de le figer : faut-il que le classement secondaire "régularité" ait un **impact réel** (ex. départage en cas d'égalité stricte sur la perf brute) ou reste **purement informatif** ? Je recommande informatif pour rester fidèle à l'esprit "la meilleure perf gagne", plus simple à expliquer aux participants.

---

## 7. Risques techniques identifiés et mitigations

| Risque | Mitigation |
|---|---|
| Fiabilité/limites de l'API de données de marché | Provider de secours + indicateur de fraîcheur des prix dans l'UI + cache local des derniers prix connus |
| Erreurs d'arrondi sur les montants | `Decimal`/entiers en centimes partout, jamais de `float` pour l'argent |
| Logique de règles dispersée (= le bug actuel) | Un seul "Rules Engine" testé à 80%+ de couverture, aucune validation dupliquée côté UI |
| Écritures concurrentes pendant une session de changement | Transactions SQL + verrouillage optimiste sur le portefeuille |
| Dérive du schéma comme sur l'ancien Sheet | Migrations Prisma versionnées, jamais de modification manuelle de la base |
| Réutilisabilité pour les prochaines promos | `Promotion` comme entité de premier niveau dès le jour 1, règles versionnées par saison |
| Abus de fin de concours | Gel des positions dans les 48h finales (cf. section 6) |
| Accès admin non tracé | Audit log systématique sur toute action admin |

---

## 8. Feuille de route proposée (phases)

1. **Fondations** : auth (Google SSO), modèle de données, CRUD admin, ingestion des prix
2. **Trading core** : achat/vente/modification de position avec Rules Engine, sessions de changement
3. **Dashboards & performance** : valeur de portefeuille, graphiques, historique de transactions
4. **Leaderboard & gamification** : classement temps réel, badges, défis hebdomadaires
5. **Admin & finitions** : notifications, Hall of Fame, saisons
6. **Polish UX & tests de charge** avant lancement de la première promo sur la plateforme

Chaque phase suit le workflow habituel : plan → tests d'abord (TDD) → implémentation → revue de code → commit.

---

## 9. Questions ouvertes à valider avec vous avant de coder

1. **Hébergement** : cloud externe (Vercel/Supabase) accepté par l'IT Makor, ou obligation d'infra interne ?
2. **Authentification** : les stagiaires ont-ils un compte Google Workspace Makor exploitable pour le SSO ?
3. **Budget données de marché** : reste-t-on sur des API gratuites (Twelve Data, CoinGecko) ou y a-t-il un abonnement déjà disponible (Bloomberg, Refinitiv) ?
4. **Échelle** : combien de participants par promotion typiquement (10-20-40) ? Ça influence surtout le calibrage des tests de charge, pas l'architecture.
5. **Classement secondaire "régularité"** : informatif seulement, ou doit-il compter dans le règlement officiel ?
6. **Plafond crypto à 20%** et **gel des positions 48h avant la fin** : acceptez-vous ces deux ajouts au règlement ?

---

*Prochaine étape : une fois ce document validé (ou amendé), on démarre la phase 1 en suivant le workflow plan → TDD → revue → commit.*
