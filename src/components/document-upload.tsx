'use client';

import { useState, useRef, useCallback } from 'react';
import { X, FileText, Loader2, Upload, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  /** معرّف فريد للحقول المتعددة في نفس الصفحة */
  id: string;
  label: string;
  hint?: string;
  /** data URL للصورة الحالية ('' = لا يوجد) */
  value: string;
  onChange: (dataUrl: string) => void;
  darkMode: boolean;
}

// أقصى بُعد للضغط — 1600px يحافظ على وضوح نص العقد والبطاقة مع حجم صغير
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;
const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB قبل الضغط

/** ضغط الصورة على جهاز المستخدم قبل الإرسال: تصغير + JPEG → data URL صغير (~150-400KB) */
async function compressToDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  // خلفية بيضاء للصور الشفافة (PNG) حتى لا تتحول لسوداء عند تحويل JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * حقل رفع مستند واحد (صورة عقد / بطاقة هوية) مع ضغط تلقائي ومعاينة.
 * المستندات تُخزَّن مشفرة داخل قاعدة البيانات وتظهر للمطور فقط.
 */
export function DocumentUpload({ id, label, hint, value, onChange, darkMode }: DocumentUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      setError('الصيغة غير مدعومة — استخدم صورة JPG أو PNG');
      return;
    }
    if (file.size > MAX_INPUT_SIZE) {
      setError('الصورة كبيرة جداً — الحد الأقصى 10 ميجا قبل الضغط');
      return;
    }
    setBusy(true);
    try {
      let dataUrl: string;
      try {
        dataUrl = await compressToDataUrl(file);
      } catch {
        // fallback: بعض الصيغ (HEIC) قد تفشل في canvas — ارفعها كما هي إن كانت صغيرة
        if (file.size <= 2 * 1024 * 1024) {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('read'));
            reader.readAsDataURL(file);
          });
        } else {
          throw new Error('compress');
        }
      }
      if (dataUrl.length > 3_000_000) {
        setError('الصورة كبيرة بعد المعالجة — جرب صورة أوضح وأصغر');
        return;
      }
      onChange(dataUrl);
    } catch {
      setError('تعذر معالجة الصورة — جرب صورة أخرى');
    } finally {
      setBusy(false);
    }
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  }, [processFile]);

  const border = darkMode ? 'border-slate-600' : 'border-slate-300';
  const surface = darkMode ? 'bg-slate-700/50' : 'bg-slate-50';

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-input`} className={cn('block text-sm font-medium', darkMode ? 'text-slate-300' : 'text-slate-700')}>
        {label}
      </label>
      {hint && <p className={cn('text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>{hint}</p>}

      {value ? (
        // معاينة المستند المرفوع
        <div className={cn('relative rounded-xl overflow-hidden border-2', border)}>
          <img src={value} alt={label} className="w-full h-40 object-cover" />
          <div className="absolute top-2 left-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="استبدال الصورة"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="إزالة الصورة"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs font-medium flex items-center gap-1">
            <FileText className="h-3 w-3" /> تم الرفع
          </span>
        </div>
      ) : (
        // منطقة الرفع
        <div
          role="button"
          tabIndex={0}
          aria-label={label}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all',
            dragOver ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' : cn(border, surface, 'hover:border-emerald-400'),
            busy && 'opacity-60 pointer-events-none'
          )}
        >
          <input
            ref={inputRef}
            id={`${id}-input`}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="hidden"
            onChange={(e) => { processFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {busy ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className={cn('text-sm', darkMode ? 'text-slate-300' : 'text-slate-600')}>جاري ضغط وتجهيز الصورة...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className={cn('p-3 rounded-full', darkMode ? 'bg-slate-600' : 'bg-white')}>
                <Upload className="h-5 w-5 text-emerald-500" />
              </div>
              <p className={cn('text-sm font-medium', darkMode ? 'text-slate-200' : 'text-slate-700')}>
                <span className="text-emerald-500">اضغط لرفع صورة</span> أو اسحبها هنا
              </p>
              <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>JPG / PNG • يُفضّل أقل من 10 ميجا</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
