import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "منطقتي | Manteqti - لوحة الشقق الذكية",
  description: "تطبيق عقارات ذكي للبحث عن الشقق للإيجار والبيع في مصر. أضف عقارك أو ابحث عن شقة أحلامك بسهولة.",
  keywords: ["عقارات", "شقق", "إيجار", "بيع", "مصر", "منطقتي", "Manteqti", "عقارات مصر"],
  authors: [{ name: "Manteqti Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "منطقتي | Manteqti - لوحة الشقق الذكية",
    description: "تطبيق عقارات ذكي للبحث عن الشقق للإيجار والبيع في مصر",
    url: "https://manteqti-app.vercel.app",
    siteName: "منطقتي | Manteqti",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "منطقتي | Manteqti - لوحة الشقق الذكية",
    description: "تطبيق عقارات ذكي للبحث عن الشقق للإيجار والبيع في مصر",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#7c3aed" />
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:;" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
