import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    if (email === DEVELOPER_EMAIL && DEVELOPER_PASSWORD) {
      if (password === DEVELOPER_PASSWORD) {
        let user = await db.user.findUnique({
          where: { identifier: DEVELOPER_EMAIL }
        });

        if (!user) {
          const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
          user = await db.user.create({
            data: {
              email: DEVELOPER_EMAIL,
              identifier: DEVELOPER_EMAIL,
              name: 'المطور - أحمد',
              phone: '+201234567890',
              password: hashedPassword,
              role: 'DEVELOPER',
            }
          });
        }

        const token = jwt.sign(
          { userId: user.id, identifier: user.identifier, role: user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return NextResponse.json({
          success: true,
          user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
          token
        });
      }
    }

    const user = await db.user.findUnique({ where: { identifier: email } });

    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
      token
    });

  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}