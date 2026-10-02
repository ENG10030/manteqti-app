'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  type: 'image' | 'video';
  value?: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  accept?: string;
}

/* ============================================================
   رفع صور/فيديوهات الشقق عبر /api/upload (مخزنة في قاعدة البيانات)
   - الصور تُضغط على جهاز المستخدم (1600px / JPEG 0.82) → ~100-300KB
   - GIF/الفيديو تُرفع كما هي بحد 3MB (بدون ضغط ممكن)
   - رسائل خطأ واضحة بدل الفشل الصامت القديم
   ============================================================ */

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;
const MAX_RAW_IMAGE = 15 * 1024 * 1024; // 15MB قبل الضغط
const MAX_PASSTHROUGH = 3 * 1024 * 1024; // GIF/فيديو بحد 3MB

/** ضغط صورة إلى base64 خام (بدون بادئة data:) مع محاولة جودة أقل لو لسه كبيرة */
async function compressImageToBase64(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#ffffff'; // خلفية بيضاء للشفاف
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  for (const quality of [JPEG_QUALITY, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (base64.length * 0.75 <= 2.5 * 1024 * 1024) return base64;
  }
  throw new Error('too-large');
}

/** قراءة ملف كما هو (GIF/فيديو) إلى base64 خام */
function readFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

export function FileUpload({
  type,
  value = [],
  onChange,
  maxFiles = 5,
  accept,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0); // يمنع تداخل عمليات الرفع المتتالية

  const defaultAccept = type === 'image'
    ? 'image/jpeg,image/png,image/webp,image/gif'
    : 'video/mp4,video/webm';

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const token = ++tokenRef.current;

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const filesToProcess = Array.from(files).slice(0, maxFiles - value.length);
      const newUrls: string[] = [];
      const failed: string[] = [];
      let completed = 0;

      for (const file of filesToProcess) {
        if (tokenRef.current !== token) return; // أُلغي الرفع بعملية أحدث
        try {
          if (file.size > (type === 'image' ? MAX_RAW_IMAGE : MAX_PASSTHROUGH)) {
            failed.push(`${file.name}: أكبر من الحد المسموح`);
            continue;
          }

          let base64: string;
          let mimeType = file.type;

          if (type === 'image' && file.type !== 'image/gif') {
            setStatusText(`جاري ضغط ${file.name}...`);
            base64 = await compressImageToBase64(file);
            mimeType = 'image/jpeg'; // الضغط يحول الكل لـ JPEG
          } else {
            setStatusText(`جاري رفع ${file.name}...`);
            base64 = await readFileToBase64(file);
          }

          setStatusText(`جاري رفع ${file.name}...`);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: base64, mimeType }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.url) {
            newUrls.push(data.url);
          } else {
            failed.push(`${file.name}: ${data.error || 'فشل الرفع'}`);
          }
        } catch (err) {
          const msg = err instanceof Error && err.message === 'too-large'
            ? `${file.name}: كبيرة جداً حتى بعد الضغط`
            : `${file.name}: تعذر معالجة الملف`;
          failed.push(msg);
        } finally {
          completed++;
          setUploadProgress(Math.round((completed / filesToProcess.length) * 100));
        }
      }

      if (tokenRef.current !== token) return;
      if (newUrls.length > 0) onChange([...value, ...newUrls]);
      if (failed.length > 0) setError(failed.join(' • '));
    } catch (err) {
      console.error('Upload error:', err);
      setError('حدث خطأ أثناء الرفع — حاول تاني');
    } finally {
      if (tokenRef.current === token) {
        setUploading(false);
        setUploadProgress(0);
        setStatusText('');
      }
    }
  }, [type, value, maxFiles, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUpload(e.target.files);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      {/* منطقة الرفع */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200',
          dragOver
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-700/50',
          uploading && 'opacity-60 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept || defaultAccept}
          multiple={maxFiles > 1}
          onChange={handleFileChange}
          className="hidden"
          id={`file-upload-${type}`}
          disabled={uploading || value.length >= maxFiles}
        />
        <label
          htmlFor={`file-upload-${type}`}
          className={cn(
            'cursor-pointer flex flex-col items-center gap-2',
            value.length >= maxFiles && 'cursor-not-allowed'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {statusText || 'جاري الرفع...'} {uploadProgress > 0 && `${uploadProgress}%`}
              </div>
              <div className="w-48 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-white dark:bg-slate-600 shadow-sm">
                {type === 'image' ? (
                  <ImageIcon className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Video className="h-6 w-6 text-emerald-500" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span className="text-emerald-500">اضغط للاختيار</span>
                  {' '}أو اسحب الملفات هنا
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {type === 'image'
                    ? 'JPEG, PNG, WebP, GIF • تُضغط تلقائياً على جهازك'
                    : 'MP4, WebM • حد أقصى 3MB للفيديو'}
                  {' '}• حتى {maxFiles} ملفات
                </p>
              </div>
              {value.length >= maxFiles && (
                <p className="text-xs text-amber-500">
                  تم الوصول للحد الأقصى من الملفات
                </p>
              )}
            </>
          )}
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
          <X className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {/* معاينة الملفات */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {value.length} / {maxFiles} ملفات
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              حذف الكل
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {value.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700"
              >
                {type === 'image' || url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i) ? (
                  <img
                    src={url}
                    alt={`صورة ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="relative aspect-square bg-black">
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="h-8 w-8 text-white" />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`حذف الملف ${index + 1}`}
                  className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
