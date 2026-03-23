import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "منطقتي - عقارات مصر",
  description: "منصة عقارية متكاملة للبحث عن شقق وعقارات في مصر. إيجار، بيع، شقق، فيلات وأكثر.",
  keywords: ["عقارات", "مصر", "شقق", "إيجار", "بيع", "فيلا", "منطقتي", "عقارات مصر"],
  authors: [{ name: "منطقتي" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "منطقتي - عقارات مصر",
    description: "منصة عقارية متكاملة للبحث عن شقق وعقارات في مصر",
    url: "https://manteqti-app.vercel.app",
    siteName: "منطقتي",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "منطقتي - عقارات مصر",
    description: "منصة عقارية متكاملة للبحث عن شقق وعقارات في مصر",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
