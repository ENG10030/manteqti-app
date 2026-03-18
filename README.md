# 🏠 نظام رفع الصور والفيديوهات - منطقتي

## 📁 الملفات المضمنة

```
src/
├── components/
│   └── file-upload.tsx          ← مكون رفع الملفات
├── app/
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts         ← API رفع الملفات
│   │   └── apartments/
│   │       └── route.ts         ← API العقارات
│   └── admin/
│       └── apartments/
│           └── new/
│               └── page.tsx     ← صفحة إضافة عقار
└── lib/
    └── cloudinary.ts            ← تكوين Cloudinary
```

---

## 🚀 خطوات التثبيت

### 1️⃣ تثبيت حزمة Cloudinary

```bash
npm install cloudinary
```

---

### 2️⃣ نسخ الملفات

انسخ الملفات من هذا المجلد إلى مشروعك:

| من | إلى |
|----|-----|
| `src/components/file-upload.tsx` | `src/components/file-upload.tsx` |
| `src/app/api/upload/route.ts` | `src/app/api/upload/route.ts` |
| `src/app/api/apartments/route.ts` | `src/app/api/apartments/route.ts` |
| `src/app/admin/apartments/new/page.tsx` | `src/app/admin/apartments/new/page.tsx` |
| `src/lib/cloudinary.ts` | `src/lib/cloudinary.ts` |

---

### 3️⃣ إضافة متغيرات البيئة

في ملف `.env`:

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME="ddei8bqgy"
CLOUDINARY_API_KEY="451439326463719"
CLOUDINARY_API_SECRET="السر_من_ Cloudinary"
```

---

### 4️⃣ إضافة المتغيرات في Vercel

اذهب إلى: Vercel → Settings → Environment Variables

أضف:
- `CLOUDINARY_CLOUD_NAME` = `ddei8bqgy`
- `CLOUDINARY_API_KEY` = `451439326463719`
- `CLOUDINARY_API_SECRET` = (انسخه من Cloudinary)

---

### 5️⃣ رفع ونشر

```bash
git add .
git commit -m "إضافة نظام رفع الصور"
git push
```

---

## 🎨 مميزات مكون الرفع

| الميزة | ✅ |
|--------|---|
| السحب والإفلات | ✅ |
| معاينة الصور | ✅ |
| حذف الصور | ✅ |
| رفع عدة ملفات | ✅ |
| شريط تحميل | ✅ |
| دعم الفيديو | ✅ |
| حدود الملفات | ✅ |

---

## 📸 استخدام المكون

```tsx
import { FileUpload } from '@/components/file-upload';

// للصور
<FileUpload
  type="image"
  value={images}
  onChange={setImages}
  maxFiles={5}
/>

// للفيديوهات
<FileUpload
  type="video"
  value={videos}
  onChange={setVideos}
  maxFiles={2}
/>
```

---

## 🔗 الروابط

- صفحة إضافة عقار: `/admin/apartments/new`
- API رفع الملفات: `/api/upload`
- API العقارات: `/api/apartments`

---

## ⚠️ ملاحظات مهمة

1. **حجم الملفات**: حد أقصى 50MB للملف
2. **أنواع الصور**: JPEG, PNG, WebP, GIF
3. **أنواع الفيديو**: MP4, WebM, OGG
4. **الصور تُحفظ على Cloudinary**: لن تُحذف عند إعادة النشر

---

## 📞 للحصول على API Secret

1. اذهب إلى: https://console.cloudinary.com
2. اختر مشروعك
3. Settings → API Keys
4. اضغط "Reveal" بجانب API Secret
5. انسخ السر
