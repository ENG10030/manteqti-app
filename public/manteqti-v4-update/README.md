# تحديث منطقتي v4 - المفضلات والتعليقات

## الميزات الجديدة:

### 1. نظام المفضلات (Likes) المحسن
- حفظ المفضلات في قاعدة البيانات للمستخدمين المسجلين
- المطور والناشر يرون من أضاف عقار للمفضلة
- المطور يمكنه حذف أي مفضلة

### 2. نظام التعليقات مع الموافقة
- التعليقات تحتاج موافقة المطور قبل النشر
- المطور يرى التعليقات المعلقة ويوافق عليها أو يحذفها
- التعليقات الموافق عليها تظهر للجميع

### 3. تغيير عنوان الموقع
- العنوان الجديد: "منطقتي - عقارات مصر"

---

## خطوات التحديث على Vercel:

### الطريقة 1: رفع الملفات مباشرة إلى GitHub

1. قم بتحميل ملف `manteqti-v4.zip`
2. فك الضغط عن الملف
3. انسخ المجلدات إلى مشروعك على GitHub:
   - `src/app/api/likes/` ← مشروعك
   - `src/app/api/comments/` ← مشروعك
   - `src/app/page.tsx` ← مشروعك
   - `src/app/layout.tsx` ← مشروعك
   - `prisma/schema.prisma` ← مشروعك

4. بعد الرفع، Vercel سيعيد البناء تلقائياً

### الطريقة 2: استخدام Git

```bash
# في مجلد مشروعك المحلي
git add src/app/api/likes/ src/app/api/comments/ src/app/page.tsx src/app/layout.tsx prisma/schema.prisma
git commit -m "إضافة نظام المفضلات والتعليقات مع تغيير العنوان"
git push origin main
```

---

## ملاحظات مهمة:

1. **قاعدة البيانات**: تأكد من تشغيل `npx prisma db push` أو `npx prisma migrate dev` بعد النشر لإنشاء جداول Likes و Comments

2. **متغيرات البيئة**: تأكد من وجود متغيرات Cloudinary في Vercel:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

3. **الأمان**: كود المطور موجود في الملف:
   ```javascript
   const DEVELOPER_EMAIL = 'ahmadmamdouh10030@gmail.com';
   const DEVELOPER_PASSWORD = 'admin123';
   ```
   يُنصح بتغيير كلمة المرور إلى شيء أقوى!

---

## الملفات المضافة/المعدلة:

### ملفات جديدة:
- `src/app/api/likes/route.ts`
- `src/app/api/likes/[id]/route.ts`
- `src/app/api/comments/route.ts`
- `src/app/api/comments/[id]/route.ts`

### ملفات معدلة:
- `src/app/page.tsx` - إضافة التعليقات والمفضلات
- `src/app/layout.tsx` - تغيير العنوان
- `prisma/schema.prisma` - جداول Likes و Comments موجودة مسبقاً
