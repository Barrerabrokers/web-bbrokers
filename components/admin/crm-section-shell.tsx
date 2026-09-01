import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type CrmSectionShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function CrmSectionShell({
  eyebrow,
  title,
  description,
  children,
}: CrmSectionShellProps) {
  return (
    <main className="bg-cream-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-md border border-ink/12 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">{description}</p>
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      </div>
    </main>
  );
}

export function CrmSectionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-ink/12 bg-white p-5 transition-colors hover:border-ink/28 hover:bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
    >
      <span className="flex items-center justify-between gap-4">
        <span className="text-lg font-semibold text-ink">{title}</span>
        <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-1" />
      </span>
      <span className="mt-3 block text-sm leading-6 text-ink/58">{description}</span>
    </Link>
  );
}
