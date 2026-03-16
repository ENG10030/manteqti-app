# 🚀 دليل نشر منطقتي على سيرفر مجاني

## نظرة عامة
هذا الدليل سي帮助你 في نشر تطبيق "منطقتي" على سيرفر مجاني باستخدام:
- **Vercel** - لاستضافة التطبيق (مجاني)
- **Supabase** - لقاعدة البيانات PostgreSQL (مجاني)

---

## 📋 المتطلبات
1. حساب GitHub
2. حساب Vercel (يمكن التسجيل بـ GitHub)
3. حساب Supabase (يمكن التسجيل بـ GitHub)

---

## الخطوة 1: إنشاء قاعدة بيانات Supabase

### 1.1 التسجيل في Supabase
1. اذهب إلى [supabase.com](https://supabase.com)
2. اضغط "Start your project"
3. سجل باستخدام GitHub

### 1.2 إنشاء مشروع جديد
1. اضغط "New Project"
2. اختر اسم المشروع: `manteqti`
3. أدخل كلمة مرور قوية لقاعدة البيانات ⚠️ (احفظها جيداً!)
4. اختر أقرب منطقة: `Middle East` أو `Europe`
5. اضغط "Create new project"

### 1.3 الحصول على روابط قاعدة البيانات
1. انتظر حتى يتم إنشاء المشروع (دقيقة تقريباً)
2. اذهب إلى **Settings** (أيقونة الترس) → **Database**
3. ابحث عن قسم **Connection string**
4. اختر **URI** من التبويبات

**الحصول على DATABASE_URL:**
- انسخ الرابط من **Connection string** 
- اختر **Mode: Session** أو **Transaction**
- استبدل `[YOUR-PASSWORD]` بكلمة المرور التي أدخلتها عند إنشاء المشروع
- أضف `?pgbouncer=true` في نهاية الرابط

**مثال:**
```
DATABASE_URL="postgresql://postgres.xxxxxxxx:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**الحصول على DIRECT_DATABASE_URL:**
- نفس الرابط لكن بدون `?pgbouncer=true` ومنفذ 5432:
```
DIRECT_DATABASE_URL="postgresql://postgres.xxxxxxxx:YOUR_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

---

## الخطوة 2: رفع المشروع إلى GitHub

### 2.1 إنشاء Repository جديد
1. اذهب إلى [github.com](https://github.com)
2. اضغط "+" → "New repository"
3. أدخل اسم المشروع: `manteqti`
4. اختر **Private** أو **Public**
5. اضغط "Create repository"

### 2.2 رفع الكود
افتح Terminal في مجلد المشروع واكتب:

```bash
# تهيئة Git
git init

# إضافة جميع الملفات
git add .

# إنشاء commit
git commit -m "Initial commit - Manteqti Apartments Dashboard"

# تغيير الفرع إلى main
git branch -M main

# ربط المستودع البعيد (استبدل YOUR_USERNAME باسم المستخدم الخاص بك)
git remote add origin https://github.com/YOUR_USERNAME/manteqti.git

# رفع الكود
git push -u origin main
```

---

## الخطوة 3: نشر المشروع على Vercel

### 3.1 التسجيل في Vercel
1. اذهب إلى [vercel.com](https://vercel.com)
2. اضغط "Sign Up"
3. اختر "Continue with GitHub"

### 3.2 استيراد المشروع
1. في Dashboard، اضغط **"Add New..."** → **"Project"**
2. اختر repository `manteqti`
3. اضغط **"Import"**

### 3.3 إعداد متغيرات البيئة ⚠️ مهم جداً!
قبل الضغط على Deploy، اذهب إلى **Environment Variables** وأضف المتغيرات التالية:

| الاسم | القيمة | ملاحظة |
|-------|--------|--------|
| `DATABASE_URL` | رابط Supabase مع `?pgbouncer=true` | من الخطوة 1.3 |
| `DIRECT_DATABASE_URL` | رابط Supabase المباشر | من الخطوة 1.3 |
| `NEXTAUTH_SECRET` | نص عشوائي طويل (32+ حرف) | مثل: `my-super-secret-key-12345678` |
| `DEVELOPER_EMAIL` | بريد المطور | لتسجيل الدخول كمطور |
| `DEVELOPER_PASSWORD` | كلمة مرور المطور | غيّرها في الإنتاج! |
| `CRON_SECRET` | نص عشوائي | للحماية من الوصول غير المصرح |

### 3.4 إعداد Build Command
في قسم **Build and Output Settings**:
- **Build Command**: اتركه افتراضي (سيستخدم vercel.json)

### 3.5 النشر
1. اضغط **"Deploy"**
2. انتظر حتى ينتهي البناء (2-5 دقائق)
3. ستظهر لك رسالة نجاح مع رابط الموقع!

🎉 **مبارك! موقعك الآن متاح على الإنترنت!**

---

## الخطوة 4: تشغيل Migration (إنشاء الجداول)

بعد أول نشر، تحتاج لإنشاء جداول قاعدة البيانات:

### الطريقة 1: عبر Vercel CLI (موصى بها)

```bash
# تثبيت Vercel CLI
npm i -g vercel

# تسجيل الدخول
vercel login

# ربط المشروع
vercel link

# سحب متغيرات البيئة
vercel env pull .env.production.local

# تشغيل Migration
npx prisma migrate deploy --schema=prisma/schema.postgres.prisma
```

### الطريقة 2: عبر Supabase SQL Editor
1. اذهب إلى Supabase Dashboard
2. اختر مشروعك
3. اضغط **SQL Editor**
4. اضغط **New Query**
5. الصق الكود التالي واضغط **Run**:

```sql
-- إنشاء جدول المستخدمين
CREATE TABLE "users" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT UNIQUE,
    "name" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "otp" TEXT,
    "otp_expires" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP
);

-- إنشاء جدول الشقق
CREATE TABLE "apartments" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "price" INTEGER,
    "area" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "owner_phone" TEXT,
    "map_link" TEXT,
    "image_url" TEXT,
    "images" TEXT,
    "video_url" TEXT,
    "videos" TEXT,
    "amenities" TEXT,
    "featured" BOOLEAN DEFAULT FALSE,
    "type" TEXT,
    "status" TEXT DEFAULT 'pending',
    "status_changed_at" TIMESTAMP,
    "views" INTEGER DEFAULT 0,
    "payment_ref" TEXT,
    "agreement_status" TEXT,
    "created_by" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP
);

-- إنشاء الفهارس
CREATE INDEX idx_apartments_status ON "apartments"("status");
CREATE INDEX idx_apartments_type ON "apartments"("type");
CREATE INDEX idx_apartments_area ON "apartments"("area");

-- إنشاء جدول الاستفسارات
CREATE TABLE "inquiries" (
    "id" TEXT PRIMARY KEY,
    "apartment_id" TEXT REFERENCES "apartments"("id") ON DELETE CASCADE,
    "user_id" TEXT REFERENCES "users"("id"),
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "lifecycle_status" TEXT DEFAULT 'New',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP
);

-- إنشاء جدول المدفوعات
CREATE TABLE "payments" (
    "id" TEXT PRIMARY KEY,
    "inquiry_id" TEXT UNIQUE REFERENCES "inquiries"("id") ON DELETE CASCADE,
    "method" TEXT,
    "status" TEXT DEFAULT 'Pending',
    "inquiry_status" TEXT DEFAULT 'Contacted',
    "amount" INTEGER,
    "transaction_ref" TEXT,
    "payment_link" TEXT,
    "user_id" TEXT REFERENCES "users"("id"),
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP
);

-- إنشاء جدول الإعدادات
CREATE TABLE "settings" (
    "id" TEXT PRIMARY KEY,
    "contact_fee" INTEGER DEFAULT 50,
    "featured_fee" INTEGER DEFAULT 100,
    "premium_fee" INTEGER DEFAULT 200,
    "sale_display_fee" INTEGER DEFAULT 100,
    "rent_display_fee" INTEGER DEFAULT 75,
    "other_services_fee" INTEGER DEFAULT 50,
    "highlight_fee" INTEGER DEFAULT 150,
    "priority_listing_fee" INTEGER DEFAULT 200,
    "verified_listing_fee" INTEGER DEFAULT 250,
    "currency" TEXT DEFAULT 'ج.م',
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP
);
```

---

## 🔄 التحديثات اللاحقة

كلما عدلت الكود وأردت نشر التحديثات:

```bash
git add .
git commit -m "وصف التحديث"
git push
```

Vercel سيقوم بالنشر تلقائياً خلال دقائق!

---

## 🔐 الأمان في الإنتاج

### ⚠️ تغيير بيانات المطور الافتراضية
1. سجل دخول كمطور
2. غيّر البريد وكلمة المرور من الإعدادات

### نصائح أمنية:
- استخدم كلمات مرور قوية وفريدة
- فعّل Two-Factor Authentication في GitHub و Vercel
- لا تشارك متغيرات البيئة مع أي شخص
- راجع صلاحيات الوصول في Supabase

---

## 📊 المراقبة والإحصائيات

### Vercel Analytics
1. اذهب إلى Vercel Dashboard
2. اختر مشروعك
3. اضغط **"Analytics"** لرؤية:
   - عدد الزيارات
   - الدول
   - الأجهزة

### Supabase Dashboard
1. **Table Editor**: عرض وتعديل البيانات
2. **Logs**: مراقبة الاستعلامات
3. **Reports**: تقارير الأداء

---

## ❓ الأسئلة الشائعة

### س: هل الخدمة مجانية فعلاً؟
ج: نعم! 
- **Vercel**: الخطة المجانية تشمل 100GB bandwidth شهرياً
- **Supabase**: الخطة المجانية تشمل 500MB تخزين و5GB bandwidth

### س: كم عدد المستخدمين الذين يمكنهم استخدام الموقع؟
ج: الخطة المجانية تدعم آلاف الزيارات اليومية.

### س: أين تُحفظ الصور؟
ج: حالياً تستخدم روابط خارجية. يمكنك استخدام:
- Supabase Storage (مجاني حتى 1GB)
- Cloudinary (مجاني حتى 25GB)
- Imgur

### س: كيف أضيف دومين مخصص؟
ج: في Vercel:
1. Dashboard → Settings → Domains
2. أضف الدومين
3. عدّل DNS عند مزود الدومين

### س: الموقع لا يعمل، ماذا أفعل؟
ج: تحقق من:
1. Logs في Vercel Dashboard
2. متغيرات البيئة صحيحة
3. تم تشغيل Migration بنجاح

---

## 📞 الدعم الفني

للمساعدة تواصل مع المطور:
- البريد: ahmadmamdouh10030@gmail.com

---

**تم إعداد هذا الدليل لمشروع منطقتي © 2024**
