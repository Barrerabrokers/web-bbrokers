import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CursorTrail } from "@/components/cursor-trail";
import { SmoothScroll } from "@/components/smooth-scroll";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers — Desarrollos Inmobiliarios en Buenos Aires",
  description:
    "Desarrollos en pozo, renta temporaria e inversiones inmobiliarias premium en Buenos Aires. Más de 25 años de experiencia.",
  keywords: [
    "desarrollos inmobiliarios",
    "inversión en pozo",
    "Buenos Aires",
    "renta temporaria",
    "Barrera Brokers",
  ],
  openGraph: {
    title: "Barrera Brokers — Desarrollos Inmobiliarios",
    description: "Inversiones inmobiliarias premium en Buenos Aires.",
    siteName: "Barrera Brokers",
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${plusJakarta.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-obsidian text-ivory antialiased">
        <Providers>{children}</Providers>
        <SmoothScroll />
        <CursorTrail />
      </body>
    </html>
  );
}
