'use client';

import { useState, useCallback } from 'react';
import { X, Image as ImageIcon, Video, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  type: 'image' | 'video';
  value?: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  accept?: string;
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

  const defaultAccept = type === 'image' 
    ? 'image/jpeg,image/png,image/webp,image/gif'
    : 'video/mp4,video/webm,video/ogg';

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const newUrls: string[] = [];
      const totalFiles = Math.min(files.length, maxFiles - value.length);

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        // التحقق من حجم الملف (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          console.warn(`File ${file.name} is too large`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            if (data.url) {
              newUrls.push(data.url);
            }
          }
        } catch (err) {
          console.error('Upload error:', err);
        }

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      onChange([...value, ...newUrls]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      {/* منطقة الرفع */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          dragOver 
            ? 'border-primary bg-primary/10 scale-[1.02]' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
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
            'cursor-pointer flex flex-col items-center gap-3',
            value.length >= maxFiles && 'cursor-not-allowed'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-sm text-muted-foreground">
                جاري الرفع... {uploadProgress}%
              </div>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-full bg-muted">
                {type === 'image' ? (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Video className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  <span className="text-primary">اضغط للاختيار</span>
                  {' '}أو اسحب الملفات هنا
                </p>
                <p className="text-xs text-muted-foreground">
                  {type === 'image' ? 'JPEG, PNG, WebP, GIF' : 'MP4, WebM, OGG'}
                  {' '}• حد أقصى {maxFiles} ملفات • 50MB للملف
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

      {/* معاينة الملفات */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {value.length} / {maxFiles} ملفات
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="text-destructive hover:text-destructive"
            >
              حذف الكل
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {value.map((url, index) => (
              <div 
                key={`${url}-${index}`} 
                className="relative group rounded-lg overflow-hidden border bg-muted"
              >
                {type === 'image' ? (
                  <img
                    src={url}
                    alt={`صورة ${index + 1}`}
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
                  className="absolute top-1 right-1 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
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