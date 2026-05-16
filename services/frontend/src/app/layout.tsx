import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";

import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap"
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Kid Poker Second Brain",
  description: "Play heads-up No-Limit Hold’em with Daniel Negreanu watching every hand."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${body.variable} ${display.variable} ${mono.variable}`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
