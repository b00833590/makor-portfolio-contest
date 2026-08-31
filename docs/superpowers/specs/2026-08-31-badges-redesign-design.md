# Refonte du système de badges — Design (Phase 1)

Date : 2026-08-31
Statut : validé, prêt pour le plan d'implémentation
Contexte : concours suivant lancé sous 1–2 jours → Phase 1 sans migration de schéma.

## 1. Objectif

Transformer les badges en une vraie couche de gamification : motivante, compétitive,
fun, lisible, et **cohérente avec les données réellement disponibles**. Le principe
directeur du concours reste inchangé : la meilleure performance de portefeuille gagne ;
aucun badge ne doit récompenser un comportement qui nuit à sa propre performance.

## 2. Périmètre

### Phase 1 — maintenant (ce document), **zéro migration de schéma**

- Réécriture complète du catalogue (34 badges) : suppressions, recalibrages, nouveaux.
- Corrections du moteur d'évaluation + nouveaux champs de contexte (tous dérivés).
- Refonte visuelle de `/badges` (vitrine de collection).
- Refonte des notifications de déblocage (toast personnalisé, gestion multi-badges).
- Changement des valeurs par défaut des règles admin (`changeSessionsPerWeek: 1`,
  `maxChangesPerSession: 6`).

### Phase 2 — après / pendant le concours (hors de ce document)

- Badges **permanents** liés au joueur (distincts des badges de participation),
  affichés sur le profil et dans le Hall of Fame → nécessite une migration.
- Enrichissement du pipeline de recherche d'actifs avec le **secteur** (Yahoo
  `assetProfile`) + backfill → réactive les badges de diversification sectorielle.
- Éventuel historique de rang plus fin si des badges le justifient.

## 3. Contraintes de données (Phase 1, sans migration)

| Donnée | Disponibilité | Impact |
| --- | --- | --- |
| `cumulativeReturnPct`, `weeklyReturnPct`, `dailyReturnPct` | OK (live + snapshots) | Badges de performance |
| `currentRank` / `previousRank` | OK (live, via `getLeaderboard`) | Badges de classement instantanés |
| `rankHistory` (`PerformanceSnapshot.rank`) | ~1 point/jour (cron nocturne `0 22 * * *`) ; **NULL** sur recalculs admin isolés et lignes antérieures | Badges « X jours en tête » comptés en snapshots ; tolérer les `null` |
| Trades clôturés (P&L €, P&L %, `closedAt`) | OK (`buildTrades`) | Badges trading |
| Prix ≤ 5 j après un achat | OK (table `Price`) | « Le bon instinct », « Œil de lynx » |
| Arbitrage réussi | OK | « Arbitragiste » |
| Usage des fenêtres de changement | OK | « Zen », « Stratège assidu » |
| Séries de connexion (`User.currentStreakDays` / `longestStreakDays`) | OK | Badges d'assiduité |
| Concentration d'une position dans le portefeuille | OK (dérivé de `marketValue`) | « Rien dans un seul panier » |
| Type d'actif (STOCK / CRYPTO) des positions | OK (ajouter `type` au `select`) | « Touche-à-tout » |
| Nombre d'actifs distincts tradés | OK (dérivé des transactions) | « Collectionneur » |
| Moyenne de rendement du concours | OK (dérivé du tableau `leaderboard`) | « Alpha » |
| **Secteur d'activité** | **NULL sur 100% du catalogue (63/63)** | Diversification sectorielle → **supprimée** (Phase 2) |
| **Devise** | **Toujours "EUR"** | Diversification par devise → **supprimée** |
| Rang intra-journalier | Indisponible | Pas de badge « dépassé X en 1 h » |

## 4. Architecture

### 4.1 Le catalogue reste du code

