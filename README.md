# منطقتي | Manteqti

<p align="center">
  <strong>لوحة إدارة الشقق الذكية</strong>
</p>

<p align="center">
  <a href="#-المميزات">المميزات</a> •
  <a href="#-التثبيت">التثبيت</a> •
  <a href="#-النشر">النشر</a> •
  <a href="#-الاستخدام">الاستخدام</a>
</p>

---

## ✨ المميزات

- 🏠 إدارة الشقق والعقارات
- 🔐 نظام موافقة المطور على الشقق الجديدة
- 💰 نظام دفع لعرض بيانات التواصل
- 📊 لوحة تحكم المطور
- 🤖 مساعد ذكي للرد على الاستفسارات
- 🌙 الوضع الليلي
- 📱 تصميم متجاوب للجوال

---

## 🚀 التثبيت المحلي

```bash
# استنساخ المشروع
git clone https://github.com/USERNAME/manteqti.git
cd manteqti

# تثبيت التبعيات
bun install

# إعداد قاعدة البيانات
cp .env.example .env
bun run db:push

# تشغيل التطبيق
bun run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

---

## 🌍 النشر

### الخيار 1: Vercel (الأسهل - مجاني)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/USERNAME/manteqti)

**الخطوات:**

1. اضغط على الزر أعلاه
2. سجل في Vercel باستخدام GitHub
3. اربط المستودع
4. أضف متغيرات البيئة:
   ```
   DATABASE_URL=file:./dev.db
   DEVELOPER_EMAIL=your-email@example.com
   DEVELOPER_PASSWORD=your-secure-password
   ```
5. اضغط Deploy

### الخيار 2: VPS (للإنتاج)

```bash
# 1. استأجر VPS من Hetzner أو DigitalOcean

# 2. اتصل بالخادم
ssh root@YOUR_SERVER_IP

# 3. حمل سكربت الإعداد
curl -fsSL https://raw.githubusercontent.com/USERNAME/manteqti/main/scripts/setup-vps.sh | bash

# 4. اتبع التعليمات
```

### الخيار 3: Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/manteqti)

---

## 📋 متغيرات البيئة

| المتغير | الوصف | مطلوب |
|---------|-------|-------|
| `DATABASE_URL` | رابط قاعدة البيانات | ✅ |
| `DEVELOPER_EMAIL` | بريد المطور | ✅ |
| `DEVELOPER_PASSWORD` | كلمة مرور المطور | ✅ |
| `NEXTAUTH_SECRET` | مفتاح الأمان (32 حرف) | ⚪ |
| `NEXTAUTH_URL` | رابط الموقع | ⚪ |

---

## 🎯 الاستخدام

### بيانات المطور الافتراضية
```
البريد: ahmadmamdouh10030@gmail.com
كلمة المرور: admin123
```

⚠️ **غيّر كلمة المرور في الإنتاج!**

### نظام الموافقة على الشقق

1. أي شخص يمكنه إضافة شقة جديدة
2. الشقة تظهر بحالة "في انتظار الموافقة"
3. المطور يرى الشقق المعلقة في لوحة التحكم
4. المطور يوافق أو يرفض الشقة
5. بعد الموافقة، تظهر الشقة للجميع

### الحذف التلقائي بعد 48 ساعة

عند تغيير حالة الشقة إلى:
- ✅ **تم البيع** (sold)
- ✅ **غير متاح** (unavailable)
- ✅ **تم التأجير** (rented)

سيتم **حذف الشقة تلقائياً بعد 48 ساعة** من تغيير الحالة.

**ملاحظة:** يتطلب هذا تشغيل Cron Job. على Vercel، يتم التشغيل تلقائياً كل ساعة.

---

## 🔧 المطورون

```bash
# تشغيل في وضع التطوير
bun run dev

# بناء للإنتاج
bun run build

# تشغيل الإنتاج
bun run start

# فحص الكود
bun run lint
```

---

## 📁 هيكل المشروع

```
manteqti/
├── prisma/
│   └── schema.prisma      # قاعدة البيانات
├── src/
│   ├── app/
│   │   ├── api/           # API Routes
│   │   ├── page.tsx       # الصفحة الرئيسية
│   │   └── layout.tsx     # التخطيط
│   ├── components/ui/     # مكونات UI
│   ├── hooks/             # React Hooks
│   └── lib/               # المكتبات
├── public/                # الملفات الثابتة
└── scripts/               # سكربتات الإعداد
```

---

## 🔒 الأمان

- ✅ Rate Limiting
- ✅ Input Validation
- ✅ XSS Protection
- ✅ CSRF Protection
- ✅ Secure Headers

---

## 📄 الرخصة

MIT License - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

<p align="center">
  صنع بـ ❤️ لمنطقة
</p>
