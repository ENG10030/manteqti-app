# إعداد Cloudinary للرفع السحابي

## الخطوة 1: إنشاء حساب Cloudinary (مجاني)

1. اذهب إلى: https://cloudinary.com/
2. اضغط "Sign up for free"
3. أنشئ حساباً مجانياً

## الخطوة 2: الحصول على بيانات الاعتماد

بعد تسجيل الدخول، ستجد في Dashboard:
- **Cloud Name**: اسم السحابة الخاص بك
- **API Key**: مفتاح API
- **API Secret**: سر API

## الخطوة 3: إضافة المتغيرات إلى .env

أضف هذه المتغيرات إلى ملف `.env` في مشروعك:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

## الخطوة 4: تثبيت الحزمة

```bash
npm install cloudinary
# أو
bun add cloudinary
```

## مميزات الخطة المجانية

- 25 جيجابايت تخزين
- 25 جيجابايت نقل شهرياً
- تحويلات صور غير محدودة
- كافية للمشاريع الصغيرة والمتوسطة

## ملاحظات مهمة

- لا تضع API Secret في الكود أبداً
- استخدم متغيرات البيئة دائماً
- الصور ستكون متاحة عبر CDN سريع
