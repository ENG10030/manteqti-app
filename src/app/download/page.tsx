'use client';
import { useEffect, useState } from 'react';

export default function DownloadPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const files = [
    { name: 'src/app/page.tsx', path: '/api/get-file?page.tsx' },
    { name: 'src/app/api/auth/dev-login/route.ts', path: '/api/get-file?dev-login-route.ts' },
    { name: 'src/app/api/auth/login/route.ts', path: '/api/get-file?login-route.ts' },
    { name: 'src/app/api/backup/route.ts', path: '/api/get-file?backup-route.ts' },
    { name: 'src/app/api/users/[id]/approve/route.ts', path: '/api/get-file?approve-route.ts' },
  ];

  useEffect(() => { setStatus('ready'); }, []);

  const downloadFile = async (filename: string, path: string) => {
    try {
      setStatus('loading');
      const res = await fetch(path);
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\//g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
    }
  };

  const downloadAllAsZip = async () => {
    try {
      setStatus('loading');
      const res = await fetch('/api/get-zip');
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manteqti-v67.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
    }
  };

  const copyBase64 = async (filename: string) => {
    try {
      const cleanName = filename.replace(/\//g, '_');
      const res = await fetch(`/api/get-file?${cleanName}&base64=true`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(filename);
      setTimeout(() => setCopySuccess(null), 3000);
    } catch {
      setCopySuccess(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '20px', direction: 'rtl' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#22c55e', marginBottom: '10px' }}>📦 تحميل ملفات منطقتي - v67</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>إصلاح تسجيل الدخول + رسائل مختلفة + دخول المطور منفصل + نسخ احتياطي + حماية البيانات</p>
        </div>

        {/* ZIP Download Button */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '30px', marginBottom: '24px', textAlign: 'center', border: '2px solid #22c55e' }}>
          <button
            onClick={downloadAllAsZip}
            disabled={status === 'loading'}
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: 'white',
              border: 'none',
              padding: '18px 40px',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
              transition: 'all 0.3s',
            }}
          >
            {status === 'loading' ? '⏳ جاري التحميل...' : '⬇️ تحميل ملف ZIP كامل'}
          </button>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '12px' }}>manteqti-v67.zip</p>
        </div>

        {/* Alternative Methods */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#f59e0b' }}>🔄 طرق بديلة لو ملف ZIP ما اتحمل</h2>
          
          <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#38bdf8' }}>طريقة 1: Open in New Tab</p>
            <a
              href="/api/get-zip"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', fontSize: '14px', textDecoration: 'underline' }}
            >
              اضغط هنا لفتح الملف في تاب جديد
            </a>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>من التاب الجديد اختار Save As من المتصفح</p>
          </div>

          <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#38bdf8' }}>طريقة 2: Base64 Copy</p>
            <button
              onClick={() => {
                const link = window.location.origin + '/api/get-zip?base64=true';
                navigator.clipboard.writeText(link);
                setCopySuccess('link');
                setTimeout(() => setCopySuccess(null), 3000);
              }}
              style={{
                background: '#334155', color: '#e2e8f0', border: '1px solid #475569',
                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}
            >
              📋 نسخ رابط الـ Base64
            </button>
          </div>
        </div>

        {/* Individual Files */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#a78bfa' }}>📄 الملفات المعدلة (5 ملفات)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {files.map(file => (
              <div key={file.name} style={{ background: '#0f172a', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <code style={{ color: '#94a3b8', fontSize: '12px', flex: 1, direction: 'ltr', textAlign: 'left' }}>{file.name}</code>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => downloadFile(file.name, file.path)}
                    style={{ background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    ⬇️ تحميل
                  </button>
                  <button
                    onClick={() => copyBase64(file.name)}
                    style={{ background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    📋 نسخ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', color: '#fb923c' }}>📝 طريقة النشر على Vercel</h2>
          <ol style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '2', paddingRight: '20px' }}>
            <li>افتح GitHub Repository بتاعك</li>
            <li>استبدل كل ملف بالملف الجديد</li>
            <li>Vercel هينشر التحديثات تلقائياً</li>
            <li>لو فيه تغيير في schema.prisma، اعمل push من Vercel Dashboard</li>
          </ol>
        </div>

        {copySuccess && (
          <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: 'white', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 1000 }}>
            ✅ تم النسخ بنجاح!
          </div>
        )}

        {status === 'error' && (
          <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: 'white', padding: '12px 24px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000 }}>
            ❌ فشل التحميل - استخدم طريقة Open in New Tab
          </div>
        )}
      </div>
    </div>
  );
}
