import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  
  // ✅ Headers أمنية (مخففة لبيئة التطوير)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // حماية من XSS
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // حماية من Referrer
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=(self)',
              'interest-cohort=()',
            ].join(', '),
          },
        ],
      },
    ];
  },
  
  // ✅ إعدادات إضافية
  poweredByHeader: false, // إخفاء X-Powered-By
  compress: true, // ضغط البيانات
  
  // ✅ إعدادات الصور
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default config;
