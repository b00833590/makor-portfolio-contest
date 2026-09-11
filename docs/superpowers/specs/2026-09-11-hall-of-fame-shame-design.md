# Hall of Fame / Shame — ajout des pires performances historiques

**Date :** 2026-09-11
**Statut :** validé, prêt pour le plan d'implémentation

## Problème

L'onglet actuel "Hall of Fame" ne montre que les meilleures performances historiques. On veut
y ajouter une véritable section "Hall of Shame" pour les pires performances, avec une identité
visuelle distincte, tout en gardant le fonctionnement actuel intact.

## Contexte technique (état actuel)

- `HallOfFameEntry` (schema.prisma) enregistre déjà, à la clôture de chaque promotion, **une
  ligne par participant** (pas seulement le podium) — `promotion-lifecycle.ts` fait un
  `createMany({ data: finalRows.map(...), skipDuplicates: true })` sur `finalRows` en entier,
  avec `finalReturnPct`, `finalPnlEur`, `finalRank`, `avatarUrl` (snapshot), `closedAt`.
  Contrainte unique `(promotionId, userId)` : un même participant peut apparaître plusieurs
  fois (une fois par promotion), jamais en double sur la même promotion. **La contrainte
  "historique automatique pour les prochains concours" est donc déjà remplie — rien à
  construire côté clôture.**
- `getHallOfFame(viewerUserId?)` (`src/lib/gamification/hall-of-fame.ts`) charge déjà **toutes**
  les lignes triées `finalReturnPct: "desc"` dans `entries`. Donc `entries[0]` = meilleure perf
  de tous les temps (déjà utilisé pour le "Record historique"), et `entries.at(-1)` = **pire**
  perf de tous les temps — la donnée existe déjà, il suffit de lire l'autre extrémité du
  tableau trié.
- Contrainte egress (voir `project_leaderboard_portfolio_consistency_fix` / historique du
  dépassement d'août) : les photos de profil (data URL, jusqu'à 400 Ko) ne sont **pas**
  ramenées pour toutes les lignes. Une 2e requête ciblée ne charge que les photos du podium
  (`finalRank <= 3`) et de l'entrée du visiteur connecté — les deux requêtes tournent
  aujourd'hui en parallèle (`Promise.all`), la 2e ne dépendant pas du résultat de la 1ère
  puisque ses critères (rang ≤ 3, userId du visiteur) sont connus à l'avance.
- Aucun cache (`unstable_cache`) sur cette page : lecture ponctuelle, pas de polling — un
  éventuel coût de latence supplémentaire n'a pas d'impact notable.
- Palette déjà disponible dans `globals.css` : `--primary` (violet, utilisé aujourd'hui pour le
  callout "Record historique" via `border-primary/40 bg-primary/5`), `--loss` /
  `--destructive` (rouge-orangé, déjà utilisé partout pour les rendements négatifs via
  `text-loss`). Aucun nouveau token de couleur nécessaire.
- Nav (`site-header.tsx`, 3 listes : nav principale, admin, directeur) : libellé "Hall of Fame"
  partagé par les trois rôles qui y ont accès. Reste inchangé (décision utilisateur : nav
  courte, titre complet uniquement sur la page).
- `src/app/hall-of-fame/page.tsx` (Server Component, ~140 lignes) orchestre déjà plusieurs
  sections indépendantes en JSX inline (record, podiums par saison, liste complète,
  participations) — le style existant du projet extrait un composant dédié quand une section a
  une identité visuelle propre (ex. `results-podium.tsx`).

## Décisions produit (validées avec l'utilisateur)

1. **Version allégée** : pas de section "lanterne rouge" par saison en miroir du podium — juste
   un callout "pire performance historique" + la liste complète inversée. Évite de désigner
   nommément 3 personnes à chaque concours passé.
2. **Pas de section "participations" côté Shame** (pas de "pire moyenne par personne" agrégée
   sur plusieurs saisons) — même logique d'évitement que ci-dessus.
3. **Nav inchangée** ("Hall of Fame" dans le menu) ; seul le H1 de la page devient
   "Hall of Fame / Shame".
