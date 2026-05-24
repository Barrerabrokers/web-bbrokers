import type { Metadata } from "next";
import { Urbanist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Same fonts as stewartcorealty.com
const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers — Buenos Aires Real Estate Experts",
  description:
    "Especialistas en propiedades exclusivas de Buenos Aires. Mas de 20 anos acompanando a quienes buscan invertir, habitar y rentabilizar las mejores propiedades.",
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
    title: "Barrera Brokers — Buenos Aires Real Estate Experts",
    description: "Premium real estate experiences en Buenos Aires",
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
    <html lang="es" className={`${urbanist.variable} ${cormorant.variable}`}>
      <body className="font-sans bg-white text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
