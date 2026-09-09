"use client";

import { useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { Input } from "@/components/ui/input";

export interface QuickSelectParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  promotionName: string;
}

export function ParticipantQuickSelect({ participants }: { participants: QuickSelectParticipant[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? participants.filter((participant) => participant.name.toLowerCase().includes(normalizedQuery))
    : participants;

  if (participants.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun participant actif pour le moment.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Rechercher un participant..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Rechercher un participant"
      />
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {filtered.map((participant) => (
          <Link
            key={participant.id}
            href={`/directeur/participants/${participant.id}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
          >
            <UserAvatar name={participant.name} avatarUrl={participant.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{participant.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{participant.promotionName}</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun résultat pour « {query} ».</p>
        )}
      </div>
    </div>
  );
}
