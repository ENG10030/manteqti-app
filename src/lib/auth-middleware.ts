import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ✅ دالة مساعدة للتحقق من صلاحيات المطور
function isDeveloper(email: string): boolean {
  return email === 'ahmadmamdouh10030@gmail.com';
}

// ✅ التحقق من المصادقة
export async function checkAuth(request: NextRequest): Promise<{
  authenticated: boolean;
  user?: { id: string; identifier: string; name: string };
  isDeveloper?: boolean;
}> {
  try {
    // التحقق من وجود جلسة
    const sessionCookie = request.cookies.get('session');
    
    if (!sessionCookie) {
      // محاولة التحقق من التوكن
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // يمكن إضافة التحقق من JWT هنا
      }
      
      return { authenticated: false };
    }
    
    // التحقق من المستخدم في قاعدة البيانات
    const user = await db.user.findFirst({
      where: { identifier: sessionCookie.value }
    });
    
    if (!user) {
      return { authenticated: false };
    }
    
    return {
      authenticated: true,
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name
      },
      isDeveloper: isDeveloper(user.identifier)
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return { authenticated: false };
  }
}

// ✅ Middleware للتحقق من المصادقة
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const auth = await checkAuth(request);
  
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'يجب تسجيل الدخول أولاً', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  return null; // يعني أن المصادقة ناجحة
}

// ✅ Middleware للتحقق من صلاحيات المطور
export async function requireDeveloper(request: NextRequest): Promise<NextResponse | null> {
  const auth = await checkAuth(request);
  
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'يجب تسجيل الدخول أولاً', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  if (!auth.isDeveloper) {
    return NextResponse.json(
      { error: 'ليس لديك صلاحيات المطور', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
  
  return null;
}

// ✅ التحقق من ملكية المورد
export async function checkOwnership(
  request: NextRequest, 
  resourceType: 'apartment' | 'inquiry' | 'payment',
  resourceId: string
): Promise<{ owned: boolean; resource?: any }> {
  const auth = await checkAuth(request);
  
  if (!auth.authenticated || !auth.user) {
    return { owned: false };
  }
  
  try {
    let resource;
    
    switch (resourceType) {
      case 'apartment':
        resource = await db.apartment.findUnique({
          where: { id: resourceId },
          select: { id: true, createdBy: true }
        });
        break;
      case 'inquiry':
        resource = await db.inquiry.findUnique({
          where: { id: resourceId },
          select: { id: true, userId: true }
        });
        break;
      case 'payment':
        resource = await db.payment.findUnique({
          where: { id: resourceId },
          select: { id: true, userId: true }
        });
        break;
    }
    
    if (!resource) {
      return { owned: false };
    }
    
    // المطور يملك كل شيء
    if (auth.isDeveloper) {
      return { owned: true, resource };
    }
    
    // التحقق من الملكية
    const isOwner = 
      (resourceType === 'apartment' && resource.createdBy === auth.user.id) ||
      (resourceType !== 'apartment' && resource.userId === auth.user.id);
    
    return { owned: isOwner, resource };
  } catch (error) {
    console.error('Ownership check error:', error);
    return { owned: false };
  }
}

// ✅ تنظيف البيانات المدخلة
export function sanitizeInput(input: string): string {
  // إزالة المسافات الزائدة
  let sanitized = input.trim();
  
  // إزالة الأحرف الخطرة
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}

// ✅ التحقق من صحة المعرفات
export function isValidId(id: string): boolean {
  // CUID format: 25 حرف أبجدي رقمي
  return /^[a-z0-9]{25}$/i.test(id);
}

// ✅ التحقق من الحقول المطلوبة
export function validateRequired(data: Record<string, any>, fields: string[]): {
  valid: boolean;
  missing: string[];
} {
  const missing = fields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}

// ✅ استجابة خطأ موحدة
export function errorResponse(
  message: string, 
  code: string = 'ERROR', 
  status: number = 400
): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status }
  );
}

// ✅ استجابة نجاح موحدة
export function successResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status }
  );
}
