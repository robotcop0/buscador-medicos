import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Analytics from "@/components/Analytics";
import CookieConsent from "@/components/CookieConsent";
import BackButton from "@/components/BackButton";
import SmoothScroll from "@/components/SmoothScroll";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Buscador de Médicos — Encuentra tu especialista por mutua y zona",
  description:
    "Busca médicos por mutua, especialidad y código postal. Compara ratings y reseñas para encontrar el mejor especialista cerca de ti.",
  keywords: [
    "buscador médicos",
    "médicos por mutua",
    "especialistas",
    "Adeslas",
    "Sanitas",
    "DKV",
  ],
  openGraph: {
    title: "Buscador de Médicos",
    description:
      "Encuentra tu médico por mutua, especialidad y código postal.",
    type: "website",
    locale: "es_ES",
  },
  verification: {
    // Verificación de propiedad en Google Search Console (método etiqueta HTML).
    // Next lo emite como <meta name="google-site-verification"> en el <head>.
    google: "VpZe5VQw7OVjXJmV5XWx2BAdVAIpaWiQqI2w9-t7jYs",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-[#f7f6f3] text-gray-900 font-sans antialiased">
        <SmoothScroll />
        <BackButton />
        {children}
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
