import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Fraunces: alternativa Google Fonts a Saans/SerrifCompressed.
// Variable font (no weight array, usa axis variable).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers — Real Estate Excellence",
  description:
    "Acompanamos a quienes buscan invertir, habitar y rentabilizar las propiedades mas exclusivas de Buenos Aires. Mas de 20 anos de experiencia.",
  keywords: [
    "bienes raices",
    "propiedades de lujo",
    "inmobiliaria premium",
    "inversiones",
    "Barrera Brokers",
  ],
  authors: [{ name: "Barrera Brokers" }],
  openGraph: {
    title: "Barrera Brokers — Real Estate Excellence",
    description: "Premium real estate experiences",
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
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans bg-cream-100 text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