4. **Ton** : léger et assumé, pas de médailles ironiques ligne par ligne. Un seul détail
   potache sur le callout du pire (emoji 🍌 + phrase d'intro courte), le reste reprend
   sobrement le layout existant avec la palette `--loss`.

## Approche retenue

1. **Couche données** — `getHallOfFame` passe de deux requêtes parallèles à séquentielles :
   1. Requête 1 inchangée (toutes les lignes, triées, sans `avatarUrl`).
   2. Calcul de `worstEntry = rows.at(-1)` (peut être `undefined` si `rows` est vide).
   3. Requête 2 (photos) : même structure `OR`, avec un nouveau critère exact
      `{ promotionId, finalRank }` correspondant à `worstEntry`, en plus des critères
      existants (`finalRank <= 3`, `userId` du visiteur). Si `worstEntry` fait déjà partie du
      podium (peu de participants au total), le critère est redondant mais inoffensif —
      dédoublonné naturellement par la requête `findMany`.
   - Aucun nouveau champ dans `HallOfFameData` / `HallOfFameEntryView` : `entries` reste la
     même liste triée décroissant. Le pire enregistrement se lit `entries.at(-1)`, la liste
     "pires performances" est `[...entries].reverse()`.
   - Cas à une seule entrée totale : `entries[0]` et `entries.at(-1)` désignent la même
     personne — comportement accepté (mathématiquement correct, pas un bug).

2. **Présentation** — `src/app/hall-of-fame/page.tsx` + nouveau composant
   `src/app/hall-of-fame/hall-of-shame-section.tsx` (présentational, Server Component, reçoit
   `worstRecord: HallOfFameEntryView | null` et `worstEntries: HallOfFameEntryView[]` en
   props) :
   - H1 de la page : "Hall of Fame / Shame".
   - Sections Hall of Fame existantes (record, podiums par saison, liste complète,
     participations) : **inchangées**, aucune régression attendue.
   - Rupture visuelle nette entre les deux halls (eyebrow + séparateur), puis section Hall of
     Shame :
     - Callout "Pire performance historique" (même structure que "Record historique"), teinté
       `border-loss/40 bg-loss/5` au lieu de `border-primary/40 bg-primary/5`, emoji 🍌, une
       phrase d'intro courte et légère.
     - Liste "Pires performances de tous les temps" : même layout que "Meilleures performances
       de tous les temps", ordre inversé (`worstEntries`), même logique de couleur par signe du
       rendement (`text-gain` / `text-loss`) déjà générique — pas de couleur forcée en rouge
       pour une performance positive mais simplement "la moins bonne de la saison".
   - Si `entries.length === 0` (aucune saison terminée), la section Hall of Shame ne s'affiche
     pas non plus — même garde que la section Hall of Fame existante.

3. **Tests** — extension de `hall-of-fame.test.ts` (même pattern de mock déjà en place) :
   - La photo de l'entrée la pire est bien récupérée (nouveau critère `{ promotionId,
     finalRank }` dans le mock `OR`).
   - `entries.at(-1)` reste correct avec des rendements négatifs et des égalités.
   - Cas à une seule entrée totale au global (fame = shame = même personne).
   - Cas `entries` vide (aucune régression sur le comportement déjà testé
     "renvoie des listes vides quand rien n'est terminé").

## Hors périmètre (explicitement exclu)

- Pas de "lanterne rouge" par saison (section 1 des décisions produit).
- Pas de section "participations" côté Shame (section 2).
- Pas de nouveau token de couleur / thème dédié — réutilisation de `--loss` existant.
- Pas de changement de la logique de clôture de promotion ni du schéma Prisma — la donnée est
  déjà complète.
- Pas de pagination/limite sur les listes complètes (le Hall of Fame existant n'en a pas non
  plus — cohérence, pas de scope creep).

## Risques / points d'attention pour le plan d'implémentation

- Vérifier que la requête séquentielle (au lieu de `Promise.all`) ne dégrade pas perceptiblement
  le temps de rendu de la page — page non cachée mais non pollée non plus, risque jugé faible.
- Le nouveau composant `hall-of-shame-section.tsx` doit rester un Server Component pur (pas de
  `"use client"`) pour cohérence avec le reste de la page.
