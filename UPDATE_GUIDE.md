# دليل تحديث مشروع منطقتي

## الملفات الجديدة/المعدلة

### 1. ملفات جديدة
```
src/lib/cloudinary.ts           ← تكوين Cloudinary
src/app/api/upload/route.ts     ← API رفع الملفات
src/components/file-upload.tsx  ← مكون رفع الملفات
```

### 2. ملفات معدلة
```
src/app/api/apartments/[id]/route.ts  ← إصلاح تغيير الحالة + VIP
prisma/schema.prisma                  ← إضافة حقول VIP
```

---

## خطوات التحديث

### الخطوة 1: تثبيت الحزم المطلوبة
```bash
npm install cloudinary
# أو
bun add cloudinary
```

### الخطوة 2: إنشاء حساب Cloudinary
1. اذهب إلى https://cloudinary.com/
2. أنشئ حساباً مجانياً
3. انسخ: Cloud Name, API Key, API Secret

### الخطوة 3: تحديث ملف .env
أضف المتغيرات التالية:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### الخطوة 4: تحديث Prisma Schema
أضف هذه الحقول إلى نموذج Apartment في `prisma/schema.prisma`:
```prisma
model Apartment {
  // ... الحقول الموجودة ...
  
  isFeatured   Boolean    @default(false)
  isVip        Boolean    @default(false)
  featuredUntil DateTime?
  
  // ... باقي الحقول ...
}
```

ثم نفذ:
```bash
npx prisma db push
npx prisma generate
```

### الخطوة 5: نسخ الملفات الجديدة
انسخ الملفات من هذا المجلد إلى مشروعك:
- `src/lib/cloudinary.ts` → `src/lib/cloudinary.ts`
- `src/app/api/upload/route.ts` → `src/app/api/upload/route.ts`
- `src/app/api/apartments/[id]/route.ts` → `src/app/api/apartments/[id]/route.ts`
- `src/components/file-upload.tsx` → `src/components/file-upload.tsx`

### الخطوة 6: استخدام مكون رفع الملفات
في نموذج إضافة/تعديل العقار:
```tsx
import { FileUpload } from '@/components/file-upload';

// في النموذج:
<FileUpload
  type="image"
  value={images}
  onChange={setImages}
  maxFiles={5}
/>

<FileUpload
  type="video"
  value={videos}
  onChange={setVideos}
  maxFiles={3}
/>
```

---

## API الجديدة

### POST /api/upload
رفع ملف واحد
```json
// Request (FormData)
file: File
type: "image" | "video"

// Response
{
  "success": true,
  "url": "https://res.cloudinary.com/...",
  "publicId": "manteqti/..."
}
```

### PUT /api/upload
رفع عدة ملفات
```json
// Request (FormData)
files: File[]
type: "image" | "video"

// Response
{
  "success": true,
  "files": [{ "url": "...", "publicId": "..." }],
  "count": 3
}
```

### PATCH /api/apartments/[id]
تغيير حالة أو VIP لعقار
```json
// Request
{
  "status": "AVAILABLE",
  "isFeatured": true,
  "isVip": true,
  "featuredUntil": "2025-12-31"
}

// Response
{
  "success": true,
  "apartment": { ... },
  "message": "تم التحديث بنجاح"
}
```

---

## إصلاحات المشاكل

### 1. تغيير حالة العقار ✅
- الآن يعمل بشكل صحيح باستخدام PATCH
- يدعم تغيير: status, isFeatured, isVip

### 2. حذف العقار ✅
- يحذف المدفوعات والاستفسارات المرتبطة أولاً

### 3. نظام VIP/المميز ✅
- العقارات المميزة تظهر أولاً
- شارة ذهبية للعقارات VIP

### 4. رفع الصور والفيديوهات ✅
- رفع للسحابة (Cloudinary)
- لا تُحذف عند إعادة النشر على Vercel

---

## النشر على Vercel

1. تأكد من إضافة متغيرات البيئة في Vercel:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

2. ادفع التغييرات إلى GitHub:
```bash
git add .
git commit -m "Add cloudinary upload and VIP system"
git push
```

3. Vercel سيقوم بالنشر تلقائياً

---

## اختبار

بعد النشر:
1. اذهب إلى مanteqti-app.vercel.app
2. حاول رفع صورة لعقار جديد
3. تأكد من حفظ الصورة على Cloudinary
4. جرب تغيير حالة عقار
5. جرب تمييز عقار كـ VIP
