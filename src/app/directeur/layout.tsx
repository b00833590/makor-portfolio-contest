import { requireDirecteur } from "@/lib/dal";
import { SiteHeader } from "@/components/site-header";

export default async function DirecteurLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDirecteur();

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      {children}
    </>
  );
}
