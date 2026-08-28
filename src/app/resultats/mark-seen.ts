"use server";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Mémorise (par appareil) que le participant a vu l'écran de résultats d'une
 * saison clôturée — le dashboard (Task 10) cesse alors de rediriger vers
 * /resultats. Écrite via une server action car les cookies sont en lecture
 * seule pendant le rendu RSC.
 */
export async function markResultsSeen(promotionId: string): Promise<void> {
  await verifySession();
  if (!/^[a-z0-9]{20,40}$/i.test(promotionId)) return;

  const store = await cookies();
  store.set(`seen_results_${promotionId}`, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}
