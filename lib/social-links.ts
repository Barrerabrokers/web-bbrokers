export const SOCIAL_LINKS = [
  {
    label: "Instagram",
    handle: "@barrera.brokers",
    href: "https://www.instagram.com/barrera.brokers",
    icon: "instagram",
  },
  {
    label: "TikTok",
    handle: "@barrera.brokers",
    href: "https://www.tiktok.com/@barrera.brokers",
    icon: "tiktok",
  },
  {
    label: "LinkedIn",
    handle: "Barrera Brokers",
    href: "https://www.linkedin.com/company/barrera-brokers",
    icon: "linkedin",
  },
].filter((link) => Boolean(link.href));

export const SOCIAL_SAME_AS = SOCIAL_LINKS.map((link) => link.href);
