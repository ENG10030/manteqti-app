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
  title: "منطقتي - لوحة الشقق الذكية | AI-Powered Apartments",
  description: "لوحة تحكم ذكية للشقق العقارية مع مساعد ذكاء اصطناعي. ابحث عن شقق للإيجار والبيع في مصر مع توصيات ذكية.",
  keywords: ["شقق", "إيجار", "بيع", "عقارات", "مصر", "القاهرة", "الإسكندرية", "ذكاء اصطناعي", "apartments", "rent", "sale"],
  authors: [{ name: "منطقتي" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "منطقتي - لوحة الشقق الذكية",
    description: "ابحث عن شقة أحلامك مع المساعد الذكي",
    type: "website",
  },
};

// Ultra-aggressive extension error suppression script
// This runs BEFORE any other script to catch MetaMask and other extension errors
const suppressExtensionErrorsScript = `(function(){
  var p=['metamask','chrome-extension','inpage.js','contentscript','nkbihfbeogaeaoehlefnkodbefgpgknn','Failed to connect','ethereum','web3','wallet','injected script'];
  var m=function(s){if(!s)return!1;var t=(s.message||s.reason||s.stack||s.filename||'').toString().toLowerCase();return p.some(function(w){return t.indexOf(w)!==-1})};
  
  var cE=console.error,cW=console.warn;
  console.error=function(){try{var a=Array.from(arguments).join(' ');if(!m(a))cE.apply(console,arguments)}catch(e){}};
  console.warn=function(){try{var a=Array.from(arguments).join(' ');if(!m(a))cW.apply(console,arguments)}catch(e){}};
  
  var hE=function(e){if(m(e)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return!1}};
  
  if(typeof window!=='undefined'){
    window.addEventListener('error',hE,!0);
    window.addEventListener('unhandledrejection',function(e){if(m(e)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}},!0);
    
    try{
      var dE=window.dispatchEvent;
      window.dispatchEvent=function(e){if(e&&(e.type==='error'||e.type==='unhandledrejection')&&m(e))return!1;return dE.call(window,e)};
    }catch(e){}
    
    try{Object.defineProperty(window,'ethereum',{get:function(){return undefined},set:function(){},configurable:!0})}catch(e){}
    try{Object.defineProperty(window,'web3',{get:function(){return undefined},set:function(){},configurable:!0})}catch(e){}
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: suppressExtensionErrorsScript }} />
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
