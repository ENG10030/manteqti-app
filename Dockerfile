# مرحلة البناء
FROM node:20-alpine AS builder

# تثبيت bun
RUN npm install -g bun

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package.json bun.lock ./
COPY prisma ./prisma/

# تثبيت المتطلبات
RUN bun install --frozen-lockfile

# نسخ باقي الملفات
COPY . .

# بناء المشروع
RUN bun run build

# مرحلة الإنتاج
FROM node:20-alpine AS runner

WORKDIR /app

# إنشاء مستخدم غير root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# نسخ الملفات المطلوبة فقط
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# نسخ قاعدة البيانات
COPY --from=builder /app/db ./db

# تغيير الملكية
RUN chown -R nextjs:nodejs /app

# التبديل للمستخدم
USER nextjs

# المنفذ
EXPOSE 3000

# متغيرات البيئة
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# تشغيل التطبيق
CMD ["node", "server.js"]