`BADGE_CATALOG` (agrégé depuis `src/lib/gamification/badges/*.ts`) est la source de
vérité. `ensureBadgesSeeded()` fait un `upsert` des lignes `Badge` à chaque
évaluation. Conséquence : **réécrire le catalogue ne demande aucune migration**. Les
`UserBadge` attribués sous d'anciens codes supprimés restent en base mais
**n'apparaissent plus** : `getBadgeBoard` est construit exclusivement à partir de
`BADGE_CATALOG` (les orphelins sont masqués, cf. commentaire existant dans
`get-badge-board.ts`). Aucune donnée n'est corrompue.

Les enums `BadgeCategory` (8 valeurs) et `BadgeRarity` (4 valeurs) sont **inchangés**.
Les 6 catégories affichées sont un remapping/relibellé des enums existants (§5).

### 4.2 Chemins d'attribution (inchangés)

1. **Instantané** — après une action de trading (`evaluateUserBadgesForUser`),
   badges marqués `seenAt` dans la même requête (toast inline).
2. **Cron nocturne** — `evaluateAndAwardBadges` pour chaque promotion active, badges
   laissés `seenAt = null` → `UnseenBadgeToaster` au prochain passage sur le site.
3. **Fin de concours** — `awardCloseOnlyBadges` au passage `ACTIVE → CLOSED`
   (`finalizePromotionClosure`), pour les superlatifs et conditions « tout le concours ».

### 4.3 Nouveaux champs de `BadgeEvaluationContext` (tous dérivés, 0 requête nouvelle sauf mention)

| Champ | Type | Source |
| --- | --- | --- |
| `fieldAverageReturnPct` | `number` | moyenne de `cumulativeReturnPct` sur `leaderboard` |
| `hasBestWeeklyReturn` | `boolean` | `weeklyReturnPct` de ce participant == max des `weeklyReturnPct` non-null du `leaderboard` (min 2 participants avec une valeur) |
| `distinctAssetsTradedCount` | `number` | `new Set(transactions.map(t => t.assetId)).size` |
| `holdsStockAndCrypto` | `boolean` | types d'actifs des positions ouvertes (ajouter `asset.type` au `select` de `db.position.findMany`) |
| `maxPositionConcentrationPct` | `number \| null` | `max(marketValue) / sum(marketValue) * 100` sur les positions ouvertes ; `null` si aucune |
| `hasAnchorPosition` | `boolean` | existe une position ouverte : âge ≥ 21 j, P&L ≥ +10%, aucun `INCREASE`/`SELL_PARTIAL`/`DECREASE` sur son `assetId` après l'ouverture |
| `regainedFirstPlace` | `boolean` | `currentRank === 1` ET il existe un snapshot postérieur à un `rank === 1` avec `rank > 1`, puis retour à `1` (voir §6 « Chasseur de tête ») |

Aucun nouveau champ de `CloseOnlySummary`.

## 5. Catégories et rareté

### 5.1 Six catégories (remapping des enums existants — 0 migration)

| Affichage | Enum réutilisé | Libellé `CATEGORY_LABEL` |
| --- | --- | --- |
| 📈 Performance | `PERFORMANCE` | « Performance » |
| 🏆 Compétition | `RANKING` | « Compétition » |
| 🎯 Trading | `TRADING` **et** `CONVICTION` | « Trading » |
| 🛡️ Sang-froid | `RISK_MANAGEMENT` | « Sang-froid » |
| 🌍 Diversification | `DIVERSIFICATION` | « Diversification » |
| 🔥 Exploits | `DISTINCTION` | « Exploits » |
| 😄 Fun | `SPECIAL_EVENT` | « Fun » |

Les 2 badges portant aujourd'hui l'enum `CONVICTION` sont réaffectés : `LE_BON_INSTINCT`
→ `TRADING`, `FIDELE_AU_POSTE` → `DISTINCTION`. La valeur d'enum `CONVICTION` cesse
d'être utilisée (non supprimée — pas de migration).

