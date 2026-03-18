'use client';

import { useState, useCallback } from 'react';
import { X, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const defaultAccept = type === 'image' 
    ? 'image/jpeg,image/png,image/webp,image/gif'
    : 'video/mp4,video/webm,video/ogg';

  const handleUpload = useCallback(async (files: FileList) => {
    if (files.length === 0) return;

    setUploading(true);

    try {
      const newUrls: string[] = [];

      for (let i = 0; i < Math.min(files.length, maxFiles - value.length); i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

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
      }

      onChange([...value, ...newUrls]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  }, [type, value, maxFiles, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
    }
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
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          uploading && 'opacity-50 pointer-events-none'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
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
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {uploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          ) : type === 'image' ? (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          ) : (
            <Video className="h-10 w-10 text-muted-foreground" />
          )}
          <div className="text-sm text-muted-foreground">
            {uploading ? (
              'جاري الرفع...'
            ) : (
              <>
                <span className="font-medium text-primary">اضغط للاختيار</span>
                {' '}أو اسحب الملفات هنا
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {type === 'image' ? 'JPEG, PNG, WebP, GIF' : 'MP4, WebM'} - حد أقصى {maxFiles} ملفات
          </p>
        </label>
      </div>

      {/* معاينة الملفات */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {value.map((url, index) => (
            <div key={url} className="relative group">
              {type === 'image' ? (
                <img
                  src={url}
                  alt={`صورة ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-lg"
                />
              ) : (
                <video
                  src={url}
                  className="w-full aspect-square object-cover rounded-lg"
                  muted
                />
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              {type === 'video' && (
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                  <Video className="h-3 w-3 inline" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
