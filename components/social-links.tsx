import { SOCIAL_LINKS } from "@/lib/social-links";

type SocialLinksProps = {
  variant?: "light" | "dark";
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
};

export function SocialLinks({
  variant = "light",
  compact = false,
  iconOnly = false,
  className = "",
}: SocialLinksProps) {
  const isDark = variant === "dark";
  const linkClass = isDark
    ? "hover:bg-black hover:text-white"
    : "border-ivory/15 text-ivory/55 hover:border-ivory/35 hover:bg-ivory/10 hover:text-ivory";
  const darkStyle = isDark
    ? {
        color: "#070707",
        borderColor: "rgba(7, 7, 7, 0.28)",
      }
    : undefined;

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
            iconOnly
              ? "h-9 w-9 justify-center"
              : compact
                ? "gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]"
                : "gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.18em]"
          }`}
          style={darkStyle}
          title={link.label}
        >
          <SocialIcon icon={link.icon} className={iconOnly ? "h-4 w-4" : "h-3.5 w-3.5"} />
          {!iconOnly && <span>{link.label}</span>}
        </a>
      ))}
    </div>
  );
}

function SocialIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  if (icon === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M15.7 3c.3 2.4 1.8 4 4.3 4.2v3.3c-1.5.1-2.9-.3-4.2-1.1v6.1c0 3.1-2.1 5.5-5.4 5.5-3 0-5.4-2-5.4-5.1 0-3.4 2.7-5.4 6-5.1v3.4c-1.5-.4-2.7.3-2.7 1.7 0 1.1.9 1.9 2 1.9 1.3 0 2.1-.8 2.1-2.5V3h3.3Z" />
      </svg>
    );
  }

  if (icon === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
        <path d="M14 8.1V6.7c0-.7.5-.9 1-.9h2V2.4L14.2 2C11.1 2 9.4 3.8 9.4 6.3v1.8H6.8v3.8h2.6V22H14V11.9h3.1l.5-3.8H14Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M6.9 8.9H3.6V20h3.3V8.9ZM5.2 4C4.1 4 3.4 4.7 3.4 5.7s.7 1.8 1.8 1.8S7 6.7 7 5.7 6.3 4 5.2 4ZM20.6 13.6c0-3.1-1.7-5-4.3-5-1.6 0-2.7.9-3.1 1.7h-.1V8.9H9.9V20h3.3v-5.5c0-1.5.7-2.5 2.1-2.5 1.2 0 1.9.8 1.9 2.5V20h3.3v-6.4Z" />
    </svg>
  );
}
