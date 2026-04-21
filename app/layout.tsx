import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
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
        {children}
      </body>
    </html>
  );
}
