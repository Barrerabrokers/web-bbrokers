import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CursorTrail } from "@/components/cursor-trail";

// Switzer alternative: Plus Jakarta Sans (modern geometric sans, similar proportions)
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// OTJubilee-Platinum / Voyage alternative: Cormorant Garamond (high-contrast serif)
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers — Desarrollos en la ciudad de Buenos Aires",
  description:
    "Barrera Brokers desarrolla, comercializa y administra propiedades en la ciudad de Buenos Aires. Mas de 25 anos de experiencia en venta, alquiler, inversiones y desarrollos inmobiliarios.",
  keywords: [
    "bienes raices",
    "desarrollos inmobiliarios",
    "propiedades Buenos Aires",
    "inmobiliaria",
    "inversiones",
    "Barrera Brokers",
    "Buenos Aires",
  ],
  authors: [{ name: "Barrera Brokers" }],
  openGraph: {
    title: "Barrera Brokers — Desarrollos en la ciudad de Buenos Aires",
    description: "Desarrollos, propiedades e inversiones inmobiliarias en Buenos Aires.",
    url: "https://barrerabrokers.com",
    siteName: "Barrera Brokers",
    locale: "es_ES",
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
      <body className="font-sans bg-bone text-ink antialiased">
        <Providers>{children}</Providers>
        <CursorTrail />
      </body>
    </html>
  );
}
