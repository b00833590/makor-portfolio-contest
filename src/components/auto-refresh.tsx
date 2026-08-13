"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPollIntervalMs, isMarketHours } from "@/lib/refresh-schedule";

/**
 * Ré-exécute le fetch des Server Components de la page courante à intervalle
 * régulier (`router.refresh()`), sans navigation ni perte de l'état client —
 * c'est ce qui fait apparaître automatiquement un nouveau prix, P&L, rang de
 * classement, etc. dès qu'il devient disponible en base, sans que le
 * participant ait besoin de recharger la page. Composant purement
 * comportemental, ne rend rien.
 *
 * En pause quand l'onglet n'est pas visible (`document.hidden`), pour ne pas
 * consommer de rafraîchissements pour un onglet en arrière-plan.
 *
 * Intervalle par défaut volontairement plus proche de la fraîcheur réelle
 * des données (prix rafraîchis au plus toutes les 10-15 min, snapshots de
 * performance calculés une fois par nuit) que d'un vrai temps réel : chaque
 * tick relance un recalcul complet du classement/des stats pour tous les
 * participants côté serveur, un intervalle de 10s multipliait inutilement
 * cette charge par ~6 pour une donnée qui ne change quasiment jamais aussi
 * vite.
 *
 * Intervalle remonté par étapes le 2026-08-13 (60s → 3 min → 5 min) après
 * analyse chiffrée de l'egress Supabase (quota gratuit dépassé, voir
 * docs/DEPLOIEMENT.md), puis fixé à 15 min une fois les requêtes de
 * page (leaderboard, dashboard, stats) mises en cache serveur partagé
 * (`unstable_cache`, voir get-leaderboard.ts et portfolio-view.ts) : cette
 * valeur n'a plus besoin d'être plus courte que la fenêtre de ce cache, qui
 * plafonne déjà l'egress indépendamment de la fréquence de poll — un tick
 * plus rapide ne ferait que réveiller l'onglet sans rien rafraîchir de plus
 * côté serveur. 15 min reste aussi sous STOCK_PRICE_STALE_MS (10-15 min) :
 * les prix actions ne changent de toute façon jamais plus vite.
 *
 * Sans `intervalMs` explicite, la cadence suit les horaires de marché
 * (`src/lib/refresh-schedule.ts`, heure de Paris) : 30 min de 9h à 15h30
 * (Europe ouverte, US fermée), 15 min de 15h30 à 22h (Europe + US
 * ouvertes), et **aucun rafraîchissement entre 22h et 9h** — marchés
 * fermés, rien de nouveau à afficher. Pendant cette fenêtre nocturne, le
 * composant continue de se réveiller (à la cadence de 30 min) pour
 * détecter la réouverture à 9h, mais sans jamais appeler
 * `router.refresh()` tant que `isMarketHours()` est faux. `setTimeout`
 * récursif plutôt que `setInterval` fixe : chaque tick recalcule le délai
 * et réévalue les horaires, pour s'adapter correctement si l'onglet reste
 * ouvert à cheval sur une bascule de palier. `intervalMs` reste utilisable
 * pour forcer une cadence fixe, y compris hors marché, si un cas
 * particulier en avait besoin.
 */
export function AutoRefresh({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = intervalMs ?? getPollIntervalMs();
      timeoutId = setTimeout(() => {
        if (!document.hidden && (intervalMs !== undefined || isMarketHours())) {
          routerRef.current.refresh();
        }
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [intervalMs]);

  return null;
}
