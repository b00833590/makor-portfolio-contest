import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatParisDate } from "@/lib/timezone";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarEditor } from "./avatar-editor";

export default async function ProfilePage() {
  const session = await verifySession();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={user.avatarUrl} />
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Photo de profil</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarEditor name={user.name} avatarUrl={user.avatarUrl} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-muted-foreground">Identifiant</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-muted-foreground">Rôle</span>
              <span className="font-medium">{user.role === "ADMIN" ? "Administrateur" : "Participant"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Membre depuis</span>
              <span className="font-medium">{formatParisDate(user.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Sécurité</CardTitle>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/change-password" />} nativeButton={false} variant="outline">
              Changer mon mot de passe
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
