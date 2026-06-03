import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function POST(request: NextRequest) {
  try {
    console.log('[DEV-LOGIN] Starting...');
    console.log('[DEV-LOGIN] NODE_ENV:', process.env.NODE_ENV);
    console.log('[DEV-LOGIN] DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('[DEV-LOGIN] JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('[DEV-LOGIN] DEVELOPER_PASSWORD exists:', !!process.env.DEVELOPER_PASSWORD);
    console.log('[DEV-LOGIN] DEVELOPER_EMAIL exists:', !!process.env.DEVELOPER_EMAIL);

    const body = await request.json();
    const { email, password } = body;

    console.log('[DEV-LOGIN] Email received:', email ? 'yes' : 'NO');
    console.log('[DEV-LOGIN] Password received:', password ? 'yes' : 'NO');

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    console.log('[DEV-LOGIN] Using DEVELOPER_EMAIL:', DEVELOPER_EMAIL);
    console.log('[DEV-LOGIN] DEVELOPER_PASSWORD set:', !!DEVELOPER_PASSWORD);

    if (!DEVELOPER_PASSWORD) {
      console.error('[DEV-LOGIN] ERROR: DEVELOPER_PASSWORD not set!');
      return NextResponse.json({ error: 'بيانات المطور غير مهيأة - DEVELOPER_PASSWORD غير موجود في Vercel', debug: 'MISSING_ENV' }, { status: 500 });
    }

    if (email === DEVELOPER_EMAIL && DEVELOPER_PASSWORD) {
      console.log('[DEV-LOGIN] Email matches DEVELOPER_EMAIL, checking password...');
      
      if (password === DEVELOPER_PASSWORD) {
        console.log('[DEV-LOGIN] Password matches! Trying to find/create user in DB...');
        
        let user: any = null;
        try {
          user = await db.user.findUnique({
            where: { identifier: DEVELOPER_EMAIL }
          });
          console.log('[DEV-LOGIN] User found in DB:', !!user);
        } catch (dbError: any) {
          console.error('[DEV-LOGIN] DB Error on findUnique:', dbError?.code, dbError?.message);
          return NextResponse.json({ error: 'خطأ في قاعدة البيانات', details: dbError?.message, debug: 'DB_ERROR' }, { status: 500 });
        }

        if (!user) {
          console.log('[DEV-LOGIN] User not found, creating...');
          try {
            const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
            user = await db.user.create({
              data: {
                email: DEVELOPER_EMAIL,
                identifier: DEVELOPER_EMAIL,
                name: 'المطور - أحمد',
                phone: '+201234567890',
                password: hashedPassword,
                role: 'DEVELOPER',
                isApproved: true,
                emailVerified: true,
              }
            });
            console.log('[DEV-LOGIN] User created successfully:', user.id);
          } catch (createError: any) {
            console.error('[DEV-LOGIN] DB Error on create:', createError?.code, createError?.message);
            return NextResponse.json({ error: 'خطأ في إنشاء الحساب', details: createError?.message, debug: 'CREATE_ERROR' }, { status: 500 });
          }
        }

        console.log('[DEV-LOGIN] Generating JWT...');
        const token = jwt.sign(
          { userId: user.id, identifier: user.identifier, role: user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        const response = NextResponse.json({
          success: true,
          user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
        });

        response.cookies.set('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        console.log('[DEV-LOGIN] SUCCESS! Token generated');
        return response;
      } else {
        console.log('[DEV-LOGIN] Password does NOT match env password');
      }
    }

    // Fallback: check DB user
    console.log('[DEV-LOGIN] Email does not match DEVELOPER_EMAIL, checking DB...');
    const user = await db.user.findUnique({ where: { identifier: email } });
    console.log('[DEV-LOGIN] DB user found:', !!user);

    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة', debug: 'WRONG_USER' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('[DEV-LOGIN] DB password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة', debug: 'WRONG_PASSWORD' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('[DEV-LOGIN] SUCCESS via DB!');
    return response;

  } catch (error: any) {
    console.error('[DEV-LOGIN] FATAL ERROR:', error?.message || error);
    console.error('[DEV-LOGIN] Error code:', error?.code);
    console.error('[DEV-LOGIN] Error stack:', error?.stack);
    return NextResponse.json({ 
      error: 'حدث خطأ في السيرفر', 
      details: error?.message,
      debug: error?.code || 'UNKNOWN'
    }, { status: 500 });
  }
}
