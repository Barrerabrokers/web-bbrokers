import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  title: "Barrera Brokers — A Private Real Estate Assembly",
  description:
    "Barrera Brokers coordina propiedades, inversiones y oportunidades discretas en Buenos Aires. Acompanamos cada decision patrimonial con cuidado y experiencia.",
  keywords: [
    "bienes raices",
    "propiedades de lujo",
    "inmobiliaria premium",
    "inversiones",
    "Barrera Brokers",
    "Buenos Aires",
  ],
  authors: [{ name: "Barrera Brokers" }],
  openGraph: {
    title: "Barrera Brokers — A Private Real Estate Assembly",
    description: "Coordinated real estate across Buenos Aires.",
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
      </body>
    </html>
  );
}
