'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  X,
  Wallet,
  Zap,
  Clock,
  CreditCard,
  Check,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Lock,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Eye,
  EyeOff,
  Copy,
  ChevronLeft,
  Receipt,
  QrCode,
  Info,
  RotateCcw,
  Sparkles,
  Star,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  method: string | null;
  description: string | null;
  reference: string | null;
  status: string;
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  enabled: boolean;
  account?: string;
  accountLabel?: string;
  instructions?: string;
  color: string;
  minAmount: number;
  maxAmount: number;
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  walletBalance: number;
  currency: string;
  walletTransactions: WalletTransaction[];
  paymentMethods: PaymentMethod[];
  onRecharge: (amount: number, method: string, reference?: string) => Promise<boolean>;
  onFetchWallet: () => Promise<void>;
  onOpenVisa: (amount: string) => void;
  autoConfirm?: boolean;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقائق`;
  if (diffHour < 24) return `منذ ${diffHour} ساعات`;
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  if (diffDay < 30) return `منذ ${Math.floor(diffDay / 7)} أسبوع`;
  return date.toLocaleDateString('ar-EG');
}

function maskAccount(account: string): string {
  if (!account || account.length <= 4) return account;
  const visible = account.slice(-4);
  const masked = '•'.repeat(Math.min(account.length - 4, 8));
  return masked + visible;
}

function generateReceiptNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'RCP-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Luhn Algorithm                                                     */
/* ------------------------------------------------------------------ */

function luhnCheck(num: string): boolean {
  const clean = num.replace(/\s/g, '');
  if (!/^\d+$/.test(clean)) return false;
  let sum = 0;
  let isEven = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/* ------------------------------------------------------------------ */
/*  Card Detection / Formatting                                        */
/* ------------------------------------------------------------------ */

function detectCardBrand(number: string): 'visa' | 'mastercard' | 'amex' | 'unknown' {
  const clean = number.replace(/\s/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  return 'unknown';
}

function formatCardNumber(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 16);
  if (detectCardBrand(clean) === 'amex') {
    return clean.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' ')
    );
  }
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 2) {
    return clean.slice(0, 2) + '/' + clean.slice(2);
  }
  return clean;
}

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

/* ------------------------------------------------------------------ */
/*  Animated Counter                                                   */
/* ------------------------------------------------------------------ */

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const start = 0;
    const duration = 900;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (value - start) * eased;
      setDisplay(Math.round(current).toLocaleString('ar-EG'));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value]);

  return <>{display}</>;
}

/* ------------------------------------------------------------------ */
/*  Premium Particles                                                  */
/* ------------------------------------------------------------------ */

function PremiumParticles({ dark }: { dark: boolean }) {
  const particles = useMemo(() => {
    const shapes = ['circle', 'diamond', 'ring'] as const;
    const colors = dark
      ? ['rgba(52,211,153,0.15)', 'rgba(20,184,166,0.12)', 'rgba(6,182,212,0.10)', 'rgba(251,191,36,0.08)']
      : ['rgba(16,185,129,0.14)', 'rgba(20,184,166,0.11)', 'rgba(6,182,212,0.09)', 'rgba(251,191,36,0.07)'];

    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      size: 8 + Math.random() * 60,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colors[i % colors.length],
      shape: shapes[i % shapes.length],
      duration: 5 + Math.random() * 8,
      delay: Math.random() * 3,
    }));
  }, [dark]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Radial glow */}
      <div
        className="absolute -top-1/2 -left-1/4 w-[150%] h-[200%] opacity-40"
        style={{
          background: dark
            ? 'radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.20) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.15) 0%, transparent 60%)',
        }}
      />
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background:
              p.shape === 'circle'
                ? p.color
                : p.shape === 'diamond'
                  ? 'transparent'
                  : 'transparent',
            border: p.shape === 'ring' ? `1.5px solid ${p.color}` : undefined,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'diamond' ? '2px' : '50%',
            transform: p.shape === 'diamond' ? 'rotate(45deg)' : undefined,
          }}
          animate={{
            y: [0, -12, 8, -6, 0],
            x: [0, 8, -5, 10, 0],
            scale: [1, 1.08, 0.95, 1.05, 1],
            opacity: [0.6, 1, 0.7, 0.9, 0.6],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3D Credit Card with Mouse Tracking                                 */
/* ------------------------------------------------------------------ */

function Card3D({
  number,
  name,
  expiry,
  dark,
}: {
  number: string;
  name: string;
  expiry: string;
  dark: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const rotateX = useTransform(mouseY, [0, 1], [8, -8]);
  const rotateY = useTransform(mouseX, [0, 1], [-8, 8]);

  const brand = detectCardBrand(number);
  const brandLabel =
    brand === 'visa' ? 'VISA' : brand === 'mastercard' ? 'Mastercard' : brand === 'amex' ? 'AMEX' : '';

  const gradients: Record<string, string> = {
    visa: 'linear-gradient(135deg, #064e3b 0%, #065f46 35%, #047857 70%, #059669 100%)',
    mastercard: 'linear-gradient(135deg, #134e4a 0%, #115e59 35%, #0f766e 70%, #0d9488 100%)',
    amex: 'linear-gradient(135deg, #164e63 0%, #155e75 35%, #0e7490 70%, #0891b2 100%)',
    unknown: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
  };

  const glowColor =
    brand === 'visa'
      ? 'rgba(16,185,129,0.25)'
      : brand === 'mastercard'
        ? 'rgba(20,184,166,0.25)'
        : brand === 'amex'
          ? 'rgba(8,145,178,0.25)'
          : 'rgba(100,116,139,0.15)';

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    },
    [mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={cardRef}
      className="relative w-full max-w-xs mx-auto aspect-[1.586/1] rounded-2xl overflow-hidden cursor-pointer select-none"
      style={{
        perspective: 800,
        transformStyle: 'preserve-3d',
        rotateX,
        rotateY,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: gradients[brand],
          boxShadow: dark
            ? `0 30px 60px -15px rgba(0,0,0,0.5), 0 0 50px ${glowColor}`
            : `0 30px 60px -15px rgba(0,0,0,0.3), 0 0 40px ${glowColor}`,
        }}
      >
        <div className="absolute inset-0 rounded-2xl p-5 sm:p-6 flex flex-col justify-between" style={{ transformStyle: 'preserve-3d' }}>
          {/* Top */}
          <div className="flex items-start justify-between">
            <div
              className="w-11 h-8 rounded-md"
              style={{
                background:
                  'linear-gradient(135deg, #d4a855 0%, #c49b3c 25%, #e8c86e 50%, #c49b3c 75%, #b08a30 100%)',
                boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.2)',
              }}
            >
              <div className="w-full h-full rounded-md flex items-center justify-center">
                <div className="w-7 h-5 border border-yellow-700/20 rounded-[3px]" style={{ background: 'linear-gradient(90deg, transparent 48%, rgba(0,0,0,0.05) 50%, transparent 52%)' }} />
              </div>
            </div>
            <div className="text-white/90 text-base sm:text-lg font-black tracking-widest" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              {brandLabel || 'CARD'}
            </div>
          </div>

          {/* NFC icon */}
          <div className="absolute top-1/2 right-5 -translate-y-1/2 opacity-20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M6 18c3.3-3.3 3.3-8.7 0-12" strokeLinecap="round" />
              <path d="M10 18c2-2 2-10 0-12" strokeLinecap="round" />
              <path d="M14 18c1-1 1-11 0-12" strokeLinecap="round" />
            </svg>
          </div>

          {/* Number */}
          <div className="text-center text-white text-base sm:text-xl tracking-[0.18em] font-mono" dir="ltr" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
            {number || '••••  ••••  ••••  ••••'}
          </div>

          {/* Bottom */}
          <div className="flex items-end justify-between" dir="ltr">
            <div>
              <div className="text-white/40 text-[9px] sm:text-[10px] uppercase tracking-widest mb-0.5">Card Holder</div>
              <div className="text-white text-xs sm:text-sm tracking-wider font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                {name || 'YOUR NAME'}
              </div>
            </div>
            <div className="text-left">
              <div className="text-white/40 text-[9px] sm:text-[10px] uppercase tracking-widest mb-0.5">Expires</div>
              <div className="text-white text-xs sm:text-sm font-medium">{expiry || 'MM/YY'}</div>
            </div>
          </div>
        </div>

        {/* Holographic shimmer */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 58%, transparent 65%)',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%', '0% 0%'],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Luhn Indicator                                                     */
/* ------------------------------------------------------------------ */

function LuhnIndicator({ number }: { number: string }) {
  const clean = number.replace(/\s/g, '');
  const isComplete = clean.length >= 13;
  const isValid = isComplete && luhnCheck(clean);

  if (!isComplete) return null;

  return (
    <AnimatePresence mode="wait">
      {isValid ? (
        <motion.div
          key="valid"
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] font-semibold text-emerald-500">بطاقة صالحة</span>
        </motion.div>
      ) : (
        <motion.div
          key="invalid"
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <X className="w-3 h-3 text-rose-500" />
          <span className="text-[10px] font-semibold text-rose-500">رقم غير صالح</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Processing Animation                                               */
/* ------------------------------------------------------------------ */

function ProcessingAnimation() {
  return (
    <div className="py-16 flex flex-col items-center gap-6">
      <div className="relative w-20 h-20">
        <motion.div
          className="absolute inset-0 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-2.5 rounded-full border-[3px] border-teal-500/20 border-b-teal-500"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-5 rounded-full border-[2px] border-cyan-500/20 border-t-cyan-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Lock className="w-6 h-6 text-emerald-400" />
          </motion.div>
        </div>
      </div>

      <div className="text-center">
        <motion.p
          className="font-bold text-base"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          جاري معالجة الدفع
        </motion.p>
        <p className="text-xs mt-2 opacity-60">يرجى الانتظار ولا تغلق الصفحة</p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confetti Success                                                   */
/* ------------------------------------------------------------------ */

function ConfettiSuccess({ onComplete }: { onComplete: () => void }) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        y: -(Math.random() * 180 + 40),
        rotation: Math.random() * 720 - 360,
        color: ['#10b981', '#14b8a6', '#06b6d4', '#34d399', '#2dd4bf', '#fbbf24', '#a7f3d0', '#22d3ee'][
          Math.floor(Math.random() * 8)
        ],
        size: 4 + Math.random() * 8,
        delay: Math.random() * 0.4,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
      })),
    []
  );

  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="relative flex flex-col items-center gap-5 py-10">
      {/* Pulse rings */}
      <motion.div
        className="absolute top-10 w-24 h-24 rounded-full bg-emerald-500/10"
        initial={{ scale: 0 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute top-10 w-24 h-24 rounded-full bg-emerald-500/5"
        initial={{ scale: 0 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 2, ease: 'easeOut', delay: 0.3 }}
      />

      {/* Check icon */}
      <motion.div
        className="relative z-10 w-20 h-20"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
        >
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
      </motion.div>

      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <p className="text-emerald-400 font-bold text-lg">تمت العملية بنجاح!</p>
        <p className="text-xs opacity-60 mt-1">سيتم شحن رصيدك قريباً</p>
      </motion.div>

      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((c) => (
          <motion.div
            key={c.id}
            className="absolute left-1/2 top-1/3"
            style={{
              width: c.size,
              height: c.shape === 'circle' ? c.size : c.size * 0.6,
              backgroundColor: c.color,
              borderRadius: c.shape === 'circle' ? '50%' : '2px',
            }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: c.x, y: c.y, rotate: c.rotation, opacity: 0 }}
            transition={{ duration: 1.8, delay: c.delay, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Receipt Card                                                       */
/* ------------------------------------------------------------------ */

function ReceiptCard({ receiptNo, amount, currency, dark }: { receiptNo: string; amount: number; currency: string; dark: boolean }) {
  const textPrimary = dark ? 'text-white' : 'text-gray-900';
  const textSecondary = dark ? 'text-gray-400' : 'text-gray-500';

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden ${dark ? 'bg-[#1a1d27]' : 'bg-gray-50'} border ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
    >
      {/* Dashed top border */}
      <div className="h-px" style={{ background: 'repeating-linear-gradient(90deg, #10b981 0, #10b981 6px, transparent 6px, transparent 12px)' }} />

      <div className="px-5 py-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-500" />
          <span className={`text-xs font-semibold ${textPrimary}`}>رقم إيصال الشحن</span>
        </div>

        <div
          className="font-mono text-lg font-bold tracking-[0.15em] px-4 py-2 rounded-lg inline-block"
          style={{
            background: dark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.08))'
              : 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(20,184,166,0.05))',
            color: dark ? '#34d399' : '#059669',
          }}
          dir="ltr"
        >
          {receiptNo}
        </div>

        <p className={`text-xs ${textSecondary}`}>
          المبلغ: <span className="font-bold" dir="ltr">{amount.toLocaleString('ar-EG')} {currency}</span>
        </p>
        <p className={`text-[10px] ${textSecondary}`}>
          احتفظ بهذا الرقم كمرجع للتتبع
        </p>
      </div>

      {/* Dashed bottom border */}
      <div className="h-px" style={{ background: 'repeating-linear-gradient(90deg, #10b981 0, #10b981 6px, transparent 6px, transparent 12px)' }} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Transaction Timeline Icon                                          */
/* ------------------------------------------------------------------ */

function TxIcon({ type, isLast }: { type: string; isLast: boolean }) {
  const isCredit = type === 'credit' || type === 'recharge';
  const isRefund = type === 'refund';

  const color = isCredit ? '#10b981' : isRefund ? '#0891b2' : '#f43f5e';
  const bg = isCredit ? 'rgba(16,185,129,0.12)' : isRefund ? 'rgba(8,145,178,0.12)' : 'rgba(244,63,94,0.12)';

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {isCredit ? (
          <ArrowDownLeft className="w-4.5 h-4.5" style={{ color }} />
        ) : isRefund ? (
          <RotateCcw className="w-4.5 h-4.5" style={{ color }} />
        ) : (
          <ArrowUpRight className="w-4.5 h-4.5" style={{ color }} />
        )}
      </motion.div>
      {!isLast && (
        <div className="w-px flex-1 min-h-[16px]" style={{ background: 'rgba(128,128,128,0.12)' }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
    completed: { label: 'مكتمل', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    pending: { label: 'قيد المراجعة', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
    failed: { label: 'فشلت', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)' },
  };
  const c = cfg[status] || cfg.pending;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {status === 'pending' && <Clock className="w-3 h-3" />}
      {status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'failed' && <AlertCircle className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wallet Modal                                                  */
/* ------------------------------------------------------------------ */

export function WalletModal({
  isOpen,
  onClose,
  darkMode,
  walletBalance,
  currency,
  walletTransactions,
  paymentMethods,
  onRecharge,
  onFetchWallet,
  onOpenVisa,
  autoConfirm,
  addToast,
}: WalletModalProps) {
  /* ---------- state ---------- */
  const [activeTab, setActiveTab] = useState<'recharge' | 'transactions'>('recharge');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  // Visa sub-modal
  const [showVisa, setShowVisa] = useState(false);
  const [visaAmount, setVisaAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [visaSubmitting, setVisaSubmitting] = useState(false);
  const [visaSuccess, setVisaSuccess] = useState(false);
  const [visaError, setVisaError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tabDirection, setTabDirection] = useState(1);

  /* ---------- theme tokens ---------- */
  const bg = darkMode ? 'bg-[#0f1117]' : 'bg-gray-50/80';
  const bgCard = darkMode ? 'bg-[#1a1d27]' : 'bg-white';
  const bgCardAlt = darkMode ? 'bg-[#232733]' : 'bg-gray-50';
  const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = darkMode ? 'border-white/[0.06]' : 'border-gray-200/80';
  const inputBg = darkMode ? 'bg-[#232733]' : 'bg-white';
  const inputBorder = darkMode ? 'border-white/[0.08]' : 'border-gray-200';

  /* ---------- computed ---------- */
  const enabledMethods = useMemo(() => paymentMethods.filter((m) => m.enabled), [paymentMethods]);

  const pendingCount = useMemo(
    () => walletTransactions.filter((t) => t.type === 'credit' && t.status === 'pending').length,
    [walletTransactions]
  );

  const effectiveAmount = selectedAmount || parseFloat(customAmount) || 0;

  const selectedMethodData = useMemo(
    () => enabledMethods.find((m) => m.id === selectedMethod) || null,
    [enabledMethods, selectedMethod]
  );

  /* ---------- handlers ---------- */
  const handleCopy = useCallback(
    (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      addToast('تم النسخ', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    },
    [addToast]
  );

  const handleTabChange = useCallback((tab: 'recharge' | 'transactions') => {
    setTabDirection(tab === 'transactions' ? 1 : -1);
    setActiveTab(tab);
  }, []);

  const handleRechargeSubmit = useCallback(async () => {
    if (!effectiveAmount || effectiveAmount <= 0) {
      addToast('يرجى تحديد المبلغ', 'error');
      return;
    }
    if (!selectedMethod) {
      addToast('يرجى اختيار طريقة الدفع', 'error');
      return;
    }
    const method = enabledMethods.find((m) => m.id === selectedMethod);
    if (!method) return;

    if (effectiveAmount < method.minAmount) {
      addToast(`الحد الأدنى ${method.minAmount} ${currency}`, 'error');
      return;
    }
    if (effectiveAmount > method.maxAmount) {
      addToast(`الحد الأقصى ${method.maxAmount} ${currency}`, 'error');
      return;
    }

    if (method.nameEn === 'Visa' || method.id === 'visa') {
      setVisaAmount(effectiveAmount.toString());
      setShowVisa(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onRecharge(effectiveAmount, selectedMethod, reference.trim() || undefined);
      if (success) {
        const receipt = generateReceiptNumber();
        setReceiptNumber(receipt);
        addToast('تم إرسال طلب الشحن بنجاح', 'success');
        setSelectedAmount(null);
        setCustomAmount('');
        setReference('');
        setSelectedMethod(null);
        await onFetchWallet();
        setTimeout(() => setReceiptNumber(null), 8000);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [effectiveAmount, selectedMethod, enabledMethods, currency, reference, onRecharge, addToast, onFetchWallet]);

  const handleVisaSubmit = useCallback(async () => {
    const errors: Record<string, boolean> = {};
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (cleanNumber.length < 13) errors.number = true;
    else if (!luhnCheck(cleanNumber)) {
      setVisaError('رقم البطاقة غير صالح');
      setFieldErrors({ number: true });
      return;
    }
    if (!cardName.trim()) errors.name = true;
    if (cardExpiry.replace(/\D/g, '').length < 4) errors.expiry = true;
    if (cardCvv.length < 3) errors.cvv = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setVisaError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setFieldErrors({});
    setVisaError(null);
    setVisaSubmitting(true);

    try {
      const txId = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const res = await fetch('/api/payments/visa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(visaAmount) || 0,
          cardNumber,
          cardExpiry,
          cardCvv,
          cardHolderName: cardName,
          action: 'process',
          transactionId: txId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVisaError(data.error || 'فشلت عملية الدفع');
        if (data.field) {
          const fieldMap: Record<string, string> = { cardNumber: 'number', cardExpiry: 'expiry', cardCvv: 'cvv', cardHolderName: 'name' };
          if (fieldMap[data.field]) setFieldErrors({ [fieldMap[data.field]]: true });
        }
        setVisaSubmitting(false);
        return;
      }

      // Success
      setVisaSubmitting(false);
      setVisaSuccess(true);
    } catch {
      setVisaError('حدث خطأ في الاتصال — تحقق من الإنترنت وحاول مرة أخرى');
      setVisaSubmitting(false);
    }
  }, [cardNumber, cardName, cardExpiry, cardCvv, visaAmount]);

  const handleVisaClose = useCallback(() => {
    if (visaSubmitting) return;
    setShowVisa(false);
    setTimeout(() => {
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCvv('');
      setVisaSuccess(false);
      setVisaError(null);
      setFieldErrors({});
    }, 300);
  }, [visaSubmitting]);

  const handleSuccessComplete = useCallback(() => {
    setShowVisa(false);
    setVisaSuccess(false);
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setCardCvv('');
    setVisaError(null);
    setFieldErrors({});
    addToast('تمت عملية الدفع بنجاح', 'success');
    onFetchWallet();
    setSelectedAmount(null);
    setCustomAmount('');
    setSelectedMethod(null);
  }, [addToast, onFetchWallet]);

  /* ---------- payment method gradient helper ---------- */
  const getMethodGradient = useCallback(
    (method: PaymentMethod, selected: boolean) => {
      if (selected && method.color) {
        return darkMode
          ? `linear-gradient(135deg, ${method.color}22, ${method.color}08)`
          : `linear-gradient(135deg, ${method.color}18, ${method.color}06)`;
      }
      return undefined;
    },
    [darkMode]
  );

  /* ---------- render ---------- */
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ====== OVERLAY ====== */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* ====== MAIN MODAL ====== */}
          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 40 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <div
              className={`w-full max-w-lg rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-auto flex flex-col max-h-[92vh] sm:max-h-[88vh] ${
                darkMode ? 'bg-[#0f1117]/95' : 'bg-white/95'
              } backdrop-blur-2xl`}
              style={{
                boxShadow: darkMode
                  ? '0 0 0 1px rgba(255,255,255,0.05), 0 30px 80px -12px rgba(0,0,0,0.7), 0 0 80px rgba(16,185,129,0.04)'
                  : '0 0 0 1px rgba(0,0,0,0.04), 0 30px 80px -12px rgba(0,0,0,0.15), 0 0 60px rgba(16,185,129,0.03)',
              }}
            >
              {/* ==================== HEADER ==================== */}
              <div className="relative overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #0d9488 35%, #0891b2 70%, #059669 100%)',
                    backgroundSize: '300% 300%',
                  }}
                >
                  <style>{`
                    @keyframes hdrGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
                  `}</style>
                </div>
                <div className="absolute inset-0" style={{ animation: 'hdrGrad 8s ease infinite' }} />

                <PremiumParticles dark={darkMode} />

                <div className="relative z-10 px-5 sm:px-6 pt-5 sm:pt-6 pb-5 sm:pb-6">
                  {/* Top bar */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <Wallet className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-white font-bold text-lg leading-tight">محفظتي</h2>
                        <p className="text-white/50 text-[11px]">إدارة الرصيد والشحن</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && (
                        <motion.div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 backdrop-blur-sm border border-amber-300/20"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          <Clock className="w-3 h-3 text-amber-300" />
                          <span className="text-white text-[11px] font-medium">{pendingCount} قيد المراجعة</span>
                        </motion.div>
                      )}
                      <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-all hover:rotate-90"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* Balance Card */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/50 text-xs mb-1.5">الرصيد الحالي</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-white text-3xl sm:text-4xl font-black tabular-nums" dir="ltr">
                            {balanceVisible ? <AnimatedCounter value={walletBalance} /> : '••••••'}
                          </span>
                          <span className="text-white/50 text-sm font-medium">{currency}</span>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => setBalanceVisible((v) => !v)}
                        className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        {balanceVisible ? (
                          <Eye className="w-4.5 h-4.5 text-white/80" />
                        ) : (
                          <EyeOff className="w-4.5 h-4.5 text-white/80" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ==================== TABS ==================== */}
              <div className={`px-5 sm:px-6 pt-3 sm:pt-4 ${borderColor} border-b`}>
                <div className="flex gap-1 relative">
                  {[
                    { id: 'recharge' as const, label: 'شحن الرصيد', icon: Zap },
                    { id: 'transactions' as const, label: 'السجل', icon: Clock },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative flex items-center justify-center gap-2 flex-1 py-3 text-sm font-semibold transition-colors rounded-lg ${
                        activeTab === tab.id
                          ? darkMode
                            ? 'text-emerald-400'
                            : 'text-emerald-600'
                          : textSecondary
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="walletTabLine"
                          className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                          style={{
                            background: 'linear-gradient(90deg, #10b981, #14b8a6, #06b6d4)',
                          }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ==================== CONTENT ==================== */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
                <AnimatePresence mode="wait" initial={false} custom={tabDirection}>
                  {/* ========== RECHARGE TAB ========== */}
                  {activeTab === 'recharge' ? (
                    <motion.div
                      key="recharge"
                      custom={tabDirection}
                      initial={{ x: -20 * tabDirection, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20 * tabDirection, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="p-5 sm:p-6 space-y-5"
                    >
                      {/* Auto-confirm badge */}
                      {autoConfirm && (
                        <motion.div
                          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-emerald-500/20"
                          style={{ background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)' }}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <span className="text-emerald-500 text-xs font-semibold">شحن تلقائي فوري ✨</span>
                        </motion.div>
                      )}

                      {/* Quick amounts */}
                      <div>
                        <label className={`text-sm font-bold mb-3 block ${textPrimary}`}>
                          <Banknote className="inline w-4 h-4 ml-1.5 opacity-60" />
                          اختر المبلغ
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {QUICK_AMOUNTS.map((amount, i) => {
                            const isSelected = selectedAmount === amount;
                            return (
                              <motion.button
                                key={amount}
                                onClick={() => {
                                  setSelectedAmount(amount);
                                  setCustomAmount('');
                                  setReceiptNumber(null);
                                }}
                                className={`relative py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all overflow-hidden ${
                                  isSelected
                                    ? darkMode
                                      ? 'text-emerald-300'
                                      : 'text-emerald-600'
                                    : `${textSecondary} hover:opacity-80`
                                }`}
                                style={{
                                  background: isSelected
                                    ? darkMode
                                      ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(20,184,166,0.12))'
                                      : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.06))'
                                    : darkMode
                                      ? 'rgba(255,255,255,0.04)'
                                      : 'rgba(0,0,0,0.02)',
                                  border: isSelected
                                    ? '1.5px solid rgba(16,185,129,0.35)'
                                    : darkMode
                                      ? '1px solid rgba(255,255,255,0.06)'
                                      : '1px solid rgba(0,0,0,0.06)',
                                }}
                                whileTap={{ scale: 0.93 }}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 22 }}
                              >
                                {isSelected && (
                                  <motion.div
                                    className="absolute inset-0"
                                    layoutId="amountGlow"
                                    style={{
                                      background: darkMode
                                        ? 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.12), transparent 70%)'
                                        : 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.08), transparent 70%)',
                                    }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                  />
                                )}
                                <span className="relative z-10">{amount.toLocaleString('ar-EG')}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom amount */}
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="أو أدخل مبلغ آخر..."
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            setSelectedAmount(null);
                            setReceiptNumber(null);
                          }}
                          className={`w-full px-4 py-3 pr-10 rounded-xl border ${inputBg} ${inputBorder} ${textPrimary} text-sm placeholder:text-gray-400 outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 ${
                            darkMode ? 'placeholder:text-gray-500' : ''
                          }`}
                          dir="ltr"
                        />
                        <Banknote className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
                        {customAmount && (
                          <motion.button
                            onClick={() => setCustomAmount('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <X className="w-3 h-3 text-gray-400" />
                          </motion.button>
                        )}
                      </div>

                      {/* Payment methods */}
                      <div>
                        <label className={`text-sm font-bold mb-3 block ${textPrimary}`}>
                          <CreditCard className="inline w-4 h-4 ml-1.5 opacity-60" />
                          طريقة الدفع
                        </label>
                        <div className="space-y-2.5">
                          {enabledMethods.map((method, i) => {
                            const isSelected = selectedMethod === method.id;
                            const isVisa = method.nameEn === 'Visa' || method.id === 'visa';
                            return (
                              <motion.button
                                key={method.id}
                                onClick={() => setSelectedMethod(method.id)}
                                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all text-right overflow-hidden relative group ${
                                  isSelected
                                    ? ''
                                    : `${borderColor} hover:border-emerald-500/20`
                                }`}
                                style={{
                                  background: getMethodGradient(method, isSelected) || (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                                  borderColor: isSelected
                                    ? method.color
                                      ? method.color + '40'
                                      : 'rgba(16,185,129,0.3)'
                                    : undefined,
                                }}
                                whileHover={{ scale: 1.005 }}
                                whileTap={{ scale: 0.985 }}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.2 }}
                              >
                                {/* Brand icon */}
                                <div
                                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl shadow-sm"
                                  style={{
                                    background: method.color
                                      ? `linear-gradient(135deg, ${method.color}40, ${method.color}15)`
                                      : darkMode
                                        ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(20,184,166,0.08))'
                                        : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(20,184,166,0.05))',
                                  }}
                                >
                                  {method.icon || '💳'}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-bold ${textPrimary}`}>
                                    {method.name}
                                    {isVisa && (
                                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                                        فوري
                                      </span>
                                    )}
                                  </div>

                                  {method.account && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`text-xs ${textSecondary}`}>
                                        {method.accountLabel || 'الحساب'}:{' '}
                                      </span>
                                      <span className={`text-xs font-mono font-semibold ${textPrimary}`} dir="ltr">
                                        {maskAccount(method.account)}
                                      </span>
                                      <motion.button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(method.account || '', method.id);
                                        }}
                                        className="shrink-0 p-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                                        whileTap={{ scale: 0.85 }}
                                      >
                                        {copiedId === method.id ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                      </motion.button>
                                    </div>
                                  )}

                                  {method.minAmount > 0 && (
                                    <p className={`text-[10px] mt-0.5 ${textSecondary}`}>
                                      الحد: {method.minAmount} - {method.maxAmount.toLocaleString('ar-EG')} {currency}
                                    </p>
                                  )}
                                </div>

                                {/* Radio */}
                                <div
                                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                                  style={{
                                    borderColor: isSelected
                                      ? method.color || '#10b981'
                                      : darkMode
                                        ? 'rgba(255,255,255,0.15)'
                                        : 'rgba(0,0,0,0.15)',
                                  }}
                                >
                                  {isSelected && (
                                    <motion.div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ background: method.color || '#10b981' }}
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                    />
                                  )}
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Instructions & Reference */}
                      <AnimatePresence>
                        {selectedMethodData &&
                          selectedMethodData.instructions &&
                          !selectedMethodData.instructions.startsWith('Visa') && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <div
                                className={`relative rounded-xl overflow-hidden ${darkMode ? 'bg-[#1a1d27]' : 'bg-gray-50'} border`}
                                style={{
                                  borderColor: selectedMethodData.color
                                    ? selectedMethodData.color + '30'
                                    : 'rgba(16,185,129,0.2)',
                                }}
                              >
                                <div className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                      style={{
                                        background: selectedMethodData.color
                                          ? selectedMethodData.color + '20'
                                          : 'rgba(16,185,129,0.15)',
                                      }}
                                    >
                                      <Send className="w-4 h-4" style={{ color: selectedMethodData.color || '#10b981' }} />
                                    </div>
                                    <div className="flex-1">
                                      <p className={`text-sm font-bold ${textPrimary} mb-1.5`}>
                                        تعليمات التحويل
                                      </p>
                                      <p className={`text-xs leading-relaxed ${textSecondary} whitespace-pre-line`}>
                                        {selectedMethodData.instructions}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 relative">
                                <input
                                  type="text"
                                  placeholder="رقم مرجع التحويل (اختياري)"
                                  value={reference}
                                  onChange={(e) => setReference(e.target.value)}
                                  className={`w-full px-4 py-3 pr-10 rounded-xl border ${inputBg} ${inputBorder} ${textPrimary} text-sm placeholder:text-gray-400 outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 ${
                                    darkMode ? 'placeholder:text-gray-500' : ''
                                  }`}
                                  dir="ltr"
                                />
                                <ShieldCheck className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
                              </div>
                            </motion.div>
                          )}
                      </AnimatePresence>

                      {/* Receipt */}
                      <AnimatePresence>
                        {receiptNumber && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <ReceiptCard receiptNo={receiptNumber} amount={effectiveAmount} currency={currency} dark={darkMode} />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit button */}
                      <motion.button
                        onClick={handleRechargeSubmit}
                        disabled={isSubmitting || !effectiveAmount || !selectedMethod}
                        className={`w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden`}
                        style={{
                          background:
                            effectiveAmount && selectedMethod
                              ? 'linear-gradient(135deg, #059669, #0d9488, #0891b2)'
                              : darkMode
                                ? '#232733'
                                : '#e5e7eb',
                          boxShadow:
                            effectiveAmount && selectedMethod
                              ? '0 8px 30px -6px rgba(5,150,105,0.4)'
                              : 'none',
                        }}
                        whileHover={effectiveAmount && selectedMethod ? { scale: 1.01, y: -1 } : undefined}
                        whileTap={effectiveAmount && selectedMethod ? { scale: 0.98 } : undefined}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري الإرسال...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>
                              {effectiveAmount > 0
                                ? `شحن ${effectiveAmount.toLocaleString('ar-EG')} ${currency}`
                                : 'شحن الرصيد'}
                            </span>
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  ) : (
                    /* ========== TRANSACTIONS TAB ========== */
                    <motion.div
                      key="transactions"
                      custom={tabDirection}
                      initial={{ x: -20 * tabDirection, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20 * tabDirection, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="p-5 sm:p-6"
                    >
                      {walletTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                          <motion.div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Wallet className="w-9 h-9 opacity-30" />
                          </motion.div>
                          <p className={`text-sm font-bold ${textPrimary} mb-1.5`}>لا توجد معاملات</p>
                          <p className={`text-xs ${textSecondary}`}>لم تقم بأي عمليات شحن أو سحب بعد</p>
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {/* Stats bar */}
                          <div className="grid grid-cols-2 gap-2.5 mb-5">
                            {[
                              {
                                label: 'إجمالي الشحن',
                                value: walletTransactions
                                  .filter((t) => t.type === 'credit' || t.type === 'recharge')
                                  .reduce((s, t) => s + t.amount, 0),
                                color: '#10b981',
                                bg: 'rgba(16,185,129,0.08)',
                              },
                              {
                                label: 'إجمالي المصروفات',
                                value: walletTransactions
                                  .filter((t) => t.type === 'debit' || t.type === 'payment')
                                  .reduce((s, t) => s + t.amount, 0),
                                color: '#f43f5e',
                                bg: 'rgba(244,63,94,0.08)',
                              },
                            ].map((stat) => (
                              <div
                                key={stat.label}
                                className={`rounded-xl p-3 border ${borderColor}`}
                                style={{ background: darkMode ? 'rgba(255,255,255,0.02)' : stat.bg }}
                              >
                                <p className={`text-[10px] ${textSecondary} mb-0.5`}>{stat.label}</p>
                                <p className="text-sm font-bold tabular-nums" style={{ color: stat.color }} dir="ltr">
                                  {stat.value.toLocaleString('ar-EG')} {currency}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Timeline */}
                          <div className="space-y-0">
                            {walletTransactions.map((tx, index) => {
                              const isCredit = tx.type === 'credit' || tx.type === 'recharge';
                              const isRefund = tx.type === 'refund';
                              const isLast = index === walletTransactions.length - 1;

                              return (
                                <motion.div
                                  key={tx.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.04, duration: 0.3 }}
                                  className={`flex gap-3 ${isLast ? '' : 'pb-4'}`}
                                >
                                  {/* Timeline icon */}
                                  <TxIcon type={tx.type} isLast={isLast} />

                                  {/* Content card */}
                                  <div
                                    className={`flex-1 min-w-0 rounded-xl p-3 border ${borderColor} transition-colors`}
                                    style={{
                                      background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                                    }}
                                  >
                                    <div className="flex items-start justify-between mb-1.5">
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${textPrimary}`}>
                                          {tx.description || (isCredit ? 'إيداع' : isRefund ? 'استرداد' : 'سحب')}
                                        </p>
                                      </div>
                                      <span
                                        className="text-sm font-black tabular-nums shrink-0 mr-2"
                                        style={{
                                          color: isCredit ? '#10b981' : isRefund ? '#0891b2' : '#f43f5e',
                                        }}
                                        dir="ltr"
                                      >
                                        {isCredit || isRefund ? '+' : '-'}
                                        {tx.amount.toLocaleString('ar-EG')}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <StatusBadge status={tx.status} />
                                      {tx.method && (
                                        <span className={`text-[10px] ${textSecondary}`}>{tx.method}</span>
                                      )}
                                      {tx.reference && (
                                        <span className={`text-[10px] font-mono ${textSecondary}`} dir="ltr">
                                          #{tx.reference.slice(0, 8)}
                                        </span>
                                      )}
                                      <span className={`text-[10px] ${textSecondary}`}>
                                        {getRelativeTime(tx.createdAt)}
                                      </span>
                                    </div>

                                    <div className={`mt-1.5 text-[10px] ${textSecondary}`}>
                                      الرصيد: <span className="font-semibold" dir="ltr">{tx.balance.toLocaleString('ar-EG')} {currency}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* ====== VISA SUB-MODAL ====== */}
          <AnimatePresence>
            {showVisa && (
              <>
                <motion.div
                  className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleVisaClose}
                />

                <motion.div
                  className="fixed inset-0 z-[201] flex items-center justify-center p-3 sm:p-4 pointer-events-none"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <div
                    className={`w-full max-w-md rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-auto flex flex-col max-h-[92vh] ${
                      darkMode ? 'bg-[#0f1117]/95' : 'bg-white/95'
                    } backdrop-blur-2xl`}
                    style={{
                      boxShadow: darkMode
                        ? '0 0 0 1px rgba(255,255,255,0.05), 0 30px 80px -12px rgba(0,0,0,0.8)'
                        : '0 0 0 1px rgba(0,0,0,0.04), 0 30px 80px -12px rgba(0,0,0,0.2)',
                    }}
                  >
                    {/* Visa header */}
                    <div className="px-5 sm:px-6 pt-5 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                          >
                            <CreditCard className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${textPrimary}`}>دفع بالبطاقة</h3>
                            <p className={`text-xs ${textSecondary}`}>
                              شحن {Number(visaAmount).toLocaleString('ar-EG')} {currency}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleVisaClose}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-gray-100 ${
                            darkMode ? 'hover:bg-white/10' : ''
                          }`}
                        >
                          <X className={`w-4 h-4 ${textSecondary}`} />
                        </button>
                      </div>
                    </div>

                    {/* Visa body */}
                    <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-6 space-y-5">
                      {visaSuccess ? (
                        <ConfettiSuccess onComplete={handleSuccessComplete} />
                      ) : visaSubmitting ? (
                        <ProcessingAnimation />
                      ) : (
                        <>
                          {/* 3D Card */}
                          <div className="pt-1">
                            <Card3D number={cardNumber} name={cardName} expiry={cardExpiry} dark={darkMode} />
                          </div>

                          {/* Error */}
                          <AnimatePresence>
                            {visaError && (
                              <motion.div
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                              >
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <span className="text-rose-500 text-xs font-medium">{visaError}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Card number */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className={`text-xs font-bold ${textPrimary}`}>رقم البطاقة</label>
                              <LuhnIndicator number={cardNumber} />
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={cardNumber}
                                onChange={(e) => {
                                  setCardNumber(formatCardNumber(e.target.value));
                                  if (fieldErrors.number) setFieldErrors((p) => ({ ...p, number: false }));
                                  if (visaError) setVisaError(null);
                                }}
                                placeholder="0000  0000  0000  0000"
                                className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all ${
                                  darkMode
                                    ? 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30'
                                    : 'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30'
                                } ${inputBg} ${inputBorder} ${textPrimary} placeholder:text-gray-400 ${
                                  fieldErrors.number ? '!border-rose-500 !ring-1 !ring-rose-500/30' : ''
                                }`}
                                dir="ltr"
                                maxLength={19}
                              />
                              {cardNumber.replace(/\s/g, '').length >= 1 && detectCardBrand(cardNumber) !== 'unknown' && (
                                <motion.div
                                  className="absolute left-3 top-1/2 -translate-y-1/2"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                >
                                  <span
                                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                      detectCardBrand(cardNumber) === 'visa'
                                        ? 'text-emerald-400 bg-emerald-500/10'
                                        : detectCardBrand(cardNumber) === 'mastercard'
                                          ? 'text-teal-400 bg-teal-500/10'
                                          : 'text-cyan-400 bg-cyan-500/10'
                                    }`}
                                  >
                                    {detectCardBrand(cardNumber)}
                                  </span>
                                </motion.div>
                              )}
                            </div>
                          </div>

                          {/* Holder name */}
                          <div>
                            <label className={`text-xs font-bold mb-1.5 block ${textPrimary}`}>اسم حامل البطاقة</label>
                            <input
                              type="text"
                              value={cardName}
                              onChange={(e) => {
                                setCardName(e.target.value.toUpperCase());
                                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: false }));
                              }}
                              placeholder="YOUR NAME"
                              className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 ${inputBg} ${inputBorder} ${textPrimary} placeholder:text-gray-400 ${
                                fieldErrors.name ? '!border-rose-500 !ring-1 !ring-rose-500/30' : ''
                              }`}
                              dir="ltr"
                            />
                          </div>

                          {/* Expiry + CVV */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={`text-xs font-bold mb-1.5 block ${textPrimary}`}>تاريخ الانتهاء</label>
                              <input
                                type="text"
                                value={cardExpiry}
                                onChange={(e) => {
                                  setCardExpiry(formatExpiry(e.target.value));
                                  if (fieldErrors.expiry) setFieldErrors((p) => ({ ...p, expiry: false }));
                                }}
                                placeholder="MM/YY"
                                className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 ${inputBg} ${inputBorder} ${textPrimary} placeholder:text-gray-400 ${
                                  fieldErrors.expiry ? '!border-rose-500 !ring-1 !ring-rose-500/30' : ''
                                }`}
                                dir="ltr"
                                maxLength={5}
                              />
                            </div>
                            <div>
                              <label className={`text-xs font-bold mb-1.5 block ${textPrimary}`}>CVV</label>
                              <input
                                type="password"
                                value={cardCvv}
                                onChange={(e) => {
                                  setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
                                  if (fieldErrors.cvv) setFieldErrors((p) => ({ ...p, cvv: false }));
                                }}
                                placeholder="•••"
                                className={`w-full px-4 py-3 rounded-xl border font-mono text-sm outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 ${inputBg} ${inputBorder} ${textPrimary} placeholder:text-gray-400 ${
                                  fieldErrors.cvv ? '!border-rose-500 !ring-1 !ring-rose-500/30' : ''
                                }`}
                                dir="ltr"
                                maxLength={4}
                              />
                            </div>
                          </div>

                          {/* Security */}
                          <div className="flex items-center justify-center gap-2 py-1">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className={`text-[11px] font-medium ${textSecondary}`}>
                              معاملة آمنة ومشفّرة بتقنية SSL 256-bit
                            </span>
                          </div>

                          {/* Pay button */}
                          <motion.button
                            onClick={handleVisaSubmit}
                            disabled={!cardNumber || !cardName || !cardExpiry || !cardCvv || visaSubmitting}
                            className={`w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}
                            style={{
                              background:
                                cardNumber && cardName && cardExpiry && cardCvv
                                  ? 'linear-gradient(135deg, #059669, #0d9488, #0891b2)'
                                  : darkMode
                                    ? '#232733'
                                    : '#e5e7eb',
                              boxShadow:
                                cardNumber && cardName && cardExpiry && cardCvv
                                  ? '0 8px 30px -6px rgba(5,150,105,0.4)'
                                  : 'none',
                            }}
                            whileHover={
                              cardNumber && cardName && cardExpiry && cardCvv ? { scale: 1.01, y: -1 } : undefined
                            }
                            whileTap={
                              cardNumber && cardName && cardExpiry && cardCvv ? { scale: 0.98 } : undefined
                            }
                          >
                            <Lock className="w-4 h-4" />
                            <span>ادفع {Number(visaAmount).toLocaleString('ar-EG')} {currency}</span>
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
