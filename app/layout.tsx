import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Barrera Brokers - Real Estate Excellence",
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
    title: "Barrera Brokers - Real Estate Excellence",
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
    <html lang="es" className={`${inter.variable} dark`}>
      <body className="font-sans bg-gray-950 text-gray-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
