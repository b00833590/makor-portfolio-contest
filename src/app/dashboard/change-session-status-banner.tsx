"use client";

import { useEffect, useState } from "react";
import { formatParisDateTime } from "@/lib/timezone";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

interface ChangeSessionStatusBannerProps {
  status: "OPEN" | "UPCOMING";
  /** ISO string — les composants client ne doivent pas recevoir de `Date` directement depuis un Server Component. */
  opensAt: string;
  closesAt: string;
}

/**
 * Renseigne le participant sur la session de changement en cours ou à venir :
 * badge "Ouverte" + compte à rebours jusqu'à la fermeture si une session est
 * active, ou "Prochaine session" + compte à rebours jusqu'à l'ouverture sinon.
 * Reprend le pattern déjà en place dans InitializationWindowBanner (mêmes
 * classes, même mécanique de compte à rebours côté client).
 */
export function ChangeSessionStatusBanner({ status, opensAt, closesAt }: ChangeSessionStatusBannerProps) {
  const targetMs = new Date(status === "OPEN" ? closesAt : opensAt).getTime();
  const [remainingMs, setRemainingMs] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemainingMs(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const windowLabel = `${formatParisDateTime(new Date(opensAt))} → ${formatParisDateTime(new Date(closesAt))}`;

  if (status === "OPEN") {
    const isClosed = remainingMs <= 0;
    return (
      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">🟢 Session de changement ouverte</p>
          <p className="tabular-nums">{isClosed ? "Fermeture en cours..." : `⏱ Ferme dans ${formatRemaining(remainingMs)}`}</p>
        </div>
        <p className="mt-1 text-muted-foreground">{windowLabel}</p>
      </div>
    );
  }

  const hasOpened = remainingMs <= 0;
  return (
    <div className="mt-4 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">📅 Prochaine session de changement</p>
        <p className="tabular-nums">{hasOpened ? "Ouverture en cours..." : `⏳ Ouvre dans ${formatRemaining(remainingMs)}`}</p>
      </div>
      <p className="mt-1 text-muted-foreground">{windowLabel}</p>
    </div>
  );
}
