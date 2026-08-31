import type { ReactNode } from "react";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getContactMethods, SITE_CONTACT, type ContactMethod } from "@/lib/site-contact";
import { getInitials } from "@/lib/avatar";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Icônes de marque absentes de lucide — tracés simple-icons, une seule <path>. */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function MethodIcon({ kind, className }: { kind: ContactMethod["kind"]; className?: string }) {
  if (kind === "email") return <Mail className={className} />;
  if (kind === "phone") return <Phone className={className} />;
  if (kind === "linkedin") return <LinkedInIcon className={className} />;
  return <InstagramIcon className={className} />;
}

function ContactCard({ method }: { method: ContactMethod }) {
  const inner: ReactNode = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover/contact:bg-primary/15">
        <MethodIcon kind={method.kind} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{method.label}</span>
        <span className="truncate text-sm font-medium text-foreground">{method.display}</span>
      </span>
      {method.href && (
        <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover/contact:text-primary" />
      )}
    </>
  );

  const className = cn(
    "group/contact flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors",
    method.href && "hover:ring-primary/40",
  );

  if (!method.href) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <a
      href={method.href}
      target={method.external ? "_blank" : undefined}
      rel={method.external ? "noopener noreferrer" : undefined}
      className={cn(className, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {inner}
    </a>
  );
}

export default async function ContactPage() {
  const session = await verifySession();
  const methods = getContactMethods();

  return (
    <>
      <SiteHeader name={session.user.name} role={session.user.role} avatarUrl={session.user.avatarUrl} />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Besoin d&apos;aide&nbsp;?</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Une question sur le concours, un bug, une demande sur la plateforme&nbsp;? Voici la personne à
          contacter — elle gère le site et pourra vous répondre ou faire remonter le problème.
        </p>

        <Card className="mt-8 flex-row items-center gap-4 p-5 sm:p-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
            {getInitials(SITE_CONTACT.name)}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">{SITE_CONTACT.name}</p>
            <p className="text-sm text-muted-foreground">{SITE_CONTACT.role}</p>
          </div>
        </Card>

        {methods.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {methods.map((method) => (
              <ContactCard key={method.kind} method={method} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
            Les coordonnées ne sont pas encore renseignées. Elles se modifient dans un seul fichier&nbsp;:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">src/lib/site-contact.ts</code>.
          </p>
        )}

        <p className="mt-8 text-xs text-muted-foreground/80">
          Pour toute urgence liée au déroulement du concours, privilégiez le téléphone ou l&apos;e-mail.
        </p>
      </div>
    </>
  );
}
