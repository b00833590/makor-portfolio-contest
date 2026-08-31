"use client";

import { useState, type CSSProperties } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * Photo de profil circulaire avec repli initiales.
 *
 * Le `<img>` est rendu directement (pas via `Avatar.Image` de base-ui, qui ne
 * monte l'image qu'après un chargement côté client via `new Image()` — invisible
 * au rendu serveur et fragile). Ici l'image est dans le HTML SSR et s'affiche
 * immédiatement ; `object-cover` évite toute déformation ; `onError` retombe
 * proprement sur les initiales si l'URL est cassée.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = "default",
  className,
  fallbackClassName,
  style,
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Pour les avatars agrandis (podium, vainqueur) : sinon les initiales
   *  restent en text-sm dans un grand cercle. */
  fallbackClassName?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Avatar size={size} className={className} style={style}>
      {avatarUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar en data: URL, next/image ne l'optimise pas ; le <img> SSR est justement le but (voir le commentaire du composant)
        <img
          src={avatarUrl}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="aspect-square size-full rounded-full object-cover"
        />
      ) : (
        <AvatarFallback className={cn("bg-secondary font-medium", fallbackClassName)}>
          {getInitials(name)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
