import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";

export function UserAvatar({
  name,
  avatarUrl,
  size = "default",
  className,
  style,
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Avatar size={size} className={className} style={style}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className="bg-secondary font-medium">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
