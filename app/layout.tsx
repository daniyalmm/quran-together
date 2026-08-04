import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-quran-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "Quran Together",
  description: "Listen to the Quran and track your completion.",
  appleWebApp: {
    title: "Quran Together",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  other: {
    // Next's `appleWebApp.capable` only emits the newer, unprefixed
    // "mobile-web-app-capable" tag — iOS Safari (including fairly recent
    // versions) primarily honors the "apple-" prefixed one for standalone
    // (no browser chrome) mode when launched from the home screen.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A2119",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoNaskhArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <BottomNav />
      </body>
    </html>
  );
}