`BadgeGrid` : ordre des catégories = Performance, Compétition, Trading, Sang-froid,
Diversification, Exploits, Fun. `RISK_MANAGEMENT` reprend le libellé « Sang-froid ».

### 5.2 Rareté = probabilité réelle d'obtention sur un concours

| Rareté | Cible | XP |
| --- | --- | --- |
| Commun | quasi tout le monde (premiers pas, participation) | 10 |
| Rare | ~moitié des participants, demande un effort | 25 |
| Épique | quelques participants, vraie réussite | 60 |
| Légendaire | 0–2 gagnants par concours (dont 5 close-only à ≤ 2 gagnants) | 150 |

XP / paliers de niveau (`xp.ts`) : **conservés tels quels**. L'affichage XP/niveau
devient secondaire dans l'UI (§7).

## 6. Catalogue complet (39 badges)

Notation : `CODE` — Nom — *rareté* — condition → logique `evaluate` (ou « close-only »).

### 📈 Performance (`PERFORMANCE`) — 5

- `PREMIER_ENVOL` — Premier envol — *Commun* — +3% de rendement cumulé
  → `ctx.cumulativeReturnPct >= 3`
- `DANS_LE_VERT` — Dans le vert — *Rare* — +8% cumulé
  → `ctx.cumulativeReturnPct >= 8`
- `SURPERFORMANCE` — Surperformance — *Épique* — +18% cumulé
  → `ctx.cumulativeReturnPct >= 18`
- `AUTRE_GALAXIE` — Autre galaxie — *Légendaire* — +28% cumulé
  → `ctx.cumulativeReturnPct >= 28`
- `ALPHA` — Alpha — *Rare* — battre la moyenne du concours de ≥ 12 points
  → `ctx.cumulativeReturnPct - ctx.fieldAverageReturnPct >= 12` (min 3 participants)

### 🏆 Compétition (`RANKING`) — 8

- `SUR_LE_PODIUM` — Sur le podium — *Rare* — atteindre le Top 3
  → `ctx.currentRank !== null && ctx.currentRank <= 3 && ctx.participantCount >= 4`
- `SUR_LE_TOIT` — Sur le toit — *Épique* — atteindre la 1ère place
  → `ctx.currentRank === 1 && ctx.participantCount >= 3`
- `CHASSEUR_DE_TETE` — Chasseur de tête — *Rare* — reprendre la 1ère place après
  l'avoir perdue au moins un jour → `ctx.regainedFirstPlace`
- `MEILLEURE_SEMAINE` — Meilleure semaine — *Épique* — meilleure perf 7 j glissants
  de tous les participants → `ctx.hasBestWeeklyReturn`
- `FUSEE` — Fusée — *Épique* — +8% en une seule journée
  → `ctx.dailyReturnPct !== null && ctx.dailyReturnPct >= 8`
- `REMONTADA` — Remontada — *Épique* — gagner ≥ 5 places au classement en une journée
  → `ctx.currentRank !== null && ctx.previousRank !== null && ctx.previousRank - ctx.currentRank >= 5`
- `DOMINATION` — Domination — *Épique* — 1er avec ≥ 8 points d'avance sur le 2e
  → `ctx.currentRank === 1 && ctx.gapToSecondPts !== null && ctx.gapToSecondPts >= 8`
- `REGNE` — Règne — *Épique* — 1er pendant 5 jours consécutifs (snapshots)
  → `ctx.rankHistory.length >= 5 && ctx.rankHistory.slice(0, 5).every(p => p.rank === 1)`

### 🎯 Trading (`TRADING`) — 7

- `PREMIER_PAS` — Premier pas — *Commun* — 1ère transaction
  → `ctx.transactionCount >= 1`
- `PREMIERE_VICTOIRE` — Première prise — *Commun* — 1ère vente gagnante
  → `ctx.closedTradesChronological.some(t => t.pnlEur >= 0)`
