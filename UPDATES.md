# تحديثات منطقتي | Manteqti Updates

## 🔧 الإصلاحات التي تمت:

### 1. إصلاح Edit Modal (تعديل الشقة)
- ✅ إضافة قسم **الصور** - إمكانية إضافة وحذف الصور
- ✅ إضافة قسم **الفيديوهات** - إمكانية إضافة وحذف الفيديوهات
- ✅ إصلاح حفظ التغييرات بشكل صحيح

### 2. تحسينات قاعدة البيانات
- ✅ تحويل من PostgreSQL إلى SQLite (للتطوير المحلي)
- ✅ إضافة حقل `videos` للعقارات

---

## 📁 الملفات المُعدلة:

### الملفات الرئيسية:
```
src/app/page.tsx           # الصفحة الرئيسية مع الإصلاحات
prisma/schema.prisma       # تحديث قاعدة البيانات
```

### API Routes (جميعها تعمل):
```
src/app/api/apartments/route.ts
src/app/api/apartments/[id]/route.ts
src/app/api/apartments/[id]/details/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/me/route.ts
src/app/api/auth/register/route.ts
src/app/api/chat/route.ts
src/app/api/inquiries/route.ts
src/app/api/inquiries/[id]/route.ts
src/app/api/logs/route.ts
src/app/api/payments/route.ts
src/app/api/payments/[id]/route.ts
src/app/api/settings/route.ts
src/app/api/seed/route.ts
src/app/api/cron/auto-delete/route.ts
src/app/api/generate-description/route.ts
src/app/api/generate-image/route.ts
src/app/api/recommendations/route.ts
```

---

## 🚀 خطوات النشر على Vercel:

### 1. تحديث GitHub:
```bash
# استبدل الملفات القديمة بالجديدة
git add .
git commit -m "Fix edit modal - add images and videos support"
git push
```

### 2. Vercel سيقوم بالنشر تلقائياً

---

## 📝 ملاحظات مهمة:

### للإنتاج (Production) على Vercel:
1. استخدم PostgreSQL بدلاً من SQLite
2. غيّر `DATABASE_URL` في متغيرات البيئة

### بيانات المطور:
```
البريد: ahmadmamdouh10030@gmail.com
كلمة المرور: admin123
```

---

## ✨ الميزات الجديدة:

1. **تعديل الصور**: إضافة/حذف صور للعقار
2. **تعديل الفيديوهات**: إضافة/حذف فيديوهات (YouTube, Vimeo)
3. **معاينة فورية**: عرض الصور والفيديوهات قبل الحفظ
4. **إحصائيات كاملة**: تعمل بشكل صحيح في لوحة المطور

---

## 📞 للدعم:
إذا واجهت أي مشاكل، تواصل معي!
