import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Default recharge limits (not stored in DB)
const MIN_RECHARGE = 10;
const MAX_RECHARGE = 50000;

// GET - Get available payment methods with settings
export async function GET() {
  try {
    let settings = await db.settings.upsert({
      where: { id: "main" },
      update: {},
      create: {
        id: "main",
        contactFee: 50,
        regularFee: 30,
        featuredFee: 100,
        premiumFee: 200,
        vipFee: 300,
        saleDisplayFee: 100,
        rentDisplayFee: 75,
        otherServicesFee: 50,
        highlightFee: 150,
        priorityListingFee: 200,
        verifiedListingFee: 250,
        currency: "ج.م",
      },
    });

    const minAmt = MIN_RECHARGE;
    const maxAmt = MAX_RECHARGE;

    const methods: Array<{
      id: string;
      name: string;
      icon: string;
      description: string;
      minAmount: number;
      maxAmount: number;
      instructions: string;
    }> = [];

    // Vodafone Cash
    methods.push({
      id: "vodafone-cash",
      name: "فودافون كاش",
      icon: "📱",
      description: "ادفع عبر فودافون كاش",
      minAmount: minAmt,
      maxAmount: maxAmt,
      instructions: "1. اذهب لأقرب فرع فودافون\n2. اطلب تحويل أموال\n3. أدخل رقم الهاتف المطلوب",
    });

    // InstaPay
    methods.push({
      id: "instapay",
      name: "إنستاباي",
      icon: "💳",
      description: "ادفع عبر إنستاباي",
      minAmount: minAmt,
      maxAmount: maxAmt,
      instructions: "1. افتح تطبيق إنستاباي\n2. اختر تحويل أموال\n3. أدخل الرقم أو الـ QR",
    });

    // Bank Transfer
    methods.push({
      id: "bank-transfer",
      name: "تحويل بنكي",
      icon: "🏦",
      description: "ادفع عبر التحويل البنكي",
      minAmount: minAmt * 10,
      maxAmount: maxAmt * 10,
      instructions: "تحويل بنكي لحساب منطقتي - تواصل مع الدعم للحصول على بيانات الحساب",
    });

    return NextResponse.json({ methods, settings: { currency: settings.currency } });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب طرق الدفع" },
      { status: 500 }
    );
  }
}
