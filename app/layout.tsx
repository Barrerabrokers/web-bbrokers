import { Suspense } from "react";
import { MetaWebsiteTracking } from "@/components/meta-website-tracking";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { cachedSiteEnglish } from "@/lib/i18n/translation";
import { SiteLanguageProvider } from "@/components/i18n/site-language";
import { localizePublicMetadata } from "@/lib/i18n/metadata";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CursorTrail } from "@/components/cursor-trail";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ObsidianMotion } from "@/components/obsidian-motion";
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
  SEO_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { getSiteSettings } from "@/lib/db";
import { unstable_cache } from "next/cache";

const getCachedSiteSettings=unstable_cache(getSiteSettings,["site-settings-metadata"],{revalidate:300,tags:["site-settings"]});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

async function spanishMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings();
  return {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_SEO_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
  manifest: "/manifest.webmanifest",
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [{ url: settings.faviconUrl }],
    shortcut: settings.faviconUrl,
    apple: [{ url: settings.faviconUrl }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
  },
  };
}

export async function generateMetadata(): Promise<Metadata> { return localizePublicMetadata(await spanishMetadata()); }

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language=(await headers()).get("x-public-language")==="en"?"en":"es";
  const translations=language==='en'?await cachedSiteEnglish().catch(()=>({})):undefined;
  return (
    <html lang={language} className={`${plusJakarta.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-obsidian text-ivory antialiased">
        <Providers>
          <Suspense fallback={null}><MetaWebsiteTracking /></Suspense>
          <SiteLanguageProvider initialLanguage={language} initialTranslations={translations}>
          {children}
          <WhatsAppButton />
                  </SiteLanguageProvider>
        </Providers>
        <ObsidianMotion />
        <CursorTrail />
      </body>
    </html>
  );
}
