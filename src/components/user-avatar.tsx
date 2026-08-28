import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";

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
  return (
    <Avatar size={size} className={className} style={style}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className={`bg-secondary font-medium ${fallbackClassName ?? ""}`}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