- `BEAU_MOVE` — Beau move — *Rare* — une vente à +12% de gain
  → `ctx.closedTradesChronological.some(t => t.pnlPct >= 12)`
- `GROS_COUP` — Gros coup — *Épique* — une vente à +25% de gain
  → `ctx.closedTradesChronological.some(t => t.pnlPct >= 25)`
- `MAIN_CHAUDE` — Main chaude — *Épique* — 4 ventes gagnantes consécutives
  → `hasWinningStreak(ctx.closedTradesChronological, 4)`
- `ARBITRAGISTE` — Arbitragiste — *Rare* — vendre une position puis en racheter une
  autre, aujourd'hui gagnante, dans la même session → `ctx.hasSuccessfulArbitrage`
- `LE_BON_INSTINCT` — Le bon instinct — *Épique* — acheter un actif qui prend +15%
  dans les 5 jours → `ctx.postBuyMaxGainPct !== null && ctx.postBuyMaxGainPct >= 15`

### 🛡️ Sang-froid (`RISK_MANAGEMENT`) — 3

- `SANG_FROID` — Sang-froid — *Rare* — aucune position ouverte en perte > 5%
  (min 5 positions) → `ctx.positions.length >= 5 && ctx.positions.every(p => positionPnlPct(p) >= -5)`
- `TOUT_AU_VERT` — Tout au vert — *Épique* — toutes les positions ouvertes en gain
  (min 5 positions) → `ctx.positions.length >= 5 && ctx.positions.every(p => positionPnlPct(p) >= 0)`
- `PIERRE_ANGULAIRE` — Pierre angulaire — *Rare* — garder une position en gain de
  +10% pendant ≥ 3 semaines sans y toucher → `ctx.hasAnchorPosition`

### 🌍 Diversification (`DIVERSIFICATION`) — 4

- `PORTEFEUILLE_COMPLET` — Portefeuille garni — *Commun* — atteindre le nombre max
  de positions → `ctx.maxPositions > 0 && ctx.openPositionCount >= ctx.maxPositions`
- `RIEN_DANS_UN_PANIER` — Rien dans un seul panier — *Rare* — aucune position ne
  pèse plus de 12% du portefeuille (min 8 positions)
  → `ctx.openPositionCount >= 8 && ctx.maxPositionConcentrationPct !== null && ctx.maxPositionConcentrationPct <= 12`
- `TOUCHE_A_TOUT` — Touche-à-tout — *Commun* — détenir actions ET crypto simultanément
  → `ctx.holdsStockAndCrypto`
- `COLLECTIONNEUR` — Collectionneur — *Rare* — avoir détenu 25 actifs différents au
  fil du concours → `ctx.distinctAssetsTradedCount >= 25`

### 🔥 Exploits (`DISTINCTION`) — 8

- `INTOUCHABLE` — Intouchable — *Légendaire* — 1er pendant 12 jours cumulés
  → `ctx.rankHistory.filter(p => p.rank === 1).length >= 12` *(évalué en continu, pas close-only : `rank === 1` cumulé ne peut que croître, aucun risque de faux positif)*
- `PERFECTION` — Perfection — *Légendaire* — débloquer tous les autres badges
  → `ctx.alreadyOwnedCodes.size >= ctx.totalBadgeCount - 1`
- `CHAMPION_DU_CONCOURS` — Champion du concours — *Légendaire* — terminer 1er — **close-only**
- `LE_PHENIX` — Le Phénix — *Légendaire* — avoir été dernier puis finir sur le podium — **close-only**
- `MEILLEUR_STOCK_PICKER` — Meilleur stock picker — *Légendaire* — le meilleur trade
  (% de gain) de tout le concours — **close-only**
- `MEILLEUR_TACTICIEN` — Meilleur tacticien — *Légendaire* — le meilleur taux de
  réussite sur ≥ 5 trades clôturés — **close-only** *(anciennement `MEILLEUR_TRADER` ; renommer name/description, garder le code)*
