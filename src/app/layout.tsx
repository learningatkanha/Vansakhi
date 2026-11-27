import type { Metadata } from "next";
import { Mukta, Spectral } from "next/font/google";
import "./globals.css";

// Mukta: made for English and Hindi (Devanagari), for everything you read and tap.
const mukta = Mukta({ variable: "--font-mukta", subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"] });
// Spectral: a book serif for titles, species names (its italic for scientific names) and journal reading.
const spectral = Spectral({ variable: "--font-spectral", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Vansakhi",
  description: "The team's field journal for Kanha: sightings, photos and journal entries in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mukta.variable} ${spectral.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
