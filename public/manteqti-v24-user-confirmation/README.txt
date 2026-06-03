========================================
  منتجتي - تحديث v24 (تأكيد المستخدمين)
  Manteqti Update v24 - User Confirmation
========================================

الملفات المعدلة (Modified Files):
---------------------------------

1. prisma/schema.prisma
   - تمت إضافة نموذج ApprovalLog الجديد

2. src/app/api/users/[id]/approve/route.ts
   - تم تحديث لدعم إجراء: revoke (إلغاء التأكيد)

3. src/app/api/approval-logs/route.ts  (ملف جديد - NEW FILE)
   - GET: جلب سجلات التأكيد
   - DELETE: حذف سجل أو حذف الكل

4. src/app/api/logs/route.ts
   - تم إضافة DELETE: حذف سجل عمليات أو حذف الكل

5. src/app/page.tsx
   - تأكيد المستخدمين: عرض جميع المستخدمين مع حالة التأكيد
   - إمكانية إلغاء التأكيد (revoke)
   - سجل المستخدمين: عرض سجلات التأكيد مع المدفوعات
   - حذف سجلات التأكيد الفردية أو الكل
   - سجل العمليات: حذف السجلات الفردية أو الكل

خطوات التثبيت (Installation Steps):
----------------------------------

1. احذف مجلد users-approve إذا كان موجوداً:
   DELETE the folder: src/app/api/users-approve/ (if exists)

2. استبدل الملفات في مشروعك:
   Replace the files in your project with the files from this ZIP

3. تأكد من أن مسار approve هو:
   src/app/api/users/[id]/approve/route.ts
   (وليس src/app/api/users-approve/route.ts)

4. شغل قاعدة البيانات:
   npx prisma db push

5. ارفع على GitHub:
   git add -A
   git commit -m "v24: user confirmation system"
   git push

الميزات الجديدة (New Features):
-------------------------------
- عرض جميع المستخدمين في تبويب تأكيد المستخدمين
- حالات المستخدمين: مؤكد / بانتظار / محظور
- إلغاء تأكيد مستخدم (revoke)
- سجل المستخدمين مع عرض المدفوعات
- عرض رسائل السجل مع إمكانية الحذف
- حذف سجلات التأكيد والعمليات