- `OEIL_DE_LYNX` — Œil de lynx — *Légendaire* — le meilleur achat juste avant une
  hausse de tout le concours — **close-only** *(anciennement `MEILLEUR_TIMING` ; garder le code)*

- `FIDELE_AU_POSTE` — Fidèle au poste — *Épique* — garder une position ouverte du
  début à la fin du concours — **close-only** *(enum `DISTINCTION`, anciennement `CONVICTION`)*

→ Exploits contient donc **8** entrées.

### 😄 Fun (`SPECIAL_EVENT`) — 4

- `LEVE_TOT` — Lève-tôt — *Rare* — 1er participant du concours à finaliser son
  portefeuille (exclusif, un seul gagnant) — *(anciennement `PIONNIER` ; garder le
  code, renommer)* → condition individuelle `ctx.maxPositions > 0 &&
  ctx.openPositionCount >= ctx.maxPositions` + exclusivité vérifiée à l'attribution
  (logique existante `PIONNIER` dans `awardBadgesForContext` — adapter au nouveau code)
- `ZEN` — Zen — *Commun* — une semaine complète sans aucun changement alors qu'une
  fenêtre était ouverte — *(anciennement `PATIENCE_DE_FER`)*
  → `ctx.weeklyChangeWindows.some(w => w.hadWindow && w.changesUsed === 0)`
- `STRATEGE_ASSIDU` — Stratège assidu — *Épique* — avoir participé à chaque session
  de changement du concours — **close-only**
- `HABITUE` — Habitué — *Commun* — se connecter 10 jours d'affilée
  → `ctx.currentStreakDays >= 10 || ctx.longestStreakDays >= 10`

### 6.1 Décompte final

| Catégorie (enum) | Nombre |
| --- | --- |
| Performance (`PERFORMANCE`) | 5 |
| Compétition (`RANKING`) | 8 |
| Trading (`TRADING`) | 7 |
| Sang-froid (`RISK_MANAGEMENT`) | 3 |
| Diversification (`DIVERSIFICATION`) | 4 |
| Exploits (`DISTINCTION`) | 8 |
| Fun (`SPECIAL_EVENT`) | 4 |
| **Total** | **39** |

Répartition rareté : Commun 7, Rare 11, Épique 13, Légendaire 8 (dont 5 close-only
« superlatif » à 1–2 gagnants : `CHAMPION_DU_CONCOURS`, `LE_PHENIX`,
`MEILLEUR_STOCK_PICKER`, `MEILLEUR_TACTICIEN`, `OEIL_DE_LYNX`).
`CLOSE_ONLY_CODES` = { CHAMPION_DU_CONCOURS, LE_PHENIX, MEILLEUR_STOCK_PICKER,
MEILLEUR_TACTICIEN, OEIL_DE_LYNX, FIDELE_AU_POSTE, STRATEGE_ASSIDU } — 7.

> La présentation annonçait ~34 ; le détail par badge a porté le total à **39**
> (chaque badge a une condition distincte et atteignable). Candidats à retirer si l'on
> veut resserrer : `SURPERFORMANCE` (échelle de perf déjà dense), `CHASSEUR_DE_TETE`
> (proche de `LE_PHENIX`), `MEILLEURE_SEMAINE` (calcul glissant approximatif).
> `MARATHONIEN` et `DIAMANT_BRUT`, envisagés, ont déjà été retirés (redondants avec
> `HABITUE` / `FIDELE_AU_POSTE`).

### 6.2 Badges supprimés (3)

