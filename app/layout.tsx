import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Barrera Brokers - Expertos en Bienes Raíces",
  description: "Encuentra tu propiedad ideal. Expertos en propiedades en desarrollo, pozo, usados, rentals e inversiones.",
  keywords: ["bienes raíces", "propiedades", "inmobiliaria", "casas", "departamentos", "inversiones"],
  authors: [{ name: "Barrera Brokers" }],
  openGraph: {
    title: "Barrera Brokers - Expertos en Bienes Raíces",
    description: "Encuentra tu propiedad ideal",
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
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
