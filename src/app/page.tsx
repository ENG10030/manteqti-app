'use client';

import { motion } from 'framer-motion';
import { Download, FileCode, Github, CheckCircle2, AlertTriangle, Users, ShieldCheck, Plus, FolderOpen, Database } from 'lucide-react';

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FileCode className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">منطقي - تحديث</h1>
              <p className="text-slate-400 text-xs">Manteqti Update - v3</p>
            </div>
          </div>
          <a 
            href="https://github.com/ENG10030/manteqti-app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Github className="h-5 w-5" />
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full"
        >
          {/* Critical Warning Card */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-400 font-bold mb-1">⚠️ إصلاح حرج!</h3>
                <p className="text-red-200/80 text-sm">
                  <strong>مشكلة في قاعدة البيانات:</strong> الـ schema كان يستخدم SQLite لكن DATABASE_URL يشير إلى PostgreSQL (Supabase). تم إصلاح الـ schema ليدعم PostgreSQL.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Download Card */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20"
            >
              <Download className="h-10 w-10 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">تحديث منطقي</h2>
            <p className="text-slate-400 mb-6">Manteqti Update Package - v3 (Database Fix)</p>

            <a 
              href="/manteqti-update.zip"
              download
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
            >
              <Download className="h-6 w-6" />
              تحميل ملف التحديث
            </a>

            <p className="text-slate-500 text-sm mt-4">حجم الملف: ~44 KB</p>
          </div>

          {/* Files to Update */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-white font-bold">الملفات المطلوب استبدالها (3 ملفات)</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                <Database className="h-5 w-5 text-red-400 flex-shrink-0" />
                <code className="text-slate-300 text-sm">prisma/schema.prisma</code>
                <span className="text-xs text-red-400 mr-auto">إصلاح مهم!</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <code className="text-slate-300 text-sm">src/app/page.tsx</code>
                <span className="text-xs text-emerald-400 mr-auto">زر FAB</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <code className="text-slate-300 text-sm">src/app/api/edit-requests/route.ts</code>
                <span className="text-xs text-amber-400 mr-auto">إصلاح API</span>
              </div>
            </div>
          </motion.div>

          {/* What's Included */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="text-white font-bold">التعديلات</h3>
              </div>
              <ul className="space-y-3 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <span>إصلاح schema.prisma لـ PostgreSQL</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span>زر عائم لإضافة عقار جديد (FAB)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span>يظهر للجميع (زوار، مستخدمين، مطور)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span>إصلاح خطأ API طلبات التعديل</span>
                </li>
              </ul>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="text-white font-bold">سلوك المستخدمين</h3>
              </div>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold">زائر:</span>
                  <span>تسجيل الدخول للنشر</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">مستخدم:</span>
                  <span>إرسال للمراجعة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">مطور:</span>
                  <span>نشر مباشر</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Instructions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-white font-bold">خطوات التثبيت باستخدام GitHub Desktop</h3>
            </div>
            <ol className="space-y-3 text-slate-300 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>افتح تطبيق <strong>GitHub Desktop</strong> وتأكد من فتح مشروع منطقي</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>استخرج ملف ZIP وانسخ <strong>جميع الملفات الثلاثة</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>استبدل الملفات في المسارات الصحيحة داخل المشروع</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                <span>في GitHub Desktop: اكتب رسالة Commit ثم اضغط <strong>Commit to main</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                <span>اضغط <strong>Push origin</strong> لرفع التغييرات إلى GitHub</span>
              </li>
            </ol>
          </motion.div>

          {/* Important Note */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-amber-400 font-bold mb-1">ملاحظة مهمة!</h3>
                <p className="text-amber-200/80 text-sm">
                  بعد رفع التعديلات، سيقوم Vercel بإعادة نشر الموقع تلقائياً خلال 1-2 دقيقة. تأكد من أن متغيرات البيئة مُعدة بشكل صحيح في لوحة تحكم Vercel.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-slate-500 text-sm">
          تم الإصلاح: PostgreSQL schema • FAB button • API route
        </div>
      </footer>
    </div>
  );
}