| Ancien code | Raison |
| --- | --- |
| `MULTI_SECTEURS` | `Asset.sector` NULL sur 100% du catalogue → impossible. Revient en Phase 2. |
| `TOUR_DU_MONDE` | Toutes les positions en « EUR » → impossible. |
| `SEMAINE_SANS_ACCROC` | Condition passive (déclenchée par l'inactivité), redondante avec `MAIN_CHAUDE` / `PREMIERE_VICTOIRE`. Remplacée par `PIERRE_ANGULAIRE`. |

Les `UserBadge` éventuels sous ces codes restent en base (aucune suppression) mais
disparaissent de l'UI (board construit depuis le catalogue).

### 6.3 Codes conservés à l'identique de valeur mais renommés

`PIONNIER` → `LEVE_TOT`, `PATIENCE_DE_FER` → `ZEN`, `AUTRE_PLANETE` → `SURPERFORMANCE`,
`COUP_DOUBLE` → `BEAU_MOVE`, `ROI_DE_LA_SEMAINE` → `REGNE`, `INVINCIBLE` → `INTOUCHABLE`,
`LE_RETOUR` → `CHASSEUR_DE_TETE` (condition élargie), `MEILLEUR_TRADER` →
`MEILLEUR_TACTICIEN`, `MEILLEUR_TIMING` → `OEIL_DE_LYNX`.

**Décision** : on **change les codes** (nouveaux `code:` dans les specs). Les
`UserBadge` sous les anciens codes (concours Août 2026, clos) resteront masqués —
acceptable : ils appartiennent à un concours terminé dont le Hall of Fame (résultat
officiel) est déjà figé et n'affiche pas les badges. Cela garde le catalogue propre
plutôt que de traîner des alias.

## 7. Refonte visuelle de `/badges`

Fichiers : `src/app/badges/page.tsx`, `progress-header.tsx`, `xp-level-panel.tsx`,
`badge-grid.tsx`, `badge-card.tsx` ; helper `get-badge-board.ts` ;
`badge-display.ts` (libellés + classes de rareté).

### 7.1 Bloc d'en-tête unique (remplace `ProgressHeader` + `XpLevelPanel`)

- Grand compteur `12 / 39`.
- Barre de progression **segmentée par rareté** (largeur de chaque segment ∝ nombre
  de badges de cette rareté ; portion obtenue en couleur pleine, reste en creux).
- Chip niveau + XP (`Niveau 3 · Stratège · 320 XP · +180 → niveau suivant`) en discret.
- La carte « Le plus récent » et « Badges rares » disparaissent en tant que cartes
  (l'info « badges rares » est lisible dans la barre segmentée).

### 7.2 Navigation : sections + filtres (remplace les onglets)

- Rangée de **filtres** (chips, cumulables raisonnablement) : `Tous` / `Débloqués` /
  `À débloquer` · séparateur · `Commun` `Rare` `Épique` `Légendaire`.
- En dessous, **une section par catégorie** dans l'ordre du §5.1, chacune avec un
  en-tête `📈 Performance ···· 3 / 5` et sa grille de cartes.
- Pas d'onglets : on fait défiler toute la collection (effet « vitrine »).

### 7.3 Carte de badge

| État | Rendu |
| --- | --- |
| Débloqué | icône en couleur, **liseré coloré selon la rareté** (légendaire = dégradé doré + halo léger), nom, pastille rareté, ✓ + date d'obtention |
| Verrouillé | icône désaturée (opacity ~40%), cadenas, nom **lisible**, pastille rareté, **condition affichée en toutes lettres sur la carte** |
| Vient d'être débloqué (`justUnlocked`) | animation `zoom-in` + halo, comme aujourd'hui |

Plus de tooltip obligatoire pour lire la condition (elle est sur la carte). Un tooltip
peut rester pour la description « d'ambiance » du badge débloqué.

**Barres de progression par badge** (« 11 / 18% ») : **hors périmètre Phase 1** —
demanderait un nouveau chemin de données (l'état live du participant dans
`get-badge-board.ts`). La condition en toutes lettres suffit pour l'objectif « donner
envie de débloquer ». À ajouter en Phase 1.5 si le temps le permet.

Grille : `grid-cols-2` mobile, jusqu'à `lg:grid-cols-4` (cartes plus hautes pour la
ligne de condition ; on passe de 5 à 4 colonnes max).

### 7.4 « Mes records »

Section conservée, **déplacée en bas** de page (tertiaire). Aucune modification de
`get-personal-records.ts`.

## 8. Notifications de déblocage

Fichiers : nouveau `src/components/badges/badge-unlock-toast.tsx` (composant de rendu
partagé) ; `src/components/badges/unseen-badge-toaster.tsx` et
`src/app/dashboard/use-badge-toast.ts` (les 2 déclencheurs) l'utilisent.

- **Toast personnalisé** via `toast.custom` de `sonner` : liseré coloré selon la
  rareté, grande icône, titre « 🏆 Badge débloqué », nom, description courte (1 ligne),
  lien « Voir → » vers `/badges`. Durée ~5 s.
- **Épique / Légendaire** : liseré doré + léger effet de brillance, durée ~7 s.
- **Multi-badges** :
  - 1–2 badges → toasts empilés (2 max visibles simultanément — réglage `sonner`).
  - ≥ 3 badges → **un seul toast récap** « 🏆 3 nouveaux badges ! » + rangée d'icônes,
    clic → `/badges`.
- Le `AwardedBadge` renvoyé par le moteur gagne `icon` et `description` (déjà en base,
  à propager depuis `awardBadgesForContext` / `getUnseenBadges`).
- Pas de son, pas de plein écran, pas de confetti. `acknowledgeBadges` /
  `markBadgesSeen` inchangés.

## 9. Vérification avant le concours (checklist du §9 de la demande)

- [ ] Chaque badge a une condition **atteignable** avec les données réelles — revue
      badge par badge (§3 + §6). Les 3 impossibles sont supprimés.
- [ ] Aucune condition **déclenchable par erreur** :
  - badges de seuil monotones (`>=`) : ne peuvent que devenir vrais, jamais retirés → OK.
  - `INTOUCHABLE` évalué en continu = `count(rank === 1) >= 12`, monotone → OK (pas besoin de close-only).
  - `REGNE` / `FUSEE` / `REMONTADA` : sur données live/snapshot, pas de retrait possible
    d'un `UserBadge` → une fois vrai, acquis. Vérifier qu'un `null` de `rankHistory` ne
    rend pas `REGNE` faussement vrai (`p.rank === 1` est faux pour `null` → OK).
  - close-only : jamais évalués dans la boucle standard (`evaluate` absent + `CLOSE_ONLY_CODES`).
- [ ] Pas de double attribution : `db.userBadge.upsert` sur la clé
      `userId_badgeId_promotionId` (inchangé).
- [ ] Bon participant : identité toujours `row.userId` / `session.user.id` (inchangé).
- [ ] Nouveaux concours : `ensureBadgesSeeded` upsert au 1er passage ;
      `buildEvaluationContext` ne dépend d'aucune donnée pré-existante.
- [ ] Données historiques non corrompues : aucune migration, aucune écriture sur les
      `UserBadge` / `Badge` existants hors upsert du catalogue. Le concours Août 2026
      (clos) : Hall of Fame figé, non impacté.
- [ ] **Dry-run sur la prod** : script lecture seule qui, pour chaque participant du
      dernier concours, évalue le nouveau catalogue et liste ce qui serait attribué —
      contrôle qu'aucun badge « exploit » n'est distribué à tort.
- [ ] `tsc` clean, `eslint` clean, `vitest` vert, `next build` exit 0.

## 10. Changement des défauts admin

`src/lib/promotion-rules.ts` → `defaultPromotionRules` :
`changeSessionsPerWeek: 2 → 1`, `maxChangesPerSession: 4 → 6`. Les autres valeurs
inchangées. `initializationWindowHours` reste `4` (l'admin ajustera).

## 11. Tests

- `src/lib/gamification/badges/*.test.ts` : réécrits pour le nouveau catalogue —
  1 cas « obtient » + 1 cas « n'obtient pas » par badge évaluable, via `baseContext`.
- `badge-test-context.ts` : `baseContext` mis à jour avec les nouveaux champs +
  `totalBadgeCount: 39`.
- `evaluate-badges.test.ts` : `buildEvaluationContext` — vérifier le calcul des
  nouveaux champs dérivés (fixtures DB mockées).
- `award-close-only-badges.test.ts` : renommages `MEILLEUR_TRADER` →
  `MEILLEUR_TACTICIEN`, `MEILLEUR_TIMING` → `OEIL_DE_LYNX` ; `FIDELE_AU_POSTE` reste.
- `get-badge-board.test.ts` : compteurs par catégorie, barre segmentée par rareté.
- Pas de test de composant (cohérent avec l'existant).

## 12. Plan d'implémentation (ordre suggéré)

1. **Chemin critique — moteur & catalogue** (livrable même seul) :
   `promotion-rules.ts` défauts → `types.ts` nouveaux champs → 8 modules de badges
   réécrits → `catalog.ts` + `CLOSE_ONLY_CODES` → `buildEvaluationContext` champs
   dérivés → `award-close-only-badges.ts` → tests moteur.
2. **UI** : `get-badge-board.ts` (compteurs par catégorie + par rareté) →
   `badge-display.ts` → en-tête + sections + filtres + carte → `page.tsx`.
3. **Notifications** : `badge-unlock-toast.tsx` → les 2 déclencheurs → `AwardedBadge`
   enrichi.
4. **Vérif** : dry-run prod + `tsc`/`eslint`/`vitest`/`build`.

## 13. Rapport avant / après (pour archive)

### Supprimés
`MULTI_SECTEURS`, `TOUR_DU_MONDE` (données inexistantes), `SEMAINE_SANS_ACCROC`
(condition passive/redondante).

### Modifiés (seuils recalibrés 1 mois / 1 session de changement par semaine)
Paliers de perf +5→+3 / +10→+8 / +20→+18. `COUP_DOUBLE` +10%→+12%. `MAIN_CHAUDE`
5→4 ventes. `SANG_FROID` / `TOUT_AU_VERT` min 3→5 positions. `DOMINATION` +10→+8 pts.
`INVINCIBLE` 14 j consécutifs → `INTOUCHABLE` 12 j cumulés. `ROI_DE_LA_SEMAINE` 7 j →
`REGNE` 5 j. `LE_RETOUR` (top 3 après dernier) → `CHASSEUR_DE_TETE` (reprendre la 1ère
place après l'avoir perdue). Renommages : cf. §6.3. Recatégorisation : cf. §5.1.

### Nouveaux (10)
`ALPHA`, `SUR_LE_PODIUM`, `MEILLEURE_SEMAINE`, `AUTRE_GALAXIE`, `GROS_COUP`,
`PIERRE_ANGULAIRE`, `RIEN_DANS_UN_PANIER`, `TOUCHE_A_TOUT`, `COLLECTIONNEUR`,
`HABITUE` — cf. §6 pour condition/catégorie/rareté.
(+ `CHASSEUR_DE_TETE` réécrit à partir de `LE_RETOUR`, comptabilisé en « modifié ».)

### Nouvelle expérience utilisateur
Onglet Badges = vitrine de collection : en-tête unique `X / 41` + barre segmentée par
rareté, filtres (Tous / Débloqués / À débloquer / rareté), une section par catégorie
avec son compteur, cartes où la condition et (pour ~10 badges) une barre de
progression sont **visibles même verrouillées**, liseré coloré par rareté. Au
déblocage : toast « 🏆 Badge débloqué » personnalisé (icône, nom, explication, lien),
flourish doré pour épique/légendaire, toast récap si ≥ 3 d'un coup.
