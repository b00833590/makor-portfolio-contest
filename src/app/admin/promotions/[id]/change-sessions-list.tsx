"use client";

import { ChangeSessionKind, ChangeSessionStatus } from "@/generated/prisma/enums";
import type { ChangeSessionEffectiveStatus } from "@/lib/trading/change-session-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { setChangeSessionStatus } from "./actions";
import { ChangeSessionRowActions } from "./change-session-row-actions";

export interface ChangeSessionViewModel {
  id: string;
  kind: ChangeSessionKind;
  effectiveStatus: ChangeSessionEffectiveStatus;
  label: string;
  /** "{ouverture} → {fermeture}", déjà formaté en heure de Paris. */
  windowLabel: string;
  durationLabel: string;
  opensAtLocal: string;
  closesAtLocal: string;
  maxChangesPerParticipant: number;
}

const statusLabels: Record<ChangeSessionEffectiveStatus, string> = {
  SCHEDULED: "Programmée",
  OPEN: "Ouverte",
  CLOSED: "Terminée",
};

const TABS: { value: ChangeSessionEffectiveStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "OPEN", label: "Ouvertes" },
  { value: "SCHEDULED", label: "Programmées" },
  { value: "CLOSED", label: "Terminées" },
];

export function ChangeSessionsList({
  promotionId,
  sessions,
}: {
  promotionId: string;
  sessions: ChangeSessionViewModel[];
}) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune session de changement pour le moment.</p>;
  }

  return (
    <Tabs defaultValue="ALL">
      <TabsList className="flex-wrap">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4 flex flex-col gap-4">
          {sessions
            .filter((session) => tab.value === "ALL" || session.effectiveStatus === tab.value)
            .map((session) => (
              <SessionCard key={session.id} promotionId={promotionId} session={session} />
            ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function SessionCard({ promotionId, session }: { promotionId: string; session: ChangeSessionViewModel }) {
  const isInitializationWindow = session.kind === ChangeSessionKind.INITIALIZATION;

  return (
    <Card className={isInitializationWindow ? "border-primary/50" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>{session.label}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.windowLabel} · {session.durationLabel} ·{" "}
            {isInitializationWindow ? "changements illimités" : `${session.maxChangesPerParticipant} changements max`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isInitializationWindow && <Badge variant="outline">Initialisation</Badge>}
          <Badge variant={session.effectiveStatus === "OPEN" ? "default" : "secondary"}>
            {statusLabels[session.effectiveStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {session.effectiveStatus !== "OPEN" && session.effectiveStatus !== "CLOSED" && (
          <form action={setChangeSessionStatus.bind(null, promotionId, session.id, ChangeSessionStatus.OPEN)}>
            <Button type="submit" variant="outline">
              Ouvrir maintenant
            </Button>
          </form>
        )}
        {session.effectiveStatus === "OPEN" && (
          <form action={setChangeSessionStatus.bind(null, promotionId, session.id, ChangeSessionStatus.CLOSED)}>
            <Button type="submit" variant="outline">
              Fermer maintenant
            </Button>
          </form>
        )}
        <ChangeSessionRowActions
          promotionId={promotionId}
          changeSessionId={session.id}
          kind={session.kind}
          label={session.label}
          opensAt={session.opensAtLocal}
          closesAt={session.closesAtLocal}
          maxChangesPerParticipant={session.maxChangesPerParticipant}
        />
      </CardContent>
    </Card>
  );
}
