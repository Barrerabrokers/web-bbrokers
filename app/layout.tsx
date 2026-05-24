import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers — Real Estate Excellence",
  description:
    "Premium real estate experiences. Expertos en propiedades de lujo, desarrollos, inversiones y oportunidades exclusivas.",
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
    <html lang="es" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans bg-cream-200 text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
