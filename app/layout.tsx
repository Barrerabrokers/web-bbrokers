import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Barrera Brokers - Real Estate Excellence",
  description: "Premium real estate experiences. Expertos en propiedades de lujo, desarrollos, inversiones y oportunidades exclusivas.",
  keywords: ["bienes raíces", "propiedades de lujo", "inmobiliaria premium", "inversiones", "Barrera Brokers"],
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
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans bg-white text-charcoal-900 antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
