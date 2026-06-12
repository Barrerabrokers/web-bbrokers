export const SOCIAL_LINKS = [
  {
    label: "Instagram",
    handle: "@barrera.brokers",
    href: "https://www.instagram.com/barrera.brokers",
  },
  {
    label: "TikTok",
    handle: "@barrera.brokers",
    href: "https://www.tiktok.com/@barrera.brokers",
  },
  {
    label: "LinkedIn",
    handle: "Barrera Brokers",
    href: "https://www.linkedin.com/company/barrera-brokers",
  },
].filter((link) => Boolean(link.href));

export const SOCIAL_SAME_AS = SOCIAL_LINKS.map((link) => link.href);
