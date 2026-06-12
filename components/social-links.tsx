import { SOCIAL_LINKS } from "@/lib/social-links";

type SocialLinksProps = {
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

export function SocialLinks({
  variant = "light",
  compact = false,
  className = "",
}: SocialLinksProps) {
  const isDark = variant === "dark";
  const linkClass = isDark
    ? "border-ink/15 text-ink/75 hover:border-ink/35 hover:bg-ink hover:text-bone"
    : "border-ivory/15 text-ivory/55 hover:border-ivory/35 hover:bg-ivory/10 hover:text-ivory";

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.label} de Barrera Brokers`}
          className={`inline-flex items-center rounded-full border transition-all duration-300 ${linkClass} ${
            compact
              ? "px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]"
              : "px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
          }`}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
