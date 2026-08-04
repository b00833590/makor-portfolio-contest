"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) routerRef.current.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return null;
}
