'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Bed, Bath, Phone, ExternalLink, X,
  CreditCard, MessageSquare, Loader2, Eye, EyeOff, Lock, Mail,
  Sun, Moon, Check, AlertCircle, RefreshCw, Star,
  TrendingUp, Filter, Heart, User, MessageCircle, ThumbsUp,
  BarChart3, DollarSign, Settings, LogOut, Menu, AlertTriangle, 
  CheckCircle2, XCircle, Image as ImageIcon, Video,
  ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Hourglass,
  Send, Bot, Home, Crown, Diamond, Ban, Brain, Search,
  VideoIcon, Activity, Wallet, Key, ArrowUp, Layers,
  Download, Smartphone, Zap, Save,
  Clock, Sparkles, Share2, Calendar, BookOpen, Users, FilePen
} from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
// socket.io-client imported dynamically in useEffect to prevent Vercel SSR/hydration issues

// Developer credentials
const DEVELOPER_EMAIL = process.env.NEXT_PUBLIC_DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

// Contact fee now comes from settings (dynamic)

// Status configuration
const statusConfig: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  'pending': { label: 'في انتظار الموافقة', color: 'text-orange-600', bgColor: 'bg-orange-100', dotColor: 'bg-orange-400' },
  'available': { label: 'متاح', color: 'text-emerald-600', bgColor: 'bg-emerald-100', dotColor: 'bg-emerald-400' },
  'preview': { label: 'في معاينة', color: 'text-blue-600', bgColor: 'bg-blue-100', dotColor: 'bg-blue-400' },
  'reserved': { label: 'محجوز', color: 'text-amber-600', bgColor: 'bg-amber-100', dotColor: 'bg-amber-400' },
  'unavailable': { label: 'غير متاح', color: 'text-red-600', bgColor: 'bg-red-100', dotColor: 'bg-red-400' },
  'sold': { label: 'تم البيع', color: 'text-purple-600', bgColor: 'bg-purple-100', dotColor: 'bg-purple-400' },
  'rented': { label: 'تم التأجير', color: 'text-violet-600', bgColor: 'bg-violet-100', dotColor: 'bg-violet-400' },
  'rejected': { label: 'مرفوض', color: 'text-red-700', bgColor: 'bg-red-200', dotColor: 'bg-red-500' },
  'hidden': { label: 'مخفي', color: 'text-gray-600', bgColor: 'bg-gray-200', dotColor: 'bg-gray-400' }
};

// Interfaces
interface Apartment {
  id: string; title: string; price: number; area: string; bedrooms: number; bathrooms: number; floor?: number | null; apartmentSize?: number | null;
  description: string; ownerPhone: string; mapLink: string; imageUrl?: string; images?: string[];
  videoUrl?: string; videos?: string[]; amenities?: string[]; isFeatured?: boolean; isVip?: boolean;
  type: 'rent' | 'sale'; status: string; paymentRef?: string; createdBy?: string; views?: number; createdAt: string;
}

interface Inquiry { id: string; apartmentId: string; userId?: string; name: string; email: string; phone: string; message: string; lifecycleStatus: string; createdAt: string; apartment?: { id: string; title: string; price: number; type: string } | null; payment?: { id: string; status: string; method: string } | null; }

interface Payment { id: string; inquiryId: string; method: string; status: string; amount: number; userId?: string; createdAt: string; inquiry?: { id: string; apartmentId: string; name: string; email: string; phone: string; apartment?: { id: string; title: string; price: number } | null } | null; }

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface User { id: string; identifier: string; name: string; emailVerified?: boolean; isApproved?: boolean; }

// Edit Request Interface
interface PropertyEditRequest {
  id: string;
  apartmentId: string;
  userId: string;
  editType: string;
  newImages?: string[];
  newVideos?: string[];
  newPrice?: number;
  newStatus?: string;
  description?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  apartment?: { id: string; title: string; price: number; status: string; images?: string; videos?: string; type: string; };
  user?: { id: string; name: string; identifier: string; };
}

// Helper functions
function parseJsonArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function processApartment(apt: any): Apartment {
  return { ...apt, images: parseJsonArray(apt.images), videos: parseJsonArray(apt.videos), amenities: parseJsonArray(apt.amenities) };
}

const egyptianAreas = ['المعادي', 'مدينة نصر', 'الدقي', 'المهندسين', 'حلوان', 'عين شمس', 'مصر الجديدة', 'التجمع الخامس', 'الشيخ زايد', 'العباسية', 'المقطم', 'شبرا', 'الزمالك', 'التجمع الأول', 'القاهرة الجديدة', 'أكتوبر', 'العبور', 'الشروق', 'الرقابة', 'فيصل', 'جاردن سيتي', 'المعصرة', 'عابدين', 'الزهراء', 'حدائق القبة', 'مدينة السلام', '15 مايو', 'حلوان الجديدة', 'بدر', 'النزهة', 'المريوطية'];

// Confirm Dialog Component
function ConfirmDialog({ isOpen, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', onConfirm, onCancel, type = 'warning', loading = false, darkMode }: { isOpen: boolean; title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void; onCancel: () => void; type?: 'danger' | 'warning' | 'info'; loading?: boolean; darkMode: boolean; }) {
  if (!isOpen) return null;
  const icons = { danger: <Trash2 className="h-6 w-6 text-red-500" />, warning: <AlertTriangle className="h-6 w-6 text-amber-500" />, info: <AlertCircle className="h-6 w-6 text-blue-500" /> };
  const buttons = { danger: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700', warning: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700', info: 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800' };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
          <div className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>{icons[type]}</div>
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-sm mb-6 whitespace-pre-line ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{message}</p>
            <div className="flex gap-3">
              <button onClick={onCancel} disabled={loading} className={`flex-1 py-3 rounded-xl font-medium transition-all ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{cancelText}</button>
              <button onClick={onConfirm} disabled={loading} className={`flex-1 py-3 rounded-xl font-medium text-white transition-all ${buttons[type]} disabled:opacity-50`}>{loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : confirmText}</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  // State
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [allApartments, setAllApartments] = useState<Apartment[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'rent' | 'sale'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [bedroomsFilter, setBedroomsFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [bathroomsFilter, setBathroomsFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);

  // Modal states
  const [showAuth, setShowAuth] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; senderId: string; receiverId: string | null; content: string; isRead: boolean; createdAt: string; sender?: { id: string; name: string; identifier: string } }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; userId: string; reason: string | null; blockedAt: string; user: { id: string; name: string; identifier: string } }>>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; identifier: string; email: string; isBlocked: boolean; blockReason?: string | null; isApproved?: boolean; emailVerified?: boolean; role?: string; phone?: string | null; createdAt: string }>>([]);
  const [selectedUserDetail, setSelectedUserDetail] = useState<{ id: string; name: string; identifier: string; email: string; isBlocked: boolean; isApproved?: boolean; emailVerified?: boolean; role?: string; phone?: string | null; createdAt: string } | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailData, setUserDetailData] = useState<{ apartments: Apartment[]; payments: Payment[]; inquiries: Inquiry[] }>({ apartments: [], payments: [], inquiries: [] });
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [editApartment, setEditApartment] = useState<Apartment | null>(null);
  const [inquiryApartment, setInquiryApartment] = useState<Apartment | null>(null);
  const [paymentApartment, setPaymentApartment] = useState<Apartment | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [myPendingApartments, setMyPendingApartments] = useState<Apartment[]>([]);
  const [showMyPending, setShowMyPending] = useState(false);

  // Form states
  const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [aptForm, setAptForm] = useState({ title: '', price: '', area: '', bedrooms: '1', bathrooms: '1', floor: '', apartmentSize: '', description: '', ownerPhone: '', mapLink: '', type: 'rent' as 'rent' | 'sale', listingType: 'regular' as 'regular' | 'featured' | 'vip' });
  const [aptSubmitting, setAptSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [userPaidApartments, setUserPaidApartments] = useState<string[]>([]);
  const [userPayments, setUserPayments] = useState<Payment[]>([]);
  const [showMyPayments, setShowMyPayments] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<Array<{ id: string; name: string; identifier: string; email: string; phone: string | null; isApproved: boolean; createdAt: string }>>([]);
  const [devMessageTo, setDevMessageTo] = useState<{ userId: string; userName: string } | null>(null);
  const [devMessageText, setDevMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [devPasswordChange, setDevPasswordChange] = useState({ current: '', new: '', confirm: '' });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' | 'info'; loading?: boolean; confirmText?: string; cancelText?: string; }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
  // Delete user modal with selective options
  const [deleteUserModal, setDeleteUserModal] = useState<{ isOpen: boolean; userId: string; userName: string; loading: boolean; stats: { apartments: number; payments: number; inquiries: number; likes: number; comments: number; messages: number; editRequests: number; blockedUsers: number }; options: { apartments: boolean; payments: boolean; inquiries: boolean; likes: boolean; comments: boolean; messages: boolean; editRequests: boolean; blockedUsers: boolean; }; }>({ isOpen: false, userId: '', userName: '', loading: false, stats: { apartments: 0, payments: 0, inquiries: 0, likes: 0, comments: 0, messages: 0, editRequests: 0, blockedUsers: 0 }, options: { apartments: true, payments: true, inquiries: true, likes: true, comments: true, messages: true, editRequests: true, blockedUsers: true } });
  const [settings, setSettings] = useState<{ 
    contactFee: number; 
    regularFee: number;
    featuredFee: number; 
    premiumFee: number; 
    vipFee: number;
    saleDisplayFee: number;
    rentDisplayFee: number;
    otherServicesFee: number;
    highlightFee: number;
    priorityListingFee: number;
    verifiedListingFee: number;
    currency: string;
  }>({ 
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
    currency: 'ج.م'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [devTab, setDevTab] = useState<'stats' | 'pending' | 'apartments' | 'favorites' | 'payments' | 'messages' | 'userApprovals' | 'users' | 'blocked' | 'settings' | 'logs' | 'editRequests' | 'userLogs'>('stats');
  const [likes, setLikes] = useState<Array<{ id: string; apartmentId: string; userId: string; user: { id: string; name: string }; apartment: { id: string; title: string } | null; createdAt: string }>>([]);
  const [comments, setComments] = useState<Array<{ id: string; apartmentId: string; userId: string; content: string; status: string; user: { id: string; name: string }; createdAt: string }>>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Edit Requests States
  const [editRequests, setEditRequests] = useState<PropertyEditRequest[]>([]);
  const [showEditRequestModal, setShowEditRequestModal] = useState(false);
  const [selectedApartmentForEdit, setSelectedApartmentForEdit] = useState<Apartment | null>(null);
  const [editRequestForm, setEditRequestForm] = useState({
    newImages: [] as string[],
    newVideos: [] as string[],
    newPrice: '',
    newStatus: '',
    description: ''
  });
  const [editRequestLoading, setEditRequestLoading] = useState(false);

  // AI Action States
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Operation Logs
  const [operationLogs, setOperationLogs] = useState<any[]>([]);

  // Approval Logs
  const [approvalLogs, setApprovalLogs] = useState<Array<{ id: string; userId: string; action: string; userName: string; userEmail: string | null; reason: string | null; performedBy: string | null; createdAt: string }>>([]);
  const [approvalLogsLoading, setApprovalLogsLoading] = useState(false);
  const [userLogTab, setUserLogTab] = useState<'all' | 'approved' | 'rejected' | 'revoked'>('all');
  const [userMessagesForLog, setUserMessagesForLog] = useState<Array<{ id: string; senderId: string; receiverId: string | null; content: string; isRead: boolean; createdAt: string; sender?: { id: string; name: string; identifier: string } }>>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const hasPaidForApartment = useCallback((apartmentId: string) => isDeveloper || userPaidApartments.includes(apartmentId), [userPaidApartments, isDeveloper]);

  // ========== Real-time Socket.io Connection ==========
  const socketRef = useRef<any>(null);
  // Use refs instead of state to prevent re-renders from socket.io (not used in JSX)
  const isRealtimeConnectedRef = useRef(false);
  const onlineCountRef = useRef(0);

  // Refs for stable function references (avoids stale closures in socket/polling)
  const fetchApartmentsRef = useRef<((retry?: number, isInitial?: boolean) => Promise<void>) | undefined>(undefined);
  const fetchMessagesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchSettingsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const currentUserRef = useRef<User | null>(null);
  const isDeveloperRef = useRef(false);
  const initialLoadRef = useRef(true);
  const fetchDevDataRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchEditRequestsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const fetchUserPaymentsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const recheckAuthRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Keep refs in sync with state (no re-renders, just ref updates)
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { isDeveloperRef.current = isDeveloper; }, [isDeveloper]);

  // Socket.io - connect ONCE only, uses refs to avoid stale closures
  // Dynamically imported to prevent Vercel SSR/hydration issues
  useEffect(() => {
    let cancelled = false;

    // Skip socket.io connection on Vercel if no explicit SOCKET_URL is set
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (typeof window !== 'undefined' && !socketUrl) {
      // No socket URL configured — rely on polling fallback
      return;
    }

    const initSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (cancelled) return;

        const socket = io('/?XTransformPort=3004', {
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 5000,
          timeout: 5000,
        });

        socketRef.current = socket;

        socket.on('connect', () => { isRealtimeConnectedRef.current = true; });
        socket.on('disconnect', () => { isRealtimeConnectedRef.current = false; });

        socket.on('apartments-changed', () => {
          fetchApartmentsRef.current?.(0, false);
        });

        socket.on('messages-changed', () => {
          if (currentUserRef.current) fetchMessagesRef.current?.();
        });

        socket.on('user-changed', () => {
          recheckAuthRef.current?.();
        });

        socket.on('payments-changed', () => {
          fetchDevDataRef.current?.();
          fetchUserPaymentsRef.current?.();
        });

        socket.on('notification', (data: { event: string }) => {
          if (data.event === 'settings-updated') fetchSettingsRef.current?.();
        });

        socket.on('online-count', (data: { count: number }) => {
          onlineCountRef.current = data.count;
        });

        // Suppress connection errors silently (socket.io not available on Vercel)
        socket.on('connect_error', () => {
          isRealtimeConnectedRef.current = false;
        });
      } catch {
        // Socket.io not available - polling fallback handles it
      }
    };

    initSocket();
    return () => { cancelled = true; if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } };
  }, []); // Empty deps = connect only ONCE on mount

  useEffect(() => { fetchUserPaymentsRef.current = fetchUserPayments; });
  useEffect(() => { recheckAuthRef.current = recheckAuth; });

  // ========== fetchApartments (stable function, ref updated each render) ==========
  const fetchApartments = async (retryCount = 0, isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/apartments', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      const processedData = Array.isArray(data) ? data.map(processApartment) : [];
      setApartments(processedData);
      setAllApartments(processedData);
      setError(null);
    } catch (err: any) {
      if (retryCount < 3) setTimeout(() => fetchApartments(retryCount + 1, isInitial), 1000 * (retryCount + 1));
      else { setApartments([]); setAllApartments([]); }
    } finally {}
  };
  // Keep ref in sync so socket/polling can call latest version
  useEffect(() => { fetchApartmentsRef.current = fetchApartments; });

  // ========== SINGLE initialization: auth → apartments → dev data ==========
  useEffect(() => {
    let cancelled = false;
    
    const init = async () => {
      setLoading(true);
      // Step 1: Fetch auth
      try {
        const authRes = await fetch('/api/auth/me');
        const authData = await authRes.json();
        if (cancelled) return;
        if (authData.user) {
          setCurrentUser(authData.user);
          currentUserRef.current = authData.user;
          if (authData.user.isBlocked) setIsBlocked(true);
          const isDev = authData.user.identifier === DEVELOPER_EMAIL;
          setIsDeveloper(isDev);
          isDeveloperRef.current = isDev;
        }
      } catch {}

      // Step 2: Fetch apartments
      await fetchApartments(0, false);
      if (cancelled) return;

      // Step 3: Load user-specific data (using refs, no dependency on state)
      const user = currentUserRef.current;
      const dev = isDeveloperRef.current;
      
      if (user && !dev) {
        // Regular user data
        try {
          const payRes = await fetch('/api/payments');
          const payData = await payRes.json();
          if (cancelled) return;
          if (Array.isArray(payData)) {
            const myPayments = payData.filter((p: Payment) => p.userId === user.id);
            setUserPayments(myPayments);
            const paidIds = myPayments.filter((p: Payment) => p.status === 'Paid').map((p: Payment) => p.inquiry?.apartmentId).filter((id): id is string => Boolean(id));
            setUserPaidApartments(paidIds);
          }
        } catch {}
        try {
          const pendRes = await fetch('/api/apartments?status=pending');
          const pendData = await pendRes.json();
          if (cancelled) return;
          if (Array.isArray(pendData)) {
            setMyPendingApartments(pendData.filter((apt: Apartment) => apt.createdBy === user.id));
          }
        } catch {}
      }

      // Step 4: Fetch likes for current user
      if (user) {
        try {
          const likesRes = await fetch(`/api/likes?userId=${user.id}`);
          const likesData = await likesRes.json();
          if (cancelled) return;
          if (Array.isArray(likesData)) {
            setLikes(likesData);
            setFavorites(likesData.map((l: any) => l.apartmentId));
          }
        } catch {}
      }
      // Step 5: ALL data loaded — ONE transition to main UI
      if (!cancelled) {
        // Restore pending OTP if user refreshed page before verifying
        const pendingOtp = localStorage.getItem('manteqti_pending_otp');
        if (pendingOtp && !currentUserRef.current) {
          setShowOtpVerification(true);
          setOtpEmail(pendingOtp);
        }
        setLoading(false);
        setInitialLoad(false);
        initialLoadRef.current = false;
      }
    };

    init();
    return () => { cancelled = true; };
  }, []); // Run ONCE on mount — no cascade!

  const fetchUserPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (Array.isArray(data)) {
        const myPayments = data.filter((p: Payment) => p.userId === currentUser?.id);
        setUserPayments(myPayments);
        const paidIds = myPayments.filter((p: Payment) => p.status === 'Paid').map((p: Payment) => p.inquiry?.apartmentId).filter((id): id is string => Boolean(id));
        setUserPaidApartments(paidIds);
      }
    } catch {}
  };

  const fetchMyPendingApartments = async () => {
    if (!currentUser || isDeveloper) return;
    try {
      const res = await fetch('/api/apartments?status=pending');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMyPendingApartments(data.filter((apt: Apartment) => apt.createdBy === currentUser.id));
      }
    } catch {}
  };

  const recheckAuth = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (authData.user) {
        setCurrentUser(authData.user);
        currentUserRef.current = authData.user;
        setIsBlocked(!!authData.user.isBlocked);
        const isDev = authData.user.identifier === DEVELOPER_EMAIL;
        setIsDeveloper(isDev);
        isDeveloperRef.current = isDev;
      } else {
        // User was deleted, blocked, or session expired — clear everything and notify
        const wasLoggedIn = !!currentUserRef.current;
        setCurrentUser(null);
        currentUserRef.current = null;
        setIsBlocked(false);
        setIsDeveloper(false);
        isDeveloperRef.current = false;
        setUserPayments([]);
        setMyPendingApartments([]);
        setLikes([]);
        setFavorites([]);
        if (wasLoggedIn) {
          // Clear the auth cookie on server side
          try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
          addToast('تم تسجيل الخروج — حسابك لم يعد متاحاً', 'error');
        }
      }
    } catch {}
  };

  // Fetch developer data
  const fetchDevData = async () => {
    if (!isDeveloper) return;
    try {
      const [inqRes, payRes, pendRes] = await Promise.all([fetch('/api/inquiries'), fetch('/api/payments'), fetch('/api/users?pending=true')]);
      const [inqData, payData, pendData] = await Promise.all([inqRes.json(), payRes.json(), pendRes.json()]);
      setInquiries(Array.isArray(inqData) ? inqData : []); 
      setPayments(Array.isArray(payData) ? payData : []);
      if (pendData.users) setPendingUsers(pendData.users);
      fetchApprovalLogs();
    } catch {}
  };
  useEffect(() => { fetchDevDataRef.current = fetchDevData; });
  useEffect(() => { fetchEditRequestsRef.current = fetchEditRequests; });

  const handleApproveUser = async (userId: string, userName: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({ isOpen: true, title: 'تأكيد التسجيل', message: `هل تريد تأكيد تسجيل "${userName}"؟`, confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleApproveUser(userId, userName, true), type: 'info' });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/users/${userId}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
      if (res.ok) { fetchDevData(); fetchAllUsers(); addToast('تم تأكيد التسجيل ✅', 'success'); }
    } finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleRejectUser = async (userId: string, userName: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({ isOpen: true, title: 'رفض التسجيل', message: `هل تريد رفض تسجيل "${userName}" وحذف حسابه بالكامل؟\n\n⚠️ سيتم حذف جميع بياناته.`, confirmText: 'رفض وحذف', cancelText: 'إلغاء', onConfirm: () => handleRejectUser(userId, userName, true), type: 'danger' });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/users/${userId}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) });
      if (res.ok) { fetchDevData(); fetchAllUsers(); addToast('تم رفض التسجيل وحذف الحساب', 'success'); }
    } finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleDeleteUser = async (userId: string, userName: string, confirmed: boolean = false) => {
    if (!confirmed) {
      // Open the selective delete modal — fetch user stats first
      setDeleteUserModal(prev => ({ ...prev, isOpen: true, userId, userName, loading: true, options: { apartments: true, payments: true, inquiries: true, likes: true, comments: true, messages: true, editRequests: true, blockedUsers: true } }));
      // Fetch user stats
      try {
        const res = await fetch(`/api/users/${userId}/block`);
        if (res.ok) {
          const data = await res.json();
          setDeleteUserModal(prev => ({
            ...prev,
            loading: false,
            stats: {
              apartments: data.apartments?.length || 0,
              payments: 0, // Will be fetched from user detail
              inquiries: 0,
              likes: 0,
              comments: 0,
              messages: 0,
              editRequests: 0,
              blockedUsers: 0,
            }
          }));
        } else {
          setDeleteUserModal(prev => ({ ...prev, loading: false }));
        }
      } catch {
        setDeleteUserModal(prev => ({ ...prev, loading: false }));
      }
      return;
    }
    // confirmed = execute delete with selected options
    setDeleteUserModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/users/${deleteUserModal.userId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteOptions: deleteUserModal.options }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchAllUsers(); fetchDevData(); fetchBlockedUsers(); fetchApartments(0, false);
        if (selectedUserDetail?.id === deleteUserModal.userId) { setSelectedUserDetail(null); setUserDetailData({ apartments: [], payments: [], inquiries: [] }); }
        addToast(data.message || 'تم حذف المستخدم ✅', 'success');
      } else {
        const data = await res.json();
        addToast(data.error || 'فشل حذف المستخدم', 'error');
      }
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setDeleteUserModal({ isOpen: false, userId: '', userName: '', loading: false, stats: { apartments: 0, payments: 0, inquiries: 0, likes: 0, comments: 0, messages: 0, editRequests: 0, blockedUsers: 0 }, options: { apartments: true, payments: true, inquiries: true, likes: true, comments: true, messages: true, editRequests: true, blockedUsers: true } }); }
  };

  const handleDevSendMessage = async () => {
    if (!devMessageTo || !devMessageText.trim()) return;
    try {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: currentUser?.id, receiverId: devMessageTo.userId, content: devMessageText.trim() }) });
      setDevMessageText(''); setDevMessageTo(null);
      fetchMessages();
      addToast('تم إرسال الرسالة ✅', 'success');
    } catch { addToast('فشل إرسال الرسالة', 'error'); }
  };

  // Reply to a message from dev panel messages tab
  const handleDevReplyMessage = async (receiverId: string, content: string) => {
    if (!content || !currentUser) return;
    try {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: currentUser.id, receiverId, content }) });
      fetchMessages();
      addToast('تم إرسال الرد ✅', 'success');
    } catch { addToast('فشل إرسال الرد', 'error'); }
  };

  // Delete a message (developer only)
  const handleDeleteMessage = async (messageId: string) => {
    setConfirmDialog({
      isOpen: true, title: 'حذف الرسالة', message: 'هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف', cancelText: 'إلغاء', type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await fetch(`/api/messages?id=${messageId}`, { method: 'DELETE' });
          if (res.ok) {
            setMessages(prev => prev.filter(m => m.id !== messageId));
            addToast('تم حذف الرسالة ✅', 'success');
          } else {
            const data = await res.json();
            addToast(data.error || 'فشل حذف الرسالة', 'error');
          }
        } catch { addToast('حدث خطأ', 'error'); }
        finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
      }
    });
  };

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        const s = data.settings || data;
        setSettings({ 
          contactFee: s.contactFee ?? 50, 
          regularFee: s.regularFee ?? 30,
          featuredFee: s.featuredFee ?? 100, 
          premiumFee: s.premiumFee ?? 200, 
          vipFee: s.vipFee ?? 300,
          saleDisplayFee: s.saleDisplayFee ?? 100,
          rentDisplayFee: s.rentDisplayFee ?? 75,
          otherServicesFee: s.otherServicesFee ?? 50,
          highlightFee: s.highlightFee ?? 150,
          priorityListingFee: s.priorityListingFee ?? 200,
          verifiedListingFee: s.verifiedListingFee ?? 250,
          currency: s.currency ?? 'ج.م'
        });
      }
    } catch {}
  };
  useEffect(() => { fetchSettingsRef.current = fetchSettings; });

  // Auto-refresh settings every 30 seconds so users see developer changes immediately
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSettingsRef.current?.();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update settings
  const updateSettings = async (newSettings: Partial<typeof settings>) => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, ...newSettings })
      });
      const data = await res.json();
      if (res.ok) {
        // Re-fetch settings from DB to confirm saved values
        await fetchSettings();
        addToast('تم تحديث الإعدادات بنجاح ✅', 'success');
      } else {
        addToast(data.error || 'فشل تحديث الإعدادات', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Fetch operation logs
  const fetchOperationLogs = async () => {
    try {
      const res = await fetch('/api/logs?limit=50');
      const data = await res.json();
      setOperationLogs(Array.isArray(data) ? data : []);
    } catch {}
  };

  // Fetch approval logs
  const fetchApprovalLogs = async () => {
    setApprovalLogsLoading(true);
    try {
      const res = await fetch('/api/approval-logs?limit=100');
      const data = await res.json();
      setApprovalLogs(Array.isArray(data) ? data : []);
    } catch {}
    setApprovalLogsLoading(false);
  };

  // Revoke user approval (set isApproved back to false)
  const handleRevokeApproval = async (userId: string, userName: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({ isOpen: true, title: 'إلغاء تأكيد المستخدم', message: `هل أنت متأكد من إلغاء تأكيد "${userName}"؟\n\n⚠️ سيتم إلغاء تأكيد حسابه وسيتطلب إعادة تأكيد.`, confirmText: 'إلغاء التأكيد', cancelText: 'رجوع', onConfirm: () => handleRevokeApproval(userId, userName, true), type: 'warning' });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/users/${userId}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }) });
      if (res.ok) {
        fetchDevData(); fetchAllUsers(); fetchApprovalLogs(); fetchOperationLogs();
        addToast('تم إلغاء تأكيد التسجيل ✅', 'success');
      } else {
        const data = await res.json();
        addToast(data.error || 'فشل إلغاء التأكيد', 'error');
      }
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  // Delete an approval log entry
  const handleDeleteApprovalLog = async (logId: string) => {
    setConfirmDialog({
      isOpen: true, title: 'حذف سجل التأكيد', message: 'هل أنت متأكد من حذف هذا السجل؟',
      confirmText: 'حذف', cancelText: 'إلغاء', type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await fetch(`/api/approval-logs?id=${logId}`, { method: 'DELETE' });
          if (res.ok) {
            setApprovalLogs(prev => prev.filter(l => l.id !== logId));
            addToast('تم حذف سجل التأكيد ✅', 'success');
          } else { addToast('فشل حذف السجل', 'error'); }
        } catch { addToast('حدث خطأ', 'error'); }
        finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
      }
    });
  };

  // Clear all approval logs
  const handleClearApprovalLogs = async (confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({ isOpen: true, title: 'حذف جميع سجلات التأكيد', message: 'هل أنت متأكد من حذف جميع سجلات التأكيد؟ لا يمكن التراجع عن هذا الإجراء!', confirmText: 'حذف الكل', cancelText: 'إلغاء', onConfirm: () => handleClearApprovalLogs(true), type: 'danger' });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/approval-logs?clearAll=true', { method: 'DELETE' });
      if (res.ok) {
        setApprovalLogs([]);
        addToast('تم حذف جميع سجلات التأكيد ✅', 'success');
      } else { addToast('فشل حذف السجلات', 'error'); }
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  // Delete an operation log entry
  const handleDeleteOperationLog = async (logId: string) => {
    setConfirmDialog({
      isOpen: true, title: 'حذف سجل العملية', message: 'هل أنت متأكد من حذف هذا السجل؟',
      confirmText: 'حذف', cancelText: 'إلغاء', type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          const res = await fetch(`/api/logs?id=${logId}`, { method: 'DELETE' });
          if (res.ok) {
            setOperationLogs(prev => prev.filter(l => l.id !== logId));
            addToast('تم حذف السجل ✅', 'success');
          } else { addToast('فشل حذف السجل', 'error'); }
        } catch { addToast('حدث خطأ', 'error'); }
        finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
      }
    });
  };

  // Clear all operation logs
  const handleClearAllLogs = async (confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({ isOpen: true, title: 'حذف جميع السجلات', message: 'هل أنت متأكد من حذف جميع سجلات العمليات؟ لا يمكن التراجع عن هذا الإجراء!', confirmText: 'حذف الكل', cancelText: 'إلغاء', onConfirm: () => handleClearAllLogs(true), type: 'danger' });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/logs?clearAll=true', { method: 'DELETE' });
      if (res.ok) {
        setOperationLogs([]);
        addToast('تم حذف جميع السجلات ✅', 'success');
      } else { addToast('فشل حذف السجلات', 'error'); }
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  // Fetch messages for a specific user (for log display)
  const fetchUserMessagesForLog = async (userId: string) => {
    try {
      const res = await fetch(`/api/messages?userId=${userId}&isDeveloper=true`);
      const data = await res.json();
      const userMsgs = (Array.isArray(data) ? data : []).filter((m: any) => m.senderId === userId || m.receiverId === userId);
      setUserMessagesForLog(userMsgs);
    } catch { setUserMessagesForLog([]); }
  };

  // Fetch edit requests
  const fetchEditRequests = async () => {
    try {
      const res = await fetch('/api/edit-requests');
      const data = await res.json();
      if (Array.isArray(data)) {
        const processedData = data.map((req: any) => ({
          ...req,
          newImages: req.newImages ? parseJsonArray(req.newImages) : [],
          newVideos: req.newVideos ? parseJsonArray(req.newVideos) : [],
        }));
        setEditRequests(processedData);
      }
    } catch {}
  };

  // Submit edit request (for publishers)
  const submitEditRequest = async () => {
    if (!selectedApartmentForEdit || !currentUser) return;
    setEditRequestLoading(true);
    try {
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartmentId: selectedApartmentForEdit.id,
          userId: currentUser.id,
          newImages: editRequestForm.newImages,
          newVideos: editRequestForm.newVideos,
          newPrice: editRequestForm.newPrice ? parseInt(editRequestForm.newPrice) : null,
          newStatus: editRequestForm.newStatus || null,
          description: editRequestForm.description,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('تم إرسال طلب التعديل بنجاح! سيتم مراجعته من قبل المطور.', 'success');
        setShowEditRequestModal(false);
        setSelectedApartmentForEdit(null);
        setEditRequestForm({ newImages: [], newVideos: [], newPrice: '', newStatus: '', description: '' });
      } else {
        addToast(data.error || 'حدث خطأ', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    } finally {
      setEditRequestLoading(false);
    }
  };

  // Handle approve edit request (developer only)
  const handleApproveEditRequest = async (requestId: string, reviewNotes?: string) => {
    try {
      const res = await fetch(`/api/edit-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reviewedBy: 'developer', reviewNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('تم الموافقة على التعديل وتطبيقه بنجاح', 'success');
        fetchEditRequests();
        fetchApartments();
      } else {
        addToast(data.error || 'حدث خطأ', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    }
  };

  // Handle reject edit request (developer only)
  const handleRejectEditRequest = async (requestId: string, reviewNotes?: string) => {
    try {
      const res = await fetch(`/api/edit-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reviewedBy: 'developer', reviewNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('تم رفض طلب التعديل', 'success');
        fetchEditRequests();
      } else {
        addToast(data.error || 'حدث خطأ', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    }
  };

  // Dev data loading handled in init useEffect above.
  // This useEffect only handles subsequent auth changes (login/logout during session)
  const hasMountedRef = useRef(false);
  useEffect(() => {
    // Skip the first run (handled by init useEffect)
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (initialLoadRef.current) return;
    fetchSettings();
    if (isDeveloper && currentUser) { fetchDevData(); fetchAllLikes(); fetchAllComments(); fetchMessages(); fetchBlockedUsers(); fetchAllUsers(); fetchOperationLogs(); fetchEditRequests(); }
    if (currentUser && !isDeveloper) { fetchUserPayments(); fetchMyPendingApartments(); fetchUserLikes(); }
  }, [isDeveloper, currentUser]);

  // Smart auto-refresh every 30 seconds with visibility API (skip when tab hidden)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (initialLoadRef.current) return;
      // Skip polling when tab is not visible
      if (typeof document !== 'undefined' && document.hidden) return;
      // Use refs for stable access to latest functions
      await Promise.allSettled([
        fetchSettingsRef.current?.(),
        fetchApartmentsRef.current?.(0, false),
        // Recheck auth periodically to catch deleted/blocked users (fallback when socket.io unavailable)
        recheckAuthRef.current?.(),
        ...(currentUserRef.current ? [fetchMessagesRef.current?.()] : []),
      ]);
    }, 30000);
    return () => clearInterval(interval);
  }, []); // Empty deps — uses refs, never re-creates

  // Fetch likes
  const fetchUserLikes = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/likes?userId=${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLikes(data);
        setFavorites(data.map((l: any) => l.apartmentId));
      }
    } catch {}
  };

  const fetchAllLikes = async () => {
    try { 
      const res = await fetch('/api/likes'); 
      const data = await res.json();
      setLikes(Array.isArray(data) ? data : []); 
    } catch {}
  };

  const fetchComments = async (apartmentId: string) => {
    try { 
      const res = await fetch(`/api/comments?apartmentId=${apartmentId}&status=approved`); 
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []); 
    } catch {}
  };

  const fetchAllComments = async () => {
    try { 
      const res = await fetch('/api/comments'); 
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []); 
    } catch {}
  };

  const fetchMessages = async () => {
    if (!currentUser) return;
    try { 
      const res = await fetch(`/api/messages?userId=${currentUser.id}&isDeveloper=${isDeveloper}`); 
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []); 
    } catch {}
  };
  useEffect(() => { fetchMessagesRef.current = fetchMessages; });

  const fetchBlockedUsers = async () => {
    try { 
      const res = await fetch('/api/block'); 
      const data = await res.json();
      // API returns { blockedUsers: [...] }, need to handle both formats
      const users = data.blockedUsers || data;
      // Transform data to include userId field and user object for consistent access
      if (Array.isArray(users)) {
        const transformedUsers = users.map((u: any) => ({
          id: u.id,
          userId: u.id,
          reason: u.blockReason || u.reason,
          blockedAt: u.blockedAt,
          user: { id: u.id, name: u.name, identifier: u.email }
        }));
        setBlockedUsers(transformedUsers);
      }
    } catch {}
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const users = data.users || data;
      setAllUsers(Array.isArray(users) ? users : []);
    } catch {}
  };

  const fetchUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const [aptRes, payRes, inqRes] = await Promise.all([
        fetch('/api/apartments'),
        fetch('/api/payments'),
        fetch('/api/inquiries')
      ]);
      const [aptData, payData, inqData] = await Promise.all([aptRes.json(), payRes.json(), inqRes.json()]);
      const apartments = (Array.isArray(aptData) ? aptData : []).filter((a: Apartment) => a.createdBy === userId).map(processApartment);
      const payments = (Array.isArray(payData) ? payData : []).filter((p: Payment) => p.userId === userId);
      const inquiries = (Array.isArray(inqData) ? inqData : []).filter((i: Inquiry) => i.userId === userId);
      setUserDetailData({ apartments, payments, inquiries });
    } catch {}
    setUserDetailLoading(false);
  };

  // User likes loaded in init useEffect — no separate effect needed

  // Load all localStorage data on mount (single effect)
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('manteqti_remembered_identifier');
      const rememberMeFlag = localStorage.getItem('manteqti_remember_me');
      if (remembered && rememberMeFlag === 'true') { setAuthIdentifier(remembered); setRememberMe(true); }
      const devEmailSaved = localStorage.getItem('manteqti_dev_email');
      const devRemember = localStorage.getItem('manteqti_dev_remember');
      if (devEmailSaved && devRemember === 'true') { setDevEmail(devEmailSaved); }
    } catch {}
  }, []);

  // Filter apartments
  const uniqueAreas = [...new Set([...apartments.map(apt => apt.area), ...egyptianAreas])].filter(a => a).sort();
  const filteredApartments = apartments.filter(apt => {
    if (!isDeveloper && (apt.status === 'pending' || apt.status === 'rejected')) return false;
    if (typeFilter !== 'all' && apt.type !== typeFilter) return false;
    if (areaFilter !== 'all' && apt.area !== areaFilter) return false;
    if (bedroomsFilter !== 'all' && apt.bedrooms < parseInt(bedroomsFilter)) return false;
    if (bathroomsFilter !== 'all' && apt.bathrooms < parseInt(bathroomsFilter)) return false;
    if (sizeFilter !== 'all' && apt.apartmentSize && apt.apartmentSize < parseInt(sizeFilter)) return false;
    if (sizeFilter !== 'all' && !apt.apartmentSize) return false;
    if (priceFilter !== 'all' && apt.price > parseInt(priceFilter)) return false;
    if (searchQuery && !apt.title.toLowerCase().includes(searchQuery.toLowerCase()) && !apt.area.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    // VIP+ first, then VIP, then Featured, then by date
    if (a.isVip && !b.isVip) return -1;
    if (!a.isVip && b.isVip) return 1;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingApartments = allApartments.filter(apt => apt.status === 'pending');

  // Handlers
 const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevLoading(true);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: devEmail, password: devPassword })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        // جلب بيانات المستخدم الكاملة من /api/auth/me (باستخدام الـ cookie)
        try {
          const meRes = await fetch('/api/auth/me');
          const meData = await meRes.json();
          if (meData.user) {
            setCurrentUser({ id: meData.user.id, identifier: meData.user.identifier || devEmail, name: meData.user.name });
          } else {
            setCurrentUser({ id: data.user?.id || '', identifier: devEmail, name: data.user?.name || 'المطور' });
          }
        } catch {
          setCurrentUser({ id: data.user?.id || '', identifier: devEmail, name: data.user?.name || 'المطور' });
        }
        setIsDeveloper(true);
        setShowDevLogin(false);
        if (rememberMe) {
          localStorage.setItem('manteqti_dev_email', devEmail);
          localStorage.setItem('manteqti_dev_remember', 'true');
        } else {
          localStorage.removeItem('manteqti_dev_email');
          localStorage.removeItem('manteqti_dev_remember');
        }
        setDevPassword('');
        addToast('مرحباً بك في لوحة تحكم المطور!', 'success');
        fetchDevData();
      } else {
        addToast(data.error || 'بيانات الدخول غير صحيحة', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    }
    setDevLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: authIdentifier.trim().toLowerCase(), password: authPassword }) });
      const data = await res.json();
      if (res.ok) {
        if (data.pendingApproval) {
          setCurrentUser(data.user); setShowAuth(false);
          if (data.user.identifier === DEVELOPER_EMAIL) setIsDeveloper(true);
          addToast('حسابك قيد المراجعة. بانتظار موافقة الإدارة ⏳', 'info');
        } else {
          setCurrentUser(data.user); setShowAuth(false);
          if (data.user.identifier === DEVELOPER_EMAIL) setIsDeveloper(true);
          addToast(`مرحباً ${data.user.name}!`, 'success');
        }
        if (rememberMe) { localStorage.setItem('manteqti_remembered_identifier', authIdentifier.trim().toLowerCase()); localStorage.setItem('manteqti_remember_me', 'true'); }
        else { localStorage.removeItem('manteqti_remembered_identifier'); localStorage.removeItem('manteqti_remember_me'); }
        setAuthPassword('');
      } else if (data.emailVerificationRequired) {
        // البريد الإلكتروني غير مؤكد - إظهار نافذة التأكيد
        setShowAuth(false);
        setShowOtpVerification(true);
        setOtpEmail(data.email || authIdentifier.trim().toLowerCase());
        localStorage.setItem('manteqti_pending_otp', data.email || authIdentifier.trim().toLowerCase());
        addToast('يجب تأكيد البريد الإلكتروني أولاً! تم إرسال رمز التحقق', 'info');
      } else addToast(data.error || 'خطأ في تسجيل الدخول', 'error');
    } catch { addToast('حدث خطأ في الاتصال', 'error'); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: authIdentifier.trim().toLowerCase(), name: authName.trim(), password: authPassword, phone: authPhone.trim() || undefined }) });
      const data = await res.json();
      if (res.ok) {
        if (data.emailVerificationRequired) {
          setShowAuth(false);
          setShowOtpVerification(true);
          setOtpEmail(authIdentifier.trim().toLowerCase());
          localStorage.setItem('manteqti_pending_otp', authIdentifier.trim().toLowerCase());
          addToast('تم إنشاء الحساب! يرجى تأكيد البريد الإلكتروني', 'info');
        } else {
          // Check if user needs approval
          if (data.user && !data.user.isApproved) {
            setCurrentUser(data.user); setShowAuth(false);
            if (data.user.identifier === DEVELOPER_EMAIL) setIsDeveloper(true);
            addToast('تم إنشاء الحساب بنجاح! حسابك قيد المراجعة وسيتم إشعارك فور الموافقة ⏳', 'info');
          } else {
            setCurrentUser(data.user); setShowAuth(false);
            if (data.user && data.user.identifier === DEVELOPER_EMAIL) setIsDeveloper(true);
            addToast(`مرحباً ${data.user.name}!`, 'success');
          }
        }
      }
      else addToast(data.error || 'خطأ في التسجيل', 'error');
    } catch { addToast('حدث خطأ في الاتصال', 'error'); }
    finally { setAuthLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: otpEmail, otp: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        setShowOtpVerification(false);
        setCurrentUser(data.user);
        setShowAuth(false);
        setOtpCode('');
        localStorage.removeItem('manteqti_pending_otp');
        addToast('تم تأكيد البريد الإلكتروني بنجاح! 🎉', 'success');
      } else {
        addToast(data.error || 'رمز التأكيد غير صحيح', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    } finally { setOtpLoading(false); }
  };

  const handleResendOtp = async () => {
    setOtpResendLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: otpEmail })
      });
      if (res.ok) {
        addToast('تم إرسال رمز تأكيد جديد', 'success');
      } else {
        addToast('حدث خطأ', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    } finally { setOtpResendLoading(false); }
  };

  const handleLogout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} setCurrentUser(null); setIsDeveloper(false); addToast('تم تسجيل الخروج', 'info'); };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
      if (res.ok) { setForgotSuccess(true); addToast('تم إرسال رابط استعادة كلمة المرور', 'success'); }
      else addToast('حدث خطأ', 'error');
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setForgotLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { addToast('كلمتا المرور غير متطابقتين', 'error'); return; }
    if (newPassword.length < 6) { addToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail, newPassword }) });
      if (res.ok) { setShowResetPassword(false); setShowForgotPassword(false); addToast('تم تغيير كلمة المرور بنجاح!', 'success'); }
      else addToast('حدث خطأ', 'error');
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setResetLoading(false); }
  };

  const handleAddApartment = async (confirmed: boolean = false) => {
    if (!currentUser && !isDeveloper) {
      // التحقق من البيانات أولاً
      if (!aptForm.title || !aptForm.price || !aptForm.area || !aptForm.description || !aptForm.ownerPhone) {
        addToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }
      // عرض تسجيل الدخول مع الاحتفاظ بالبيانات
      setConfirmDialog({
        isOpen: true,
        title: 'تسجيل الدخول مطلوب',
        message: 'لقد أدخلت جميع بيانات الشقة بنجاح!\n\nقم بتسجيل الدخول أو إنشاء حساب جديد لإرسال شقتك للمراجعة.',
        confirmText: 'تسجيل الدخول',
        cancelText: 'إلغاء',
        onConfirm: () => {
          setShowAddModal(false);
          setShowAuth(true);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        },
        type: 'info'
      });
      return;
    }
    if (!confirmed) {
      if (!aptForm.title || !aptForm.price || !aptForm.area || !aptForm.description || !aptForm.ownerPhone || !aptForm.apartmentSize) { addToast('يرجى ملء جميع الحقول المطلوبة بما فيها المساحة', 'error'); return; }
      const listingLabels: Record<string, string> = { regular: 'عادي', featured: 'مميز ⭐', vip: 'VIP+ 👑' };
      const listingLabel = listingLabels[aptForm.listingType] || 'عادي';
      const listingFee = aptForm.listingType === 'vip' ? settings.vipFee : aptForm.listingType === 'featured' ? settings.featuredFee : 0;
      const confirmMsg = isDeveloper
        ? (aptForm.listingType !== 'regular' ? `هل أنت متأكد من إضافة هذه الشقة كـ"${listingLabel}"؟\n\n💰 رسوم النشر: ${listingFee} ${settings.currency}` : 'هل أنت متأكد من إضافة هذه الشقة؟')
        : 'سيتم إرسال الشقة للمراجعة';
      setConfirmDialog({ isOpen: true, title: isDeveloper ? 'إضافة شقة جديدة' : 'إرسال شقة للمراجعة', message: confirmMsg, confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleAddApartment(true), type: 'info' }); return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    setAptSubmitting(true);
    try {
      const formData = { 
          title: aptForm.title,
          description: aptForm.description, 
          price: parseInt(aptForm.price), 
          area: aptForm.area,
          bedrooms: parseInt(aptForm.bedrooms), 
          bathrooms: parseInt(aptForm.bathrooms), 
          floor: aptForm.floor ? parseInt(aptForm.floor) : null,
          apartmentSize: aptForm.apartmentSize ? parseInt(aptForm.apartmentSize) : null,
          ownerPhone: aptForm.ownerPhone,
          mapLink: aptForm.mapLink || null,
          type: aptForm.type,
          images: Array.isArray(imageUrls) && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null, 
          videos: Array.isArray(videoUrls) && videoUrls.length > 0 ? JSON.stringify(videoUrls) : null, 
          createdBy: currentUser?.id, 
          isFeatured: aptForm.listingType === 'featured' || aptForm.listingType === 'vip',
          isVip: aptForm.listingType === 'vip',
          status: isDeveloper ? 'available' : 'pending' 
        };
      console.log('[SUBMIT APARTMENT] Sending:', { apartmentSize: formData.apartmentSize, aptFormApartmentSize: aptForm.apartmentSize });
      const res = await fetch('/api/apartments', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(formData) 
      });
      const data = await res.json();
      if (res.ok) { 
        fetchApartments(); 
        setShowAddModal(false); 
        setAptForm({ title: '', price: '', area: '', bedrooms: '1', bathrooms: '1', floor: '', apartmentSize: '', description: '', ownerPhone: '', mapLink: '', type: 'rent', listingType: 'regular' }); 
        setImageUrls([]); 
        setVideoUrls([]); 
        addToast(isDeveloper ? 'تم نشر الشقة بنجاح!' : 'تم إرسال الشقة للمراجعة!', 'success'); 
      } else {
        addToast(data.error || 'حدث خطأ أثناء النشر', 'error');
      }
    } catch (err) { 
      console.error('Add apartment error:', err);
      addToast('حدث خطأ في الاتصال', 'error'); 
    }
    finally { setAptSubmitting(false); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleApproveApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'الموافقة على الشقة', message: 'هل أنت متأكد من الموافقة على نشر هذه الشقة؟', confirmText: 'موافقة', cancelText: 'إلغاء', onConfirm: () => handleApproveApartment(id, true), type: 'info' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try { await fetch(`/api/apartments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) }); fetchApartments(); addToast('تمت الموافقة على الشقة', 'success'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleRejectApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'رفض الشقة', message: 'هل أنت متأكد من رفض هذه الشقة؟', confirmText: 'رفض', cancelText: 'إلغاء', onConfirm: () => handleRejectApartment(id, true), type: 'danger' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try { await fetch(`/api/apartments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) }); fetchApartments(); addToast('تم رفض الشقة', 'success'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleDeleteApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'حذف الشقة', message: 'هل أنت متأكد من حذف هذه الشقة؟ لا يمكن التراجع.', confirmText: 'حذف', cancelText: 'إلغاء', onConfirm: () => handleDeleteApartment(id, true), type: 'danger' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try { await fetch(`/api/apartments/${id}`, { method: 'DELETE' }); fetchApartments(); setSelectedApartment(null); setEditApartment(null); addToast('تم حذف الشقة', 'success'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleEditApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApartment) return;
    setEditSubmitting(true);
    try {
      // Build clean payload - only send fields the backend expects
      // Convert images/videos arrays back to JSON strings for the DB
      const editPayload = {
        title: editApartment.title,
        description: editApartment.description || '',
        price: editApartment.price,
        area: editApartment.area,
        bedrooms: editApartment.bedrooms,
        bathrooms: editApartment.bathrooms,
        floor: editApartment.floor ?? null,
        apartmentSize: editApartment.apartmentSize ?? null,
        ownerPhone: editApartment.ownerPhone,
        mapLink: editApartment.mapLink || null,
        type: editApartment.type,
        status: editApartment.status,
        isFeatured: editApartment.isFeatured ?? false,
        isVip: editApartment.isVip ?? false,
        images: Array.isArray(editApartment.images) ? JSON.stringify(editApartment.images) : (editApartment.images || null),
        videos: Array.isArray(editApartment.videos) ? JSON.stringify(editApartment.videos) : (editApartment.videos || null),
      };
      console.log('[EDIT APARTMENT] Sending payload:', { id: editApartment.id, apartmentSize: editPayload.apartmentSize, imagesType: typeof editPayload.images });
      const res = await fetch(`/api/apartments/${editApartment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload)
      });
      const data = await res.json();
      if (res.ok) {
        fetchApartments();
        setEditApartment(null);
        addToast('تم تحديث الشقة بنجاح!', 'success');
      } else {
        addToast(data.error || 'حدث خطأ أثناء التحديث', 'error');
      }
    } catch (err) {
      console.error('Edit apartment error:', err);
      addToast('حدث خطأ في الاتصال', 'error');
    }
    finally { setEditSubmitting(false); }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'تغيير حالة العقار', message: `هل تريد تغيير الحالة؟`, confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleUpdateStatus(id, newStatus, true), type: 'warning' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try { await fetch(`/api/apartments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }); fetchApartments(); addToast('تم تغيير حالة العقار', 'success'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleAddInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryApartment) return;
    setInquirySubmitting(true);
    try { await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId: inquiryApartment.id, userId: currentUser?.id, ...inquiryForm }) }); setInquiryApartment(null); setInquiryForm({ name: '', email: '', phone: '', message: '' }); addToast('تم إرسال استفسارك!', 'success'); }
    finally { setInquirySubmitting(false); }
  };

  const handlePayment = async (confirmed: boolean = false) => {
    if (!paymentApartment) return;
    // If fee is 0, skip payment method requirement and confirmation
    if (settings.contactFee === 0) {
      if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'طلب مجاني', message: 'بيانات التواصل مجانية! هل تريد المتابعة؟', confirmText: 'متابعة', cancelText: 'إلغاء', onConfirm: () => handlePayment(true), type: 'info' }); return; }
      setConfirmDialog(prev => ({ ...prev, loading: true }));
      setPaymentSubmitting(true);
      try {
        const inqRes = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId: paymentApartment.id, userId: currentUser?.id, name: currentUser?.name || 'زائر', email: currentUser?.identifier || 'guest@example.com', phone: 'N/A', message: 'طلب بيانات تواصل (مجاني)' }) });
        const inquiry = await inqRes.json();
        await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiryId: inquiry.id, method: 'مجاني', status: 'Paid', amount: 0, userId: currentUser?.id }) });
        setPaymentApartment(null); setPaymentMethod('');
        addToast('تم الحصول على بيانات التواصل مجاناً! ✨', 'success');
      } finally { setPaymentSubmitting(false); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
      return;
    }
    if (!paymentMethod) return;
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'تأكيد الدفع', message: `هل تريد الدفع بمبلغ ${settings.contactFee} ${settings.currency}؟`, confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handlePayment(true), type: 'info' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    setPaymentSubmitting(true);
    try {
      const inqRes = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId: paymentApartment.id, userId: currentUser?.id, name: currentUser?.name || 'زائر', email: currentUser?.identifier || 'guest@example.com', phone: 'N/A', message: 'طلب بيانات تواصل' }) });
      const inquiry = await inqRes.json();
      await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiryId: inquiry.id, method: paymentMethod, status: 'Pending', amount: settings.contactFee, userId: currentUser?.id }) });
      setPaymentApartment(null); setPaymentMethod('');
      addToast('تم إرسال طلب الدفع!', 'success');
    } finally { setPaymentSubmitting(false); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleConfirmPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'تأكيد الدفع', message: 'هل أنت متأكد من تأكيد هذا الدفع؟', confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleConfirmPayment(paymentId, true), type: 'info' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Paid', inquiryStatus: 'Contacted' }) });
      if (res.ok) { fetchDevData(); addToast('تم تأكيد الدفع ✅', 'success'); }
      else addToast('فشل تأكيد الدفع', 'error');
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  // Handle reject payment (developer only)
  const handleRejectPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: 'رفض الدفع', message: 'هل أنت متأكد من رفض هذا الدفع؟',
        confirmText: 'رفض', cancelText: 'إلغاء',
        onConfirm: () => handleRejectPayment(paymentId, true), type: 'danger'
      });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Failed' })
      });
      if (res.ok) {
        fetchDevData();
        addToast('تم رفض الدفع', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // حذف مدفوعات محددة
  const handleDeletePayments = async (paymentIds: string[], confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: '🗑️ حذف المدفوعات',
        message: `هل أنت متأكد من حذف ${paymentIds.length} مدفوعة؟\n\nلا يمكن التراجع عن هذا الإجراء!`,
        confirmText: 'حذف', cancelText: 'إلغاء',
        onConfirm: () => handleDeletePayments(paymentIds, true), type: 'danger'
      });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/payments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: paymentIds })
      });
      if (res.ok) {
        fetchDevData();
        const data = await res.json();
        addToast(`تم حذف ${data.deleted} مدفوعة بنجاح ✅`, 'success');
      } else {
        addToast('فشل حذف المدفوعات', 'error');
      }
    } catch {
      addToast('حدث خطأ', 'error');
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // إعادة إرسال رابط الدفع للمستخدم
  const handleResendPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: '🔄 إعادة إرسال',
        message: 'هل تريد إعادة إرسال طلب الدفع لهذا المستخدم؟',
        confirmText: 'إرسال', cancelText: 'إلغاء',
        onConfirm: () => handleResendPayment(paymentId, true), type: 'info'
      });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' })
      });
      if (res.ok) {
        addToast('تم إعادة إرسال طلب الدفع بنجاح 🔄', 'success');
        fetchDevData();
      } else {
        addToast('فشل إعادة الإرسال', 'error');
      }
    } catch {
      addToast('حدث خطأ في الاتصال', 'error');
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // حذف جميع المدفوعات
  const handleDeleteAllPayments = async (confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: '🗑️ حذف جميع المدفوعات',
        message: `هل أنت متأكد من حذف جميع المدفوعات (${payments.length} مدفوعة)؟\n\n⚠️ سيتم حذف سجل المدفوعات بالكامل!\nلا يمكن التراجع عن هذا الإجراء!`,
        confirmText: 'حذف الكل', cancelText: 'إلغاء',
        onConfirm: () => handleDeleteAllPayments(true), type: 'danger'
      });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/payments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        fetchDevData();
        const data = await res.json();
        addToast(`تم حذف ${data.deleted} مدفوعة بنجاح ✅`, 'success');
      } else {
        addToast('فشل حذف المدفوعات', 'error');
      }
    } catch {
      addToast('حدث خطأ', 'error');
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle AI assistant for developer
  const handleAiAction = async (action: string) => {
    setAiAction(action);
    setAiLoading(true);
    setAiResponse('');

    try {
      let prompt = '';
      const totalViews = apartments.reduce((sum: number, a: Apartment) => sum + ((a as any).views || 0), 0);
      const avgPrice = apartments.length > 0 ? Math.round(apartments.reduce((sum: number, a: Apartment) => sum + a.price, 0) / apartments.length) : 0;
      const totalRevenue = payments.filter(p => p.status === 'Paid').reduce((sum: number, p: Payment) => sum + p.amount, 0);
      const conversionRate = inquiries.length > 0 ? Math.round((inquiries.filter(i => i.lifecycleStatus === 'Converted').length / inquiries.length) * 100) : 0;
      
      switch (action) {
        case 'stats':
          prompt = `أنت محلل بيانات عقاري خبير. قم بتحليل هذه البيانات:
📊 إجمالي الشقق: ${apartments.length} | متاحة: ${apartments.filter(a => a.status === 'available').length} | في انتظار الموافقة: ${pendingApartments.length}
📈 الاستفسارات: ${inquiries.length} | معدل التحويل: ${conversionRate}% | الإيرادات: ${totalRevenue.toLocaleString()} ج.م
أعطني تحليل شامل مع توصيات.`;
          break;
        case 'payments':
          prompt = `أنت خبير مالي. حلل المدفوعات: ${JSON.stringify(payments.map(p => ({ amount: p.amount, method: p.method, status: p.status })), null, 2)}`;
          break;
        case 'suggestions':
          prompt = `أعطني 5 اقتراحات لتحسين منصة عقارية`;
          break;
        case 'help':
          prompt = `اشرح لي كيفية استخدام لوحة تحكم المطور في منطقتي`;
          break;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'developer-persistent-session', message: prompt })
      });
      const data = await res.json();
      if (data.success) setAiResponse(data.response);
    } finally {
      setAiLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList | null, type: 'image' | 'video'): Promise<string[]> => {
    if (!files || files.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        } else {
          addToast(data.error || `فشل في رفع ${file.name}`, 'error');
        }
      } catch {
        addToast(`فشل في رفع ${file.name}`, 'error');
      }
    }
    
    return uploadedUrls;
  };

  // Delete like (developer only)
  const deleteLike = async (likeId: string) => {
    try {
      const res = await fetch(`/api/likes/${likeId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchAllLikes();
        addToast('تم حذف الإعجاب', 'success');
      }
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentUser?.id || 'guest', message: userMessage }) });
      const data = await res.json();
      if (data.success) setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setChatLoading(false); }
  };

  const sendMessage = async () => {
    if (!currentUser || !newMessage.trim()) return;
    if (isBlocked) { addToast('تم حظرك من استخدام الموقع', 'error'); return; }
    setMessageLoading(true);
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: currentUser.id, content: newMessage }) });
      const data = await res.json();
      if (res.ok) { setMessages(prev => [data.message, ...prev]); setNewMessage(''); addToast('تم إرسال الرسالة', 'success'); }
      else if (data.isBlocked) { setIsBlocked(true); addToast('تم حظرك', 'error'); }
      else addToast(data.error || 'حدث خطأ', 'error');
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setMessageLoading(false); }
  };

  // AI Description Generation for Apartments
  const generateAIDescription = async () => {
    if (!aptForm.title || !aptForm.area) {
      addToast('أدخل العنوان والمنطقة أولاً', 'error');
      return;
    }
    setAiDescLoading(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: aptForm.type,
          area: aptForm.area,
          bedrooms: parseInt(aptForm.bedrooms),
          bathrooms: parseInt(aptForm.bathrooms),
          features: []
        })
      });
      const data = await res.json();
      if (res.ok && data.description) {
        setAptForm({ ...aptForm, description: data.description });
        addToast('تم إنشاء الوصف بالذكاء الاصطناعي! ✨', 'success');
      } else {
        // Fallback description
        const fallbackDesc = `${aptForm.title} - ${aptForm.type === 'rent' ? 'للإيجار' : 'للبيع'} في ${aptForm.area}.
${aptForm.bedrooms} غرف نوم، ${aptForm.bathrooms} حمام${aptForm.floor ? `، الدور ${aptForm.floor}` : ''}${aptForm.apartmentSize ? `، مساحة ${aptForm.apartmentSize} م²` : ''}.
${aptForm.type === 'rent' ? `الإيجار الشهري ${aptForm.price} ج.م` : `السعر ${aptForm.price} ج.م`}.`;
        setAptForm({ ...aptForm, description: fallbackDesc });
        addToast('تم إنشاء وصف افتراضي', 'success');
      }
    } catch {
      // Fallback on error
      const fallbackDesc = `${aptForm.title} - ${aptForm.type === 'rent' ? 'للإيجار' : 'للبيع'} في ${aptForm.area}.
${aptForm.bedrooms} غرف نوم، ${aptForm.bathrooms} حمام${aptForm.floor ? `، الدور ${aptForm.floor}` : ''}${aptForm.apartmentSize ? `، مساحة ${aptForm.apartmentSize} م²` : ''}.
${aptForm.type === 'rent' ? `الإيجار الشهري ${aptForm.price} ج.م` : `السعر ${aptForm.price} ج.م`}.`;
      setAptForm({ ...aptForm, description: fallbackDesc });
      addToast('تم إنشاء وصف افتراضي', 'info');
    } finally {
      setAiDescLoading(false);
    }
  };

  const blockUser = async (userId: string, reason?: string) => {
    try { await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, reason }) }); addToast('تم حظر المستخدم', 'success'); fetchBlockedUsers(); fetchAllUsers(); } catch { addToast('حدث خطأ', 'error'); }
  };

  const unblockUser = async (userId: string) => {
    try { await fetch(`/api/block?userId=${userId}`, { method: 'DELETE' }); addToast('تم إلغاء الحظر', 'success'); fetchBlockedUsers(); fetchAllUsers(); } catch { addToast('حدث خطأ', 'error'); }
  };

  const toggleFavorite = async (apartmentId: string) => {
    if (!currentUser) {
      setShowAuth(true);
      addToast('يجب تسجيل الدخول لإضافة المفضلة', 'info');
      return;
    }
    try {
      const existingLike = likes.find(l => l.apartmentId === apartmentId && l.userId === currentUser.id);
      if (existingLike) {
        await fetch(`/api/likes/${existingLike.id}`, { method: 'DELETE' });
        setLikes(prev => prev.filter(l => l.id !== existingLike.id));
        setFavorites(prev => prev.filter(f => f !== apartmentId));
        addToast('تمت الإزالة من المفضلة', 'info');
      } else {
        const res = await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId, userId: currentUser.id }) });
        const data = await res.json();
        if (data.success) { setLikes(prev => [...prev, data.like]); setFavorites(prev => [...prev, apartmentId]); addToast('تمت الإضافة للمفضلة ❤️', 'success'); }
      }
    } catch { addToast('حدث خطأ', 'error'); }
  };

  const addComment = async (apartmentId: string) => {
    if (!currentUser && !isDeveloper) { addToast('يجب تسجيل الدخول للتعليق', 'error'); return; }
    if (!newComment.trim()) { addToast('اكتب تعليقاً', 'error'); return; }
    setCommentLoading(true);
    try {
      const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId, userId: currentUser?.id || 'developer', content: newComment, status: isDeveloper ? 'approved' : 'pending' }) });
      const data = await res.json();
      if (data.success) { setNewComment(''); if (isDeveloper) fetchComments(apartmentId); addToast(isDeveloper ? 'تم نشر التعليق' : 'تم إرسال التعليق للمراجعة', 'success'); }
    } catch { addToast('حدث خطأ', 'error'); }
    finally { setCommentLoading(false); }
  };

  const approveComment = async (commentId: string) => {
    try { await fetch(`/api/comments/${commentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) }); fetchAllComments(); addToast('تمت الموافقة على التعليق', 'success'); } catch { addToast('حدث خطأ', 'error'); }
  };

  const deleteComment = async (commentId: string) => {
    try { await fetch(`/api/comments/${commentId}`, { method: 'DELETE' }); fetchAllComments(); addToast('تم حذف التعليق', 'success'); } catch { addToast('حدث خطأ', 'error'); }
  };

  // Loading state
  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50'}`}>
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-center">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/30">
          <Building2 className="h-12 w-12 text-white" />
        </div>
        <p className={`mt-8 text-lg font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>جاري التحميل...</p>
      </motion.div>
    </div>
  );

  // Error state
  if (error) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-rose-50 to-slate-100'} p-4`} dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`max-w-md w-full rounded-3xl p-8 shadow-2xl text-center ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${darkMode ? 'bg-rose-900/30' : 'bg-rose-100'}`}><AlertCircle className="h-8 w-8 text-rose-500" /></div>
        <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>حدث خطأ</h2>
        <p className={`mb-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-4 rounded-2xl font-bold"><RefreshCw className="h-5 w-5 inline-block ml-2" />إعادة المحاولة</button>
      </motion.div>
    </div>
  );

  // Blocked user state - Only show chat with developer
  if (isBlocked && currentUser && !isDeveloper) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-red-50/30 to-rose-50/30'} p-4`} dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
        <div className={`rounded-3xl p-8 shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Ban className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">تم حظر حسابك</h2>
            <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>تم حظرك من استخدام الموقع. يمكنك التواصل مع المطور فقط.</p>
          </div>

          {/* Chat with developer for blocked user */}
          <div className={`rounded-2xl p-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              <MessageCircle className="h-5 w-5 text-violet-500" />
              شات مع المطور
            </h3>
            <div className="h-64 overflow-y-auto mb-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className={`h-12 w-12 mx-auto mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                  <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد رسائل بعد</p>
                </div>
              ) : messages.map(msg => (
                <div key={msg.id} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-600' : 'bg-white'}`}>
                  <p className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{msg.content}</p>
                  <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب رسالتك..."
                className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'}`}
              />
              <button
                onClick={sendMessage}
                disabled={messageLoading || !newMessage.trim()}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white disabled:opacity-50"
              >
                {messageLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-4 py-3 rounded-xl bg-rose-500/10 text-rose-500 font-medium hover:bg-rose-500/20 transition-all"
          >
            <LogOut className="h-5 w-5 inline ml-2" />
            تسجيل الخروج
          </button>
        </div>
      </motion.div>
    </div>
  );

  // Show pending approval screen for unapproved non-developer users
  if (currentUser && !currentUser.isApproved && !isDeveloper) {
    return (
      <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/30'} p-4`} dir="rtl">
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full">
            <div className={`rounded-3xl p-8 shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} text-center`}>
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-10 w-10 text-amber-500" />
              </div>
              <h1 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>حسابك قيد المراجعة</h1>
              <p className={`text-lg mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                مرحباً <span className="font-bold">{currentUser.name}</span>
              </p>
              <p className={`mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                تم استلام تسجيلك بنجاح وهو حالياً قيد المراجعة من قبل الإدارة.
                <br />سيتم إشعارك عبر البريد الإلكتروني فور الموافقة على حسابك.
              </p>
              <div className={`p-4 rounded-2xl mb-6 ${darkMode ? 'bg-slate-700' : 'bg-amber-50'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-amber-600'}`}>
                  ⏳ عادةً ما تستغرق عملية المراجعة بضع ساعات فقط
                </p>
              </div>
              {/* Chat with developer */}
              <div className={`rounded-2xl p-4 mb-6 text-right ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  <MessageCircle className="h-5 w-5 text-violet-500" />
                  تواصل مع الإدارة
                </h3>
                <div className="h-48 overflow-y-auto mb-3 space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center py-6">
                      <MessageCircle className={`h-10 w-10 mx-auto mb-2 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد رسائل بعد</p>
                    </div>
                  ) : messages.map(msg => {
                    const isSentByMe = msg.senderId === currentUser.id;
                    return (
                      <div key={msg.id} className={`p-3 rounded-xl ${isSentByMe ? (darkMode ? 'bg-violet-900/30 ml-4' : 'bg-violet-50 ml-4') : (darkMode ? 'bg-slate-600 mr-4' : 'bg-white mr-4')}`}>
                        <p className={`text-xs mb-1 ${isSentByMe ? (darkMode ? 'text-violet-400' : 'text-violet-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>{isSentByMe ? 'أنت' : 'الإدارة'}</p>
                        <p className={`text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={messageLoading || !newMessage.trim()}
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white disabled:opacity-50"
                  >
                    {messageLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={async () => {
                    const res = await fetch('/api/auth/me');
                    const data = await res.json();
                    if (data.user?.isApproved) {
                      setCurrentUser(data.user);
                      setIsDeveloper(data.user.identifier === DEVELOPER_EMAIL);
                      addToast('تم تأكيد حسابك! 🎉', 'success');
                    } else {
                      addToast('حسابك لا يزال قيد المراجعة', 'info');
                    }
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors ${darkMode ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                >
                  <RefreshCw className="h-4 w-4 inline ml-2" />تحديث الحالة
                </button>
                <button 
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    setCurrentUser(null);
                    setIsDeveloper(false);
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-colors ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        <footer className={`py-4 border-t text-center ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>© 2026 منطقتي | Manteqti</p>
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/30'}`} dir="rtl">
      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }} className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Building2 className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent">منطقتي | Manteqti</h1>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لوحة الشقق الذكية</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setDarkMode(!darkMode)} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-600'}`}>
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/30">
                <Building2 className="h-5 w-5" /><span>إضافة شقة</span>
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowChat(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium shadow-lg">
                <Brain className="h-5 w-5" /><span>المساعد الذكي</span>
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { if (isDeveloper) { fetchMessages(); setShowMessages(true); } else if (currentUser) { setShowMessages(true); } else { setShowAuth(true); } }} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium ${isDeveloper ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg' : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} shadow-lg relative`}>
                <MessageCircle className="h-5 w-5" /><span className="hidden lg:inline">{isDeveloper ? 'الرسائل' : 'تواصل معنا'}</span>
                {isDeveloper && messages.filter(m => !m.isRead).length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{messages.filter(m => !m.isRead).length}</span>}
              </motion.button>

              {isDeveloper ? (
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.02 }} onClick={() => setShowDevPanel(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium shadow-lg relative">
                    <ShieldCheck className="h-5 w-5" /><span>لوحة المطور</span>
                    {pendingApartments.length > 0 && <span className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{pendingApartments.length}</span>}
                  </motion.button>
                  <button onClick={handleLogout} className="p-3 rounded-xl bg-rose-500/10 text-rose-500"><LogOut className="h-5 w-5" /></button>
                </div>
              ) : currentUser ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => { fetchMyPendingApartments(); setShowMyPending(true); }} className={`px-4 py-2 rounded-xl ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} transition-all relative`}>
                    <User className="h-4 w-4 inline ml-2" /><span className="text-sm font-medium">{currentUser.name}</span>
                    {myPendingApartments.length > 0 && <span className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">{myPendingApartments.length}</span>}
                  </button>
                  <button onClick={() => { fetchUserPayments(); setShowMyPayments(true); }} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} transition-all`} title="المدفوعات"><CreditCard className="h-4 w-4" /></button>
                  <button onClick={handleLogout} className="p-3 rounded-xl bg-rose-500/10 text-rose-500"><LogOut className="h-5 w-5" /></button>
                </div>
              ) : (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAuth(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium shadow-lg">
                  <User className="h-5 w-5" /><span>تسجيل الدخول</span>
                </motion.button>
              )}

              <button onClick={() => setShowDevLogin(true)} className={`p-2 rounded-lg text-xs ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}><Lock className="h-4 w-4" /></button>
            </div>

            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className={`md:hidden p-3 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}><Menu className="h-6 w-6" /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[ { label: 'إجمالي العقارات', value: filteredApartments.length, icon: Building2, color: 'from-violet-500 to-purple-600' }, { label: 'للإيجار', value: filteredApartments.filter(a => a.type === 'rent').length, icon: Home, color: 'from-emerald-500 to-teal-600' }, { label: 'للبيع', value: filteredApartments.filter(a => a.type === 'sale').length, icon: TrendingUp, color: 'from-rose-500 to-pink-600' }, { label: 'المناطق', value: uniqueAreas.length, icon: MapPin, color: 'from-amber-500 to-orange-600' } ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}><stat.icon className="h-5 w-5 text-white" /></div>
                  <div><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</p><p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p></div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className={`p-6 rounded-2xl mb-8 ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Filter className={`absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <input type="text" placeholder="ابحث عن شقة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pr-12 pl-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">الكل</option><option value="rent">إيجار</option><option value="sale">بيع</option></select>
                <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">كل المناطق</option>{uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}</select>
                <select value={bedroomsFilter} onChange={(e) => setBedroomsFilter(e.target.value)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">عدد الغرف</option><option value="1">1+ غرفة</option><option value="2">2+ غرفة</option><option value="3">3+ غرفة</option><option value="4">4+ غرفة</option></select>
                <select value={bathroomsFilter} onChange={(e) => setBathroomsFilter(e.target.value)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">عدد الحمامات</option><option value="1">1+ حمام</option><option value="2">2+ حمام</option><option value="3">3+ حمام</option></select>
                <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">كل المساحات</option><option value="50">50+ م²</option><option value="80">80+ م²</option><option value="100">100+ م²</option><option value="120">120+ م²</option><option value="150">150+ م²</option><option value="200">200+ م²</option><option value="250">250+ م²</option></select>
                <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="all">كل الأسعار</option><option value="5000">حتى 5,000</option><option value="10000">حتى 10,000</option><option value="20000">حتى 20,000</option><option value="50000">حتى 50,000</option><option value="100000">حتى 100,000</option><option value="500000">حتى 500,000</option><option value="1000000">حتى 1,000,000</option></select>
              </div>
            </div>
          </div>

          {/* Apartments Grid */}
          {filteredApartments.length === 0 ? (
            <div className="text-center py-16"><Building2 className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>لا توجد عقارات</h3><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>جرب تغيير معايير البحث</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApartments.map((apartment, i) => (
                <motion.div key={apartment.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -5 }} className={`rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg group`}>
                  <div className="relative h-48 overflow-hidden">
                    <img src={apartment.imageUrl || apartment.images?.[0] || '/logo.svg'} alt={apartment.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                    <div className="absolute top-3 right-3 flex gap-2 flex-wrap">
                      {apartment.isVip && <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-medium flex items-center gap-1"><Diamond className="h-3 w-3" /> VIP</span>}
                      {apartment.isFeatured && !apartment.isVip && <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-medium flex items-center gap-1"><Star className="h-3 w-3" /> مميز</span>}
                      {!apartment.isFeatured && !apartment.isVip && <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-medium flex items-center gap-1"><Home className="h-3 w-3" /> عادي</span>}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusConfig[apartment.status]?.bgColor || 'bg-slate-100'} ${statusConfig[apartment.status]?.color || 'text-slate-600'}`}>{statusConfig[apartment.status]?.label || apartment.status}</span>
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className={`relative px-3 py-1.5 rounded-full text-xs font-bold text-white ${apartment.type === 'rent' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-blue-500 to-cyan-600'} shadow-lg`}>{apartment.type === 'rent' ? 'للإيجار' : 'للبيع'}</span>
                    </div>
                    <button onClick={() => toggleFavorite(apartment.id)} className={`absolute bottom-3 right-3 p-2 rounded-full ${darkMode ? 'bg-slate-900/80' : 'bg-white/80'} backdrop-blur transition-all hover:scale-110`}>
                      <Heart className={`h-5 w-5 ${favorites.includes(apartment.id) ? 'fill-red-500 text-red-500' : darkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className={`text-lg font-bold mb-2 line-clamp-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apartment.title}</h3>
                    {/* السعر في الأعلى */}
                    <div className="mb-2">
                      <p className="text-2xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent">{apartment.price.toLocaleString()} ج.م{apartment.type === 'rent' && <span className={`text-sm font-normal ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}> /شهر</span>}</p>
                    </div>
                    {/* وصف الشقة */}
                    <p className={`text-sm mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apartment.description}</p>
                    {/* تفاصيل الشقة */}
                    <div className={`p-3 rounded-xl mb-3 ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.area || 'غير متوفر'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.apartmentSize ? `${apartment.apartmentSize} م²` : 'غير محدد'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.bedrooms || '-'} غرف</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bath className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.bathrooms || '-'} حمام</span>
                        </div>
                        {apartment.floor && <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>الدور {apartment.floor}</span></div>}
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.type === 'rent' ? 'إيجار' : 'بيع'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button onClick={() => { if (!currentUser) { addToast('يجب تسجيل الدخول لعرض التفاصيل', 'error'); setShowAuth(true); return; } setSelectedApartment(apartment); fetchComments(apartment.id); setCurrentImageIndex(0); fetch(`/api/apartments/${apartment.id}/details`, { method: 'GET' }).catch(() => {}); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        <span>عرض التفاصيل</span>
                      </button>
                      {isDeveloper && (
                        <>
                          <button onClick={() => setEditApartment(apartment)} className={`py-2.5 px-4 rounded-xl font-medium text-sm ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>تعديل</button>
                          <button onClick={() => handleDeleteApartment(apartment.id)} className="py-2.5 px-4 rounded-xl bg-red-500/10 text-red-500 font-medium text-sm hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className={`relative z-10 mt-auto py-6 border-t ${darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur`}>
        <div className="max-w-7xl mx-auto px-4 text-center"><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>© 2026 منطقتي | Manteqti - جميع الحقوق محفوظة</p></div>
      </footer>

      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialog} darkMode={darkMode} onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' })} />

      {/* Delete User Modal - Selective deletion */}
      {deleteUserModal.isOpen && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteUserModal(prev => ({ ...prev, isOpen: false }))}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
              {/* Header */}
              <div className={`p-5 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>حذف مستخدم</h3>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{deleteUserModal.userName}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className={`p-5 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>اختر البيانات التي تريد حذفها مع المستخدم:</p>

                {/* Quick actions */}
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setDeleteUserModal(prev => ({ ...prev, options: { apartments: true, payments: true, inquiries: true, likes: true, comments: true, messages: true, editRequests: true, blockedUsers: true } }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${deleteUserModal.options.apartments && deleteUserModal.options.payments && deleteUserModal.options.inquiries && deleteUserModal.options.likes && deleteUserModal.options.comments && deleteUserModal.options.messages ? (darkMode ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700') : (darkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}>
                    تحديد الكل
                  </button>
                  <button onClick={() => setDeleteUserModal(prev => ({ ...prev, options: { apartments: false, payments: false, inquiries: false, likes: false, comments: false, messages: false, editRequests: false, blockedUsers: false } }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${!deleteUserModal.options.apartments && !deleteUserModal.options.payments && !deleteUserModal.options.inquiries && !deleteUserModal.options.likes && !deleteUserModal.options.comments && !deleteUserModal.options.messages ? (darkMode ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700') : (darkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}>
                    إلغاء الكل
                  </button>
                </div>

                {/* Options grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'apartments' as const, label: 'العقارات', icon: '🏠', count: deleteUserModal.stats.apartments, cascade: false },
                    { key: 'payments' as const, label: 'المدفوعات', icon: '💰', count: deleteUserModal.stats.payments, cascade: false },
                    { key: 'inquiries' as const, label: 'الاستفسارات', icon: '📩', count: deleteUserModal.stats.inquiries, cascade: false },
                    { key: 'likes' as const, label: 'الإعجابات', icon: '❤️', count: deleteUserModal.stats.likes, cascade: true },
                    { key: 'comments' as const, label: 'التعليقات', icon: '💬', count: deleteUserModal.stats.comments, cascade: true },
                    { key: 'messages' as const, label: 'الرسائل', icon: '📨', count: deleteUserModal.stats.messages, cascade: true },
                    { key: 'editRequests' as const, label: 'طلبات التعديل', icon: '✏️', count: deleteUserModal.stats.editRequests, cascade: true },
                    { key: 'blockedUsers' as const, label: 'قائمة المحظورين', icon: '🚫', count: deleteUserModal.stats.blockedUsers, cascade: true },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setDeleteUserModal(prev => ({ ...prev, options: { ...prev.options, [item.key]: !prev.options[item.key] } }))}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right relative ${
                        deleteUserModal.options[item.key]
                          ? (darkMode ? 'border-violet-500 bg-violet-500/10' : 'border-violet-400 bg-violet-50')
                          : (darkMode ? 'border-slate-700 bg-slate-700/50' : 'border-slate-200 bg-slate-50')
                      }`}
                      title={item.cascade ? 'هذه البيانات مرتبطة بالمستخدم وستُحذف تلقائياً' : undefined}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${deleteUserModal.options[item.key] ? (darkMode ? 'bg-violet-600' : 'bg-violet-100') : (darkMode ? 'bg-slate-600' : 'bg-slate-200')}`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${deleteUserModal.options[item.key] ? (darkMode ? 'text-violet-300' : 'text-violet-700') : (darkMode ? 'text-slate-400' : 'text-slate-500')}`}>{item.label}</p>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.count} عنصر{item.cascade && !deleteUserModal.options[item.key] ? ' (cascade)' : ''}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        deleteUserModal.options[item.key]
                          ? 'bg-violet-500 border-violet-500'
                          : (darkMode ? 'border-slate-600' : 'border-slate-300')
                      }`}>
                        {deleteUserModal.options[item.key] && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className={`p-5 border-t flex items-center justify-between ${darkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-slate-50'}`}>
                <button onClick={() => setDeleteUserModal(prev => ({ ...prev, isOpen: false }))}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                  إلغاء
                </button>
                <button onClick={() => handleDeleteUser(deleteUserModal.userId, deleteUserModal.userName, true)} disabled={deleteUserModal.loading}
                  className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-50 flex items-center gap-2 transition-all">
                  {deleteUserModal.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  حذف المستخدم
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Toasts */}
      <div className="fixed top-4 left-4 z-[100] space-y-2">
        <AnimatePresence>{toasts.map(toast => (
          <motion.div key={toast.id} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-violet-500 text-white'}`}>
            {toast.type === 'success' && <Check className="h-5 w-5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
            {toast.type === 'info' && <AlertTriangle className="h-5 w-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        ))}</AnimatePresence>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>{showMobileMenu && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setShowMobileMenu(false)}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className={`absolute left-0 top-0 bottom-0 w-80 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>القائمة</h2>
                <button onClick={() => setShowMobileMenu(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setShowAddModal(true); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white"><Building2 className="h-5 w-5" />إضافة شقة</button>
                <button onClick={() => { setShowChat(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><Brain className="h-5 w-5" />المساعد الذكي</button>
                <button onClick={() => { if (isDeveloper) { fetchMessages(); setShowMessages(true); } else if (currentUser) { setShowMessages(true); } else { setShowAuth(true); } setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><MessageCircle className="h-5 w-5" />تواصل معنا</button>
                {isDeveloper ? (
                  <>
        <button onClick={() => { setShowDevPanel(true); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white"><ShieldCheck className="h-5 w-5" />لوحة المطور{pendingApartments.length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-white/20 text-xs">{pendingApartments.length}</span>}</button>
    <button onClick={() => { setShowMessages(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} relative`}><MessageCircle className="h-5 w-5" />الرسائل{messages.filter(m => !m.isRead).length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-red-500 text-white text-xs">{messages.filter(m => !m.isRead).length}</span>}</button>
    <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-red-400' : 'bg-slate-100 text-red-500'}`}><LogOut className="h-5 w-5" />تسجيل الخروج</button>
  </>
) : currentUser ? (
  <>
    <button onClick={() => { fetchMyPendingApartments(); setShowMyPending(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><User className="h-5 w-5" />حسابي{myPendingApartments.length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{myPendingApartments.length}</span>}</button>
    <button onClick={() => { fetchUserPayments(); setShowMyPayments(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><CreditCard className="h-5 w-5" />المدفوعات</button>
    <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-red-400' : 'bg-slate-100 text-red-500'}`}><LogOut className="h-5 w-5" />تسجيل الخروج</button>
  </>
) : (
  <>
    <button onClick={() => { setShowAuth(true); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white"><User className="h-5 w-5" />تسجيل الدخول</button>
    <button onClick={() => { setShowDevLogin(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><Lock className="h-5 w-5" />دخول المطور</button>
  </>
)}
                <button onClick={() => setDarkMode(!darkMode)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-amber-400' : 'bg-slate-100 text-slate-700'}`}>{darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}{darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* My Pending Apartments Modal */}
      <AnimatePresence>{showMyPending && currentUser && !isDeveloper && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMyPending(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Hourglass className="h-6 w-6 text-amber-500" />عقاراتي قيد المراجعة</h2>
              <button onClick={() => setShowMyPending(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {myPendingApartments.length === 0 ? (
                <div className="text-center py-12"><CheckCircle2 className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد عقارات قيد المراجعة</p></div>
              ) : (
                <div className="space-y-4">{myPendingApartments.map(apt => (
                  <div key={apt.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <div className="flex gap-4">
                      <img src={apt.imageUrl || apt.images?.[0] || '/logo.svg'} alt={apt.title} className="w-24 h-20 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                      <div className="flex-1">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">قيد المراجعة</span>
                        <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</h3>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.area} • {apt.price.toLocaleString()} ج.م</p>
                      </div>
                      <button onClick={async () => { if (confirm('هل تريد حذف هذا العقار؟')) { await fetch(`/api/apartments/${apt.id}`, { method: 'DELETE' }); fetchMyPendingApartments(); fetchApartments(); addToast('تم حذف العقار', 'success'); } }} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* My Payments Modal */}
      <AnimatePresence>{showMyPayments && currentUser && !isDeveloper && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMyPayments(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><CreditCard className="h-6 w-6 text-violet-500" />المدفوعات</h2>
              <div className="flex gap-2">
                <button onClick={fetchUserPayments} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`} title="تحديث"><RefreshCw className={`h-4 w-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
                <button onClick={() => setShowMyPayments(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
            </div>
            <div className={`grid grid-cols-3 gap-3 mb-4`}>
              <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-emerald-50'}`}><p className={`text-2xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{userPayments.filter(p => p.status === 'Paid').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>مؤكدة</p></div>
              <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-amber-50'}`}><p className={`text-2xl font-bold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{userPayments.filter(p => p.status === 'Pending').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>قيد الانتظار</p></div>
              <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-red-50'}`}><p className={`text-2xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{userPayments.filter(p => p.status === 'Failed').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>مرفوضة</p></div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userPayments.length === 0 ? <div className="text-center py-12"><CreditCard className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد مدفوعات بعد</p></div> : <div className="space-y-3">{userPayments.map(pay => (
                <div key={pay.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{pay.amount} ج.م</p><span className={`px-2 py-0.5 rounded-full text-xs ${pay.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : pay.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pay.status === 'Paid' ? '✅ مؤكد' : pay.status === 'Pending' ? '⏳ قيد الانتظار' : '❌ مرفوض'}</span></div><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{pay.method} • {new Date(pay.createdAt).toLocaleDateString('ar-EG')}</p>{pay.inquiry?.apartment && <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>🏠 {pay.inquiry.apartment.title}</p>}</div></div>
                  {pay.status === 'Pending' && <p className={`text-xs mt-2 ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>⏳ بانتظار تأكيد المطور</p>}
                  {pay.status === 'Paid' && <p className={`text-xs mt-2 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>✅ تم تأكيد الدفع - يمكنك الآن عرض بيانات التواصل</p>}
                </div>
              ))}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Dev Send Message Modal */}
      <AnimatePresence>{devMessageTo && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDevMessageTo(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>📨 إرسال رسالة لـ {devMessageTo.userName}</h2>
              <button onClick={() => { setDevMessageTo(null); setDevMessageText(''); }} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <textarea value={devMessageText} onChange={(e) => setDevMessageText(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={4} className={`w-full px-4 py-3 rounded-xl border mb-4 resize-none ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'}`} />
            <div className="flex gap-3">
              <button onClick={handleDevSendMessage} disabled={!devMessageText.trim()} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"><Send className="h-4 w-4" />إرسال</button>
              <button onClick={() => { setDevMessageTo(null); setDevMessageText(''); }} className={`px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>إلغاء</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* User Detail Modal */}
      <AnimatePresence>{selectedUserDetail && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelectedUserDetail(null); setUserDetailData({ apartments: [], payments: [], inquiries: [] }); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-3xl rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl max-h-[85vh] overflow-hidden flex flex-col`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'} flex items-center justify-between`}>
              <h2 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><User className="h-5 w-5 text-violet-500" />تفاصيل المستخدم: {selectedUserDetail.name}</h2>
              <button onClick={() => { setSelectedUserDetail(null); setUserDetailData({ apartments: [], payments: [], inquiries: [] }); }} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* User Info */}
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <h3 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>📋 معلومات الحساب</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>الاسم:</span> <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUserDetail.name}</span></div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>البريد:</span> <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUserDetail.email || selectedUserDetail.identifier}</span></div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>الهاتف:</span> <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedUserDetail.phone || 'غير محدد'}</span></div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>تاريخ التسجيل:</span> <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{new Date(selectedUserDetail.createdAt).toLocaleDateString('ar-EG')}</span></div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>حالة التأكيد:</span> {selectedUserDetail.isApproved ? <span className="text-emerald-500 font-medium">✅ مؤكد</span> : <span className="text-amber-500 font-medium">⏳ غير مؤكد</span>}</div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>تأكيد البريد:</span> {selectedUserDetail.emailVerified !== false ? <span className="text-emerald-500 font-medium">✅ مؤكد</span> : <span className="text-amber-500 font-medium">📧 غير مؤكد</span>}</div>
                  <div><span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>حالة الحساب:</span> {selectedUserDetail.isBlocked ? <span className="text-red-500 font-medium">🚫 محظور</span> : selectedUserDetail.emailVerified === false ? <span className="text-amber-500 font-medium">⏳ بانتظار تأكيد البريد</span> : <span className="text-emerald-500 font-medium">✅ نشط</span>}</div>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={() => setDevMessageTo({ userId: selectedUserDetail.id, userName: selectedUserDetail.name })} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 flex items-center gap-1"><Send className="h-4 w-4" />إرسال رسالة</button>
                  {selectedUserDetail.isBlocked ? (
                    <button onClick={() => { unblockUser(selectedUserDetail.id); setSelectedUserDetail({ ...selectedUserDetail, isBlocked: false }); }} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm">إلغاء الحظر</button>
                  ) : (
                    <button onClick={() => { blockUser(selectedUserDetail.id, 'حظر من المطور'); setSelectedUserDetail({ ...selectedUserDetail, isBlocked: true }); }} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm">حظر</button>
                  )}
                  {selectedUserDetail.isApproved === false && (
                    <button onClick={() => { handleApproveUser(selectedUserDetail.id, selectedUserDetail.name); setSelectedUserDetail({ ...selectedUserDetail, isApproved: true }); }} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm flex items-center gap-1"><Check className="h-4 w-4" />تأكيد التسجيل</button>
                  )}
                  <button onClick={() => { setSelectedUserDetail(null); setUserDetailData({ apartments: [], payments: [], inquiries: [] }); handleDeleteUser(selectedUserDetail.id, selectedUserDetail.name); }} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 flex items-center gap-1"><Trash2 className="h-4 w-4" />حذف المستخدم</button>
                </div>
              </div>
              {/* Loading */}
              {userDetailLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-500" /><p className={`mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>جاري تحميل البيانات...</p></div>}
              {/* Apartments */}
              {!userDetailLoading && (
                <>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Building2 className="h-5 w-5 text-amber-500" />العقارات ({userDetailData.apartments.length})</h3>
                    {userDetailData.apartments.length === 0 ? <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد عقارات</p> : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {userDetailData.apartments.map(apt => (
                          <div key={apt.id} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-slate-600' : 'bg-white'}`}>
                            <div>
                              <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</p>
                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.price} ج.م • {apt.area} • {statusConfig[apt.status]?.label || apt.status}</p>
                            </div>
                            <div className="flex gap-1">
                              {apt.status === 'pending' && <button onClick={() => handleApproveApartment(apt.id)} className="p-1 rounded bg-emerald-500 text-white" title="موافقة"><Check className="h-3.5 w-3.5" /></button>}
                              {['pending', 'available'].includes(apt.status) && <button onClick={() => handleRejectApartment(apt.id)} className="p-1 rounded bg-red-500 text-white" title="رفض"><X className="h-3.5 w-3.5" /></button>}
                              <button onClick={() => handleDeleteApartment(apt.id)} className="p-1 rounded bg-rose-600 text-white" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Payments */}
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><CreditCard className="h-5 w-5 text-emerald-500" />المدفوعات ({userDetailData.payments.length})</h3>
                    {userDetailData.payments.length === 0 ? <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد مدفوعات</p> : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {userDetailData.payments.map(pay => (
                          <div key={pay.id} className={`p-3 rounded-lg flex items-center justify-between ${darkMode ? 'bg-slate-600' : 'bg-white'}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{pay.amount} ج.م</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${pay.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : pay.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{pay.status === 'Paid' ? 'مدفوع' : pay.status === 'Pending' ? 'قيد الانتظار' : 'مرفوض'}</span>
                              </div>
                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{pay.method} • {pay.inquiry?.apartment ? `🏠 ${pay.inquiry.apartment.title}` : 'عقار محذوف'}</p>
                            </div>
                            {pay.status === 'Pending' && (
                              <div className="flex gap-1">
                                <button onClick={() => handleConfirmPayment(pay.id)} className="p-1 rounded bg-emerald-500 text-white" title="تأكيد"><Check className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleRejectPayment(pay.id)} className="p-1 rounded bg-red-500 text-white" title="رفض"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Inquiries */}
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><MessageCircle className="h-5 w-5 text-blue-500" />الاستفسارات ({userDetailData.inquiries.length})</h3>
                    {userDetailData.inquiries.length === 0 ? <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد استفسارات</p> : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {userDetailData.inquiries.map(inq => (
                          <div key={inq.id} className={`p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-white'}`}>
                            <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{inq.message}</p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{inq.apartment?.title || 'عقار محذوف'} • {new Date(inq.createdAt).toLocaleDateString('ar-EG')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Messages Modal */}
      <AnimatePresence>{showMessages && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMessages(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl max-h-[80vh] overflow-hidden flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><MessageCircle className="h-6 w-6 text-violet-500" />{isDeveloper ? 'رسائل المستخدمين' : 'تواصل مع المطور'}</h2>
              <button onClick={() => setShowMessages(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            {!isDeveloper && (
              <div className="mb-4">
                {isBlocked && <div className={`p-3 rounded-xl mb-3 ${darkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}><p className="text-red-500 text-sm">⚠️ تم حظرك من استخدام الموقع</p></div>}
                <div className="flex gap-2">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالتك..." className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'}`} disabled={isBlocked} />
                  <button onClick={sendMessage} disabled={messageLoading || isBlocked} className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white disabled:opacity-50">{messageLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-3">
              {messages.length === 0 ? <div className="text-center py-8"><MessageCircle className={`h-12 w-12 mx-auto mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد رسائل</p></div> : messages.map(msg => {
                const isSentByMe = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} className={`p-4 rounded-xl ${isSentByMe ? (darkMode ? 'bg-violet-900/30 ml-4' : 'bg-violet-50 ml-4') : (darkMode ? 'bg-slate-700 mr-4' : 'bg-slate-50 mr-4')}`}>
                    {isDeveloper ? (
                      <div className="flex items-center justify-between mb-2"><span className={`text-sm font-medium ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>{msg.sender?.name || 'مستخدم'} ({msg.sender?.identifier})</span><span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span></div>
                    ) : (
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium ${isSentByMe ? (darkMode ? 'text-violet-400' : 'text-violet-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>{isSentByMe ? 'أنت' : 'المطور'}</span>
                        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    )}
                    <p className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{msg.content}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>{showAuth && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAuth(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', duration: 0.5 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-3xl overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            {/* Gradient Header */}
            <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 pt-8 pb-10">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 right-8 w-20 h-20 rounded-full border-2 border-white/30"></div>
                <div className="absolute bottom-2 left-6 w-32 h-32 rounded-full border-2 border-white/20"></div>
                <div className="absolute top-8 left-1/2 w-16 h-16 rounded-full border border-white/25"></div>
              </div>
              <button onClick={() => setShowAuth(false)} className="absolute top-4 left-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"><X className="h-5 w-5 text-white" /></button>
              <div className="relative z-10 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 border border-white/20">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">{authStep === 'login' ? 'مرحباً بعودتك! 👋' : 'انضم إلينا ✨'}</h2>
                <p className="text-sm text-white/80 mt-1.5 leading-relaxed">{authStep === 'login' ? 'سجل دخولك لاستكشاف أفضل العقارات' : 'أنشئ حسابك وابدأ رحلتك في عالم العقارات'}</p>
              </div>
            </div>
            {/* Form */}
            <div className="px-6 pb-6 -mt-6">
              <div className={`rounded-2xl p-5 ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50/80'} backdrop-blur-sm border ${darkMode ? 'border-slate-600/50' : 'border-slate-100'}`}>
                <form onSubmit={authStep === 'login' ? handleLogin : handleRegister} className="space-y-4">
                  {authStep === 'register' && (
                    <div>
                      <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>الاسم</label>
                      <div className="relative">
                        <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="اسمك الكامل" className={`w-full px-4 py-3 pr-11 rounded-xl border-2 transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{authStep === 'register' ? 'البريد الإلكتروني' : 'البريد الإلكتروني أو رقم الهاتف'}</label>
                    <div className="relative">
                      <Smartphone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input type={authStep === 'register' ? 'email' : 'text'} value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)} placeholder={authStep === 'register' ? 'example@email.com' : 'example@email.com أو رقم الهاتف'} className={`w-full px-4 py-3 pr-11 rounded-xl border-2 transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                    </div>
                  </div>
                  {authStep === 'register' && (
                    <div>
                      <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>رقم الهاتف</label>
                      <div className="relative">
                        <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input type="tel" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} placeholder="01xxxxxxxxx" className={`w-full px-4 py-3 pr-11 rounded-xl border-2 transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>كلمة المرور</label>
                    <div className="relative">
                      <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input type={showPassword ? 'text' : 'password'} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className={`w-full px-4 py-3 pr-11 pl-11 rounded-xl border-2 transition-all duration-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute left-3.5 top-1/2 -translate-y-1/2 p-1 ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-violet-500" /><label htmlFor="rememberMe" className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>تذكرني</label></div>
                    {authStep === 'login' && <button type="button" onClick={() => { setShowAuth(false); setShowForgotPassword(true); }} className={`text-xs ${darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'} transition-colors`}>نسيت كلمة المرور؟</button>}
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
                    {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : authStep === 'login' ? <><span>تسجيل الدخول</span><span className='text-lg'>🔑</span></> : <><span>إنشاء حساب</span><Plus className="h-4 w-4" /></>}
                  </button>
                </form>
                <div className="mt-4 text-center">
                  <button onClick={() => setAuthStep(authStep === 'login' ? 'register' : 'login')} className={`text-sm ${darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'} transition-colors`}>{authStep === 'login' ? <>ليس لديك حساب؟ <span className={darkMode ? 'text-cyan-400 font-semibold' : 'text-cyan-600 font-semibold'}>سجل الآن</span></> : 'لديك حساب؟ سجل دخولك'}</button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Developer Login Modal */}
      <AnimatePresence>{showDevLogin && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDevLogin(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', duration: 0.5 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-3xl overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            {/* Golden Gradient Header */}
            <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 px-6 pt-8 pb-10">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 right-8 w-20 h-20 rounded-full border-2 border-white/30"></div>
                <div className="absolute bottom-2 left-6 w-32 h-32 rounded-full border-2 border-white/20"></div>
                <div className="absolute top-8 left-1/2 w-16 h-16 rounded-full border border-white/25"></div>
              </div>
              <button onClick={() => setShowDevLogin(false)} className="absolute top-4 left-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"><X className="h-5 w-5 text-white" /></button>
              <div className="relative z-10 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 border border-white/20">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">لوحة تحكم المطور 🔧</h2>
                <p className="text-sm text-white/80 mt-1.5 leading-relaxed">دخول آمن للإدارة</p>
              </div>
            </div>
            {/* Form */}
            <div className="px-6 pb-6 -mt-6">
              <div className={`rounded-2xl p-5 ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50/80'} backdrop-blur-sm border ${darkMode ? 'border-slate-600/50' : 'border-slate-100'}`}>
                <form onSubmit={handleDevLogin} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="developer@email.com" className={`w-full px-4 py-3 pr-11 rounded-xl border-2 transition-all duration-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>كلمة المرور</label>
                    <div className="relative">
                      <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input type={showDevPassword ? 'text' : 'password'} value={devPassword} onChange={(e) => setDevPassword(e.target.value)} placeholder="••••••••" className={`w-full px-4 py-3 pr-11 pl-11 rounded-xl border-2 transition-all duration-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} required />
                      <button type="button" onClick={() => setShowDevPassword(!showDevPassword)} className={`absolute left-3.5 top-1/2 -translate-y-1/2 p-1 ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>{showDevPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="devRememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" /><label htmlFor="devRememberMe" className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>تذكرني</label></div>
                  <button type="submit" disabled={devLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
                    {devLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>دخول للوحة التحكم</span><span className='text-lg'>🛡️</span></>}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Add Apartment Modal */}
      <AnimatePresence>{showAddModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>إضافة شقة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAddApartment(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عنوان الشقة *</label><input type="text" value={aptForm.title} onChange={(e) => setAptForm({ ...aptForm, title: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر *</label><input type="number" value={aptForm.price} onChange={(e) => setAptForm({ ...aptForm, price: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة *</label><input type="text" list="area-suggestions" value={aptForm.area} onChange={(e) => setAptForm({ ...aptForm, area: e.target.value })} placeholder="اكتب أو اختر المنطقة" className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /><datalist id="area-suggestions">{egyptianAreas.map(area => <option key={area} value={area} />)}</datalist></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>غرف النوم</label><select value={aptForm.bedrooms} onChange={(e) => setAptForm({ ...aptForm, bedrooms: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الحمامات</label><select value={aptForm.bathrooms} onChange={(e) => setAptForm({ ...aptForm, bathrooms: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الدور</label><select value={aptForm.floor} onChange={(e) => setAptForm({ ...aptForm, floor: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="">بدون تحديد</option>{['أرضي', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'].map(n => <option key={n} value={n === 'أرضي' ? '0' : n === '15+' ? '15' : n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>📏 مساحة الشقة (م²) <span className="text-red-500">*</span></label><input type="number" min="1" placeholder="مثال: 120" value={aptForm.apartmentSize} onChange={(e) => setAptForm({ ...aptForm, apartmentSize: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>النوع (إيجار / بيع)</label><select value={aptForm.type} onChange={(e) => setAptForm({ ...aptForm, type: e.target.value as 'rent' | 'sale' })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="rent">إيجار</option><option value="sale">بيع</option></select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>مستوى النشر</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setAptForm({ ...aptForm, listingType: 'regular' })} className={`p-3 rounded-xl border-2 text-center transition-all ${aptForm.listingType === 'regular' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-white'}`}>
                      <Home className={`h-5 w-5 mx-auto mb-1 ${aptForm.listingType === 'regular' ? 'text-emerald-500' : darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                      <p className={`text-xs font-bold ${aptForm.listingType === 'regular' ? 'text-emerald-600 dark:text-emerald-400' : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>عادي</p>
                      <p className={`text-xs mt-0.5 ${(settings.regularFee || 30) === 0 ? 'text-emerald-500 font-bold' : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>{(settings.regularFee || 30) === 0 ? 'مجاني ✨' : `${settings.regularFee || 30} ${settings.currency}`}</p>
                    </button>
                    <button type="button" onClick={() => setAptForm({ ...aptForm, listingType: 'featured' })} className={`p-3 rounded-xl border-2 text-center transition-all ${aptForm.listingType === 'featured' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-white'}`}>
                      <Star className={`h-5 w-5 mx-auto mb-1 ${aptForm.listingType === 'featured' ? 'text-amber-500' : darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                      <p className={`text-xs font-bold ${aptForm.listingType === 'featured' ? 'text-amber-600 dark:text-amber-400' : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>مميز</p>
                      <p className={`text-xs mt-0.5 ${(settings.featuredFee || 100) === 0 ? 'text-emerald-500 font-bold' : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>{(settings.featuredFee || 100) === 0 ? 'مجاني ✨' : `${settings.featuredFee || 100} ${settings.currency}`}</p>
                    </button>
                    <button type="button" onClick={() => setAptForm({ ...aptForm, listingType: 'vip' })} className={`p-3 rounded-xl border-2 text-center transition-all ${aptForm.listingType === 'vip' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-white'}`}>
                      <Diamond className={`h-5 w-5 mx-auto mb-1 ${aptForm.listingType === 'vip' ? 'text-purple-500' : darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                      <p className={`text-xs font-bold ${aptForm.listingType === 'vip' ? 'text-purple-600 dark:text-purple-400' : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>VIP+</p>
                      <p className={`text-xs mt-0.5 ${(settings.vipFee || 300) === 0 ? 'text-emerald-500 font-bold' : (darkMode ? 'text-slate-500' : 'text-slate-400')}`}>{(settings.vipFee || 300) === 0 ? 'مجاني ✨' : `${settings.vipFee || 300} ${settings.currency}`}</p>
                    </button>
                  </div>
                </div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رقم الهاتف *</label><input type="tel" value={aptForm.ownerPhone} onChange={(e) => setAptForm({ ...aptForm, ownerPhone: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div className="col-span-2"><div className="flex items-center justify-between mb-2"><label className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الوصف *</label><button type="button" onClick={generateAIDescription} disabled={aiDescLoading} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-medium disabled:opacity-50 hover:from-violet-600 hover:to-purple-700 transition-all">{aiDescLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}إنشاء بالذكاء الاصطناعي</button></div><textarea value={aptForm.description} onChange={(e) => setAptForm({ ...aptForm, description: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} rows={3} required /></div>
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رابط الخريطة (اختياري)</label><input type="url" value={aptForm.mapLink} onChange={(e) => setAptForm({ ...aptForm, mapLink: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}><ImageIcon className="h-4 w-4 inline ml-1" />صور الشقة</label><FileUpload type="image" value={imageUrls} onChange={setImageUrls} maxFiles={10} /></div>
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}><Video className="h-4 w-4 inline ml-1" />فيديوهات الشقة (اختياري)</label><FileUpload type="video" value={videoUrls} onChange={setVideoUrls} maxFiles={3} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>إلغاء</button>
                <button type="submit" disabled={aptSubmitting} className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50">{aptSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : isDeveloper ? 'نشر الشقة' : currentUser ? 'إرسال للمراجعة' : 'تسجيل الدخول'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Apartment Details Modal */}
      <AnimatePresence>{selectedApartment && !editApartment && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelectedApartment(null); setCurrentImageIndex(0); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="relative h-72 md:h-96">
              <img src={selectedApartment.images?.[currentImageIndex] || selectedApartment.imageUrl || '/logo.svg'} alt={selectedApartment.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; (e.target as HTMLImageElement).onerror = null; }} />
              {selectedApartment.images && selectedApartment.images.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i > 0 ? i - 1 : selectedApartment.images!.length - 1); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight className="h-6 w-6" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i => i < selectedApartment.images!.length - 1 ? i + 1 : 0); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft className="h-6 w-6" /></button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">{selectedApartment.images.map((_, i) => <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }} className={`w-2 h-2 rounded-full ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />)}</div>
                </>
              )}
              <button onClick={() => { setSelectedApartment(null); setCurrentImageIndex(0); }} className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="h-5 w-5" /></button>
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${selectedApartment.type === 'rent' ? 'bg-emerald-500' : 'bg-blue-500'}`}>{selectedApartment.type === 'rent' ? 'للإيجار' : 'للبيع'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedApartment.status]?.bgColor} ${statusConfig[selectedApartment.status]?.color}`}>{statusConfig[selectedApartment.status]?.label}</span>
              </div>
            </div>
            <div className="p-6">
              <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedApartment.title}</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1"><MapPin className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.area}</span></div>
                <div className="flex items-center gap-1"><Layers className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.apartmentSize ? `${selectedApartment.apartmentSize} م²` : 'غير محدد'}</span></div>
                <div className="flex items-center gap-1"><Bed className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.bedrooms} غرف</span></div>
                <div className="flex items-center gap-1"><Bath className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.bathrooms} حمام</span></div>
                {selectedApartment.floor && <div className="flex items-center gap-1"><Home className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>الدور {selectedApartment.floor}</span></div>}
              </div>
              <p className="text-3xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent mb-4">{selectedApartment.price.toLocaleString()} ج.م{selectedApartment.type === 'rent' && <span className="text-sm text-slate-500"> /شهر</span>}</p>
              <p className={`mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.description}</p>
              
              {hasPaidForApartment(selectedApartment.id) ? (
                <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <h3 className={`font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>بيانات التواصل</h3>
                  <div className="flex items-center gap-2"><Phone className="h-5 w-5 text-emerald-500" /><a href={`tel:${selectedApartment.ownerPhone}`} className="text-emerald-600 font-medium hover:underline">{selectedApartment.ownerPhone}</a></div>
                  {selectedApartment.mapLink && <a href={selectedApartment.mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 text-violet-600 hover:underline"><ExternalLink className="h-4 w-4" />عرض على الخريطة</a>}
                </div>
              ) : (
                <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-amber-900/20 border border-amber-700' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-3">
                    <Lock className="h-6 w-6 text-amber-500" />
                    <div>
                      <p className={`font-medium ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>بيانات التواصل محجوبة</p>
                      <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{settings.contactFee === 0 ? 'بيانات التواصل مجانية ✨' : `ادفع ${settings.contactFee} ${settings.currency} للحصول على بيانات التواصل`}</p>
                    </div>
                  </div>
                  <button onClick={() => setPaymentApartment(selectedApartment)} className={`mt-3 w-full py-2 rounded-xl font-medium ${settings.contactFee === 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'} text-white`}><CreditCard className="h-4 w-4 inline ml-2" />{settings.contactFee === 0 ? 'الحصول على بيانات التواصل مجاناً ✨' : 'طلب بيانات التواصل'}</button>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => toggleFavorite(selectedApartment.id)} className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${favorites.includes(selectedApartment.id) ? 'bg-red-500 text-white' : darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}><Heart className={`h-5 w-5 ${favorites.includes(selectedApartment.id) ? 'fill-white' : ''}`} />{favorites.includes(selectedApartment.id) ? 'في المفضلة' : 'أضف للمفضلة'}</button>
                {isDeveloper && (
                  <>
                    <button onClick={() => setEditApartment(selectedApartment)} className={`py-3 px-4 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>تعديل</button>
                    <button onClick={() => handleDeleteApartment(selectedApartment.id)} className="py-3 px-4 rounded-xl bg-red-500/10 text-red-500 font-medium hover:bg-red-500/20">حذف</button>
                  </>
                )}
              </div>

              {/* Comments Section */}
              <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><MessageCircle className="h-5 w-5 text-violet-500" />التعليقات</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="اكتب تعليقاً..." className={`flex-1 px-4 py-2 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                  <button onClick={() => addComment(selectedApartment.id)} disabled={commentLoading} className="px-4 py-2 rounded-xl bg-violet-600 text-white disabled:opacity-50">{commentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                </div>
                <div className="space-y-3">
                  {comments.filter(c => c.apartmentId === selectedApartment.id).map(comment => (
                    <div key={comment.id} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2 mb-1"><span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{comment.user.name}</span><span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(comment.createdAt).toLocaleDateString('ar-EG')}</span></div>
                      <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{comment.content}</p>
                    </div>
                  ))}
                  {comments.filter(c => c.apartmentId === selectedApartment.id).length === 0 && <p className={`text-center py-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>لا توجد تعليقات بعد</p>}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Edit Apartment Modal */}
      <AnimatePresence>{editApartment && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditApartment(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>تعديل الشقة</h2>
              <button onClick={() => setEditApartment(null)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={handleEditApartment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>العنوان</label><input type="text" value={editApartment.title} onChange={(e) => setEditApartment({ ...editApartment, title: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر</label><input type="number" value={editApartment.price} onChange={(e) => setEditApartment({ ...editApartment, price: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة</label><input type="text" list="area-suggestions-edit" value={editApartment.area} onChange={(e) => setEditApartment({ ...editApartment, area: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /><datalist id="area-suggestions-edit">{egyptianAreas.map(area => <option key={area} value={area} />)}</datalist></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>غرف النوم</label><select value={editApartment.bedrooms} onChange={(e) => setEditApartment({ ...editApartment, bedrooms: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الحمامات</label><select value={editApartment.bathrooms} onChange={(e) => setEditApartment({ ...editApartment, bathrooms: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الدور</label><select value={editApartment.floor || ''} onChange={(e) => setEditApartment({ ...editApartment, floor: e.target.value ? parseInt(e.target.value) : undefined })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="">بدون تحديد</option>{['أرضي', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'].map(n => <option key={n} value={n === 'أرضي' ? '0' : n === '15+' ? '15' : n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>📏 مساحة الشقة (م²) <span className="text-red-500">*</span></label><input type="number" min="1" placeholder="مثال: 120" value={editApartment.apartmentSize || ''} onChange={(e) => setEditApartment({ ...editApartment, apartmentSize: e.target.value ? parseInt(e.target.value) : undefined })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الهاتف</label><input type="tel" value={editApartment.ownerPhone} onChange={(e) => setEditApartment({ ...editApartment, ownerPhone: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الحالة</label><select value={editApartment.status} onChange={(e) => setEditApartment({ ...editApartment, status: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="available">متاح</option><option value="reserved">محجوز</option><option value="unavailable">غير متاح</option><option value="sold">تم البيع</option><option value="rented">تم التأجير</option></select></div>
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الوصف</label><textarea value={editApartment.description} onChange={(e) => setEditApartment({ ...editApartment, description: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} rows={3} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setEditApartment(null)} className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>إلغاء</button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-violet-600 to-purple-700 disabled:opacity-50">{editSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'حفظ التعديلات'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>{showChat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowChat(false); setChatMessages([]); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg h-[80vh] rounded-2xl flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center"><Brain className="h-5 w-5 text-white" /></div>
                  <div><h2 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>المساعد الذكي</h2><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>منطقتي - اسألني عن العقارات</p></div>
                </div>
                <button onClick={() => { setShowChat(false); setChatMessages([]); }} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && <div className="text-center py-8"><Brain className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>مرحباً! كيف يمكنني مساعدتك؟</p></div>}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-violet-600 text-white rounded-tr-none' : darkMode ? 'bg-slate-700 text-white rounded-tl-none' : 'bg-slate-100 text-slate-900 rounded-tl-none'}`}><p className="whitespace-pre-wrap">{msg.content}</p></div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-end"><div className={`p-3 rounded-2xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} rounded-tl-none`}><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div></div>}
            </div>
            <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="اكتب رسالتك..." className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                <button type="submit" disabled={!chatInput.trim() || chatLoading} className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Developer Panel Modal */}
      <AnimatePresence>{showDevPanel && isDeveloper && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDevPanel(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl flex flex-col`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><ShieldCheck className="h-6 w-6 text-amber-500" />لوحة تحكم المطور</h2>
                <button onClick={() => setShowDevPanel(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {[ { id: 'stats', icon: BarChart3, label: 'الإحصائيات' }, { id: 'pending', icon: Hourglass, label: 'قيد المراجعة', count: pendingApartments.length }, { id: 'apartments', icon: Building2, label: 'العقارات', count: allApartments.length }, { id: 'favorites', icon: Heart, label: 'المفضلة', count: likes.length }, { id: 'payments', icon: CreditCard, label: 'المدفوعات', count: payments.length }, { id: 'messages', icon: MessageCircle, label: 'الرسائل' }, { id: 'userApprovals', icon: ShieldCheck, label: 'تأكيد المستخدمين', count: pendingUsers.length }, { id: 'users', icon: User, label: 'المستخدمين', count: allUsers.length }, { id: 'userLogs', icon: BookOpen, label: 'سجل المستخدمين', count: approvalLogs.length }, { id: 'editRequests', icon: FilePen, label: 'طلبات التعديل', count: editRequests.filter(e => e.status === 'pending').length }, { id: 'blocked', icon: Ban, label: 'محظورين' }, { id: 'settings', icon: Settings, label: 'الإعدادات' }, { id: 'logs', icon: Activity, label: 'السجل' } ].map(tab => (
                  <button key={tab.id} onClick={() => setDevTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${devTab === tab.id ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' : darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <tab.icon className="h-4 w-4" />{tab.label}
                    {tab.count !== undefined && tab.count > 0 && <span className={`px-2 py-0.5 rounded-full text-xs ${devTab === tab.id ? 'bg-white/20' : 'bg-amber-500 text-white'}`}>{tab.count}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Stats Tab */}
              {devTab === 'stats' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[ { label: 'إجمالي العقارات', value: allApartments.length, icon: Building2, color: 'from-violet-500 to-purple-600' }, { label: 'قيد المراجعة', value: pendingApartments.length, icon: Hourglass, color: 'from-amber-500 to-orange-600' }, { label: 'الاستفسارات', value: inquiries.length, icon: MessageCircle, color: 'from-blue-500 to-cyan-600' }, { label: 'المدفوعات المؤكدة', value: payments.filter(p => p.status === 'Paid').length, icon: CreditCard, color: 'from-emerald-500 to-teal-600' } ].map((stat, i) => (
                      <div key={i} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}><stat.icon className="h-4 w-4 text-white" /></div>
                          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</p>
                        </div>
                        <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[ { label: 'للإيجار', value: allApartments.filter(a => a.type === 'rent').length, color: 'text-emerald-500' }, { label: 'للبيع', value: allApartments.filter(a => a.type === 'sale').length, color: 'text-blue-500' }, { label: 'مميز', value: allApartments.filter(a => a.isFeatured).length, color: 'text-amber-500' }, { label: 'VIP+', value: allApartments.filter(a => a.isVip).length, color: 'text-purple-500' } ].map((stat, i) => (
                      <div key={i} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50/50'}`}><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</p><p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p></div>
                    ))}
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Brain className="h-5 w-5 text-violet-500" />تحليل ذكي</h3>
                    <div className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <p>📊 <strong>نسبة الإيجار للبيع:</strong> {allApartments.length > 0 ? Math.round((allApartments.filter(a => a.type === 'rent').length / allApartments.length) * 100) : 0}% إيجار</p>
                      <p className="mt-2">💰 <strong>متوسط الأسعار:</strong> {allApartments.length > 0 ? Math.round(allApartments.reduce((a, b) => a + b.price, 0) / allApartments.length).toLocaleString() : 0} {settings.currency}</p>
                      <p className="mt-2">🏆 <strong>أكثر منطقة:</strong> {uniqueAreas.length > 0 ? uniqueAreas.reduce((a, b) => allApartments.filter(apt => apt.area === a).length >= allApartments.filter(apt => apt.area === b).length ? a : b, uniqueAreas[0]) : 'لا توجد'}</p>
                      <p className="mt-2">👤 <strong>المستخدمين النشطين:</strong> {allUsers.length} | المحظورين: {blockedUsers.length}</p>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>التعليقات قيد المراجعة</h3>
                    <div className="space-y-2">
                      {comments.filter(c => c.status === 'pending').length === 0 ? <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد تعليقات قيد المراجعة</p> : comments.filter(c => c.status === 'pending').map(c => (
                        <div key={c.id} className={`p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-white'} flex items-center justify-between`}>
                          <div><p className={darkMode ? 'text-white' : 'text-slate-900'}>{c.content}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{c.user.name}</p></div>
                          <div className="flex gap-2"><button onClick={() => approveComment(c.id)} className="p-1 rounded bg-emerald-500 text-white"><Check className="h-4 w-4" /></button><button onClick={() => deleteComment(c.id)} className="p-1 rounded bg-red-500 text-white"><X className="h-4 w-4" /></button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Pending Tab */}
              {devTab === 'pending' && (
                <div className="space-y-4">
                  {pendingApartments.length === 0 ? <div className="text-center py-12"><CheckCircle2 className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد عقارات قيد المراجعة</p></div> : pendingApartments.map(apt => (
                    <div key={apt.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex gap-4">
                        <img src={apt.imageUrl || apt.images?.[0] || '/logo.svg'} alt={apt.title} className="w-32 h-24 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                        <div className="flex-1">
                          <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</h3>
                          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.area} • {apt.price.toLocaleString()} ج.م • {apt.type === 'rent' ? 'إيجار' : 'بيع'}</p>
                          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>أُرسلت: {new Date(apt.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <div className="flex gap-2"><button onClick={() => handleApproveApartment(apt.id)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">موافقة</button><button onClick={() => handleRejectApartment(apt.id)} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600">رفض</button></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Apartments Tab */}
              {devTab === 'apartments' && (
                <div className="space-y-4">
                  {allApartments.slice(0, 20).map(apt => (
                    <div key={apt.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={apt.imageUrl || apt.images?.[0] || '/logo.svg'} alt={apt.title} className="w-16 h-12 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).src = '/logo.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</h3>
                              {apt.isVip && <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-purple-500 to-pink-600 text-white">VIP+</span>}
                              {apt.isFeatured && !apt.isVip && <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white">مميز</span>}
                              {!apt.isFeatured && !apt.isVip && <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500 text-white">عادي</span>}
                            </div>
                            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.price.toLocaleString()} {settings.currency} • {statusConfig[apt.status]?.label}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select value={apt.status} onChange={(e) => { 
                            const newStatus = e.target.value;
                            if (newStatus === 'sold' || newStatus === 'rented') {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'تغيير حالة العقار',
                                message: `سيتم حذف العقار تلقائياً بعد 48 ساعة من تغيير الحالة إلى "${newStatus === 'sold' ? 'تم البيع' : 'تم التأجير'}"\n\nهل أنت متأكد؟`,
                                confirmText: 'تأكيد',
                                cancelText: 'إلغاء',
                                onConfirm: () => {
                                  apt.status = newStatus;
                                  setAllApartments([...allApartments]);
                                  fetch(`/api/apartments/${apt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, statusChangedAt: new Date().toISOString() }) });
                                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                                  addToast('تم تغيير الحالة - سيُحذف بعد 48 ساعة', 'success');
                                },
                                type: 'warning'
                              });
                            } else {
                              apt.status = newStatus;
                              setAllApartments([...allApartments]);
                              fetch(`/api/apartments/${apt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
                            }
                          }} className={`px-3 py-1 rounded-lg text-sm ${darkMode ? 'bg-slate-600 text-white' : 'bg-white border'}`}><option value="available">متاح</option><option value="preview">في معاينة</option><option value="reserved">محجوز</option><option value="sold">تم البيع</option><option value="rented">تم التأجير</option><option value="unavailable">غير متاح</option></select>
                          <div className="flex gap-1">
                            <button onClick={() => { apt.isVip = !apt.isVip; setAllApartments([...allApartments]); fetch(`/api/apartments/${apt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isVip: apt.isVip }) }); addToast(apt.isVip ? 'تم إضافة VIP+' : 'تم إزالة VIP+', 'success'); }} className={`p-1 rounded ${apt.isVip ? 'bg-purple-500 text-white' : darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`} title="VIP+"><Diamond className="h-4 w-4" /></button>
                            <button onClick={() => { apt.isFeatured = !apt.isFeatured; setAllApartments([...allApartments]); fetch(`/api/apartments/${apt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isFeatured: apt.isFeatured }) }); addToast(apt.isFeatured ? 'تم إضافة مميز' : 'تم إزالة مميز', 'success'); }} className={`p-1 rounded ${apt.isFeatured && !apt.isVip ? 'bg-amber-500 text-white' : darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`} title="مميز"><Star className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteApartment(apt.id)} className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Favorites Tab */}
              {devTab === 'favorites' && (
                <div className="space-y-4">
                  {likes.length === 0 ? <div className="text-center py-12"><Heart className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد مفضلات</p></div> : (
                    <div className={`rounded-xl overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <table className="w-full text-sm">
                        <thead className={darkMode ? 'bg-slate-600' : 'bg-slate-100'}>
                          <tr>
                            <th className={`p-3 text-right ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>المستخدم</th>
                            <th className={`p-3 text-right ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>العقار</th>
                            <th className={`p-3 text-right ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {likes.map(like => (
                            <tr key={like.id} className={`border-t ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                              <td className={`p-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{like.user?.name || 'مستخدم'}</td>
                              <td className={`p-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{like.apartment?.title || 'عقار محذوف'}</td>
                              <td className={`p-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(like.createdAt).toLocaleDateString('ar-EG')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* User Approvals Tab - تأكيد المستخدمين */}
              {devTab === 'userApprovals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>إدارة تأكيد المستخدمين - عرض جميع المستخدمين</p>
                    <div className="flex gap-1.5">
                      <button onClick={fetchAllUsers} className={`px-3 py-1 rounded-lg text-xs ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>تحديث</button>
                    </div>
                  </div>
                  {allUsers.length === 0 ? (
                    <div className="text-center py-12"><ShieldCheck className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا يوجد مستخدمين</p></div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {allUsers.map(u => (
                        <div key={u.id} className={`p-4 rounded-xl border ${u.isApproved ? (darkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-200/50') : (darkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50/50 border-amber-200/50')}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${u.isApproved ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                                {u.name?.charAt(0) || '?'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`font-bold truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                                  {u.isApproved ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 shrink-0">✅ مؤكد</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 shrink-0">⏳ بانتظار التأكيد</span>
                                  )}
                                  {u.isBlocked && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 shrink-0">🚫 محظور</span>}
                                </div>
                                <p className={`text-sm mt-0.5 truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>📧 {u.identifier || u.email}{u.phone ? ` • 📞 ${u.phone}` : ''}</p>
                                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>📅 {new Date(u.createdAt).toLocaleDateString('ar-EG')} • {new Date(u.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap shrink-0">
                              {u.isApproved ? (
                                <button onClick={() => handleRevokeApproval(u.id, u.name)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs hover:bg-amber-600 transition-colors flex items-center gap-1" title="إلغاء التأكيد">
                                  <RefreshCw className="h-3 w-3" /><span className="hidden sm:inline">إلغاء التأكيد</span>
                                </button>
                              ) : (
                                <button onClick={() => handleApproveUser(u.id, u.name)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs hover:bg-emerald-600 transition-colors flex items-center gap-1" title="تأكيد">
                                  <Check className="h-3 w-3" /><span className="hidden sm:inline">تأكيد</span>
                                </button>
                              )}
                              <button onClick={() => setDevMessageTo({ userId: u.id, userName: u.name })} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors flex items-center gap-1" title="تواصل">
                                <Send className="h-3 w-3" /><span className="hidden sm:inline">تواصل</span>
                              </button>
                              <button onClick={() => { setSelectedUserDetail(u); fetchUserDetail(u.id); }} className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs hover:bg-violet-600 transition-colors flex items-center gap-1" title="تفاصيل">
                                <Eye className="h-3 w-3" /><span className="hidden sm:inline">تفاصيل</span>
                              </button>
                              <button onClick={() => handleDeleteUser(u.id, u.name)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors flex items-center gap-1" title="حذف">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payments Tab */}
              {devTab === 'payments' && (
                <div className="space-y-4">
                  <div className={`grid grid-cols-3 gap-3 mb-2`}>
                    <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}><p className={`text-xl font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{payments.filter(p => p.status === 'Paid').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>مؤكدة</p></div>
                    <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-amber-900/30' : 'bg-amber-50'}`}><p className={`text-xl font-bold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>{payments.filter(p => p.status === 'Pending').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>قيد الانتظار</p></div>
                    <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-red-900/30' : 'bg-red-50'}`}><p className={`text-xl font-bold ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{payments.filter(p => p.status === 'Failed').length}</p><p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>مرفوضة</p></div>
                  </div>
                  {/* أزرار الحذف */}
                  {payments.length > 0 && (
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { if (selectedPayments.length === payments.length) setSelectedPayments([]); else setSelectedPayments(payments.map(p => p.id)); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedPayments.length === payments.length ? 'bg-violet-500 text-white' : (darkMode ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>
                          {selectedPayments.length === payments.length ? '✅ إلغاء التحديد' : '☐ تحديد الكل'}
                        </button>
                        {selectedPayments.length > 0 && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-100 text-violet-700'}`}>{selectedPayments.length} محدد</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {selectedPayments.length > 0 && (
                          <button onClick={() => handleDeletePayments(selectedPayments)} className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><Trash2 className="h-3 w-3" />حذف المحدد ({selectedPayments.length})</button>
                        )}
                        <button onClick={() => handleDeleteAllPayments()} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors flex items-center gap-1"><Trash2 className="h-3 w-3" />حذف الكل ({payments.length})</button>
                      </div>
                    </div>
                  )}
                  {payments.length === 0 ? <div className="text-center py-12"><CreditCard className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد مدفوعات</p></div> : payments.map(payment => (
                    <div key={payment.id} className={`p-4 rounded-xl transition-all ${selectedPayments.includes(payment.id) ? (darkMode ? 'bg-red-900/20 border-2 border-red-500/50' : 'bg-red-50 border-2 border-red-300') : (darkMode ? 'bg-slate-700' : 'bg-slate-50')}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <input type="checkbox" checked={selectedPayments.includes(payment.id)} onChange={(e) => { if (e.target.checked) setSelectedPayments([...selectedPayments, payment.id]); else setSelectedPayments(selectedPayments.filter(id => id !== payment.id)); }} className="mt-1 shrink-0 cursor-pointer" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{payment.amount} ج.م</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{payment.status === 'Paid' ? '✅ مدفوع' : payment.status === 'Pending' ? '⏳ قيد الانتظار' : '❌ مرفوض'}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{payment.method}</span>
                            </div>
                            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>👤 {payment.inquiry?.name || 'غير معروف'}{payment.inquiry?.phone ? ` • 📞 ${payment.inquiry.phone}` : ''}</p>
                            {payment.inquiry?.apartment && <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🏠 {payment.inquiry.apartment.title} - {payment.inquiry.apartment.price} ج.م</p>}
                            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(payment.createdAt).toLocaleString('ar-EG')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {payment.status === 'Pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleConfirmPayment(payment.id)} className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" title="تأكيد الدفع"><Check className="h-4 w-4" /></button>
                              <button onClick={() => handleRejectPayment(payment.id)} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors" title="رفض الدفع"><X className="h-4 w-4" /></button>
                              <button onClick={() => handleResendPayment(payment.id)} className="p-2 rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors" title="إعادة إرسال"><RefreshCw className="h-4 w-4" /></button>
                            </div>
                          )}
                          {(payment.status === 'Paid' || payment.status === 'Failed') && (
                            <button onClick={() => handleResendPayment(payment.id)} className="p-2 rounded-lg bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-colors" title="إعادة إرسال"><RefreshCw className="h-4 w-4" /></button>
                          )}
                          <button onClick={() => handleDeletePayments([payment.id])} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-600 transition-colors" title="حذف"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Messages Tab */}
              {devTab === 'messages' && (
                <div className="space-y-4">
                  {messages.length === 0 ? <div className="text-center py-12"><MessageCircle className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد رسائل</p></div> : messages.map(msg => (
                    <div key={msg.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${msg.senderId === currentUser?.id ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>{msg.sender?.name?.charAt(0) || 'م'}</div>
                          <div>
                            <span className={`font-medium ${msg.senderId === currentUser?.id ? (darkMode ? 'text-violet-400' : 'text-violet-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>{msg.senderId === currentUser?.id ? 'أنت' : (msg.sender?.name || 'مستخدم')}</span>
                            {msg.sender?.identifier && msg.senderId !== currentUser?.id && <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{msg.sender.identifier}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                          <button onClick={() => handleDeleteMessage(msg.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-600 transition-colors" title="حذف الرسالة"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className={`mb-3 whitespace-pre-line ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p>
                      {/* Reply input for developer - only for messages from users */}
                      {msg.sender?.id && msg.senderId !== currentUser?.id && (
                        <div className="flex gap-2 mt-2">
                          <input 
                            type="text" 
                            placeholder="اكتب رداً..." 
                            className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'} border`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                const replyContent = e.currentTarget.value.trim();
                                e.currentTarget.value = '';
                                if (msg.sender) handleDevReplyMessage(msg.sender.id, replyContent);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              if (input?.value.trim()) {
                                const replyContent = input.value.trim();
                                input.value = '';
                                if (msg.sender) handleDevReplyMessage(msg.sender.id, replyContent);
                              }
                            }}
                            className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Users Tab */}
              {devTab === 'users' && (
                <div className="space-y-4">
                  {allUsers.length === 0 ? <div className="text-center py-12"><User className={`h-16 h-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا يوجد مستخدمين</p></div> : allUsers.map(u => (
                    <div key={u.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${u.isApproved === false || u.emailVerified === false ? 'bg-amber-500' : u.isBlocked ? 'bg-red-500' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>{u.name?.charAt(0) || '?'}</div>
                            <p className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                            {u.isBlocked ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 shrink-0">🚫 محظور</span> : u.emailVerified === false ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 shrink-0">📧 بانتظار البريد</span> : u.isApproved === true ? <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 shrink-0">✅ نشط</span> : <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 shrink-0">⏳ غير مؤكد</span>}
                          </div>
                          <p className={`text-sm mt-1 truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>📧 {u.identifier || u.email}{u.phone ? ` • 📞 ${u.phone}` : ''}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>📅 تاريخ التسجيل: {new Date(u.createdAt).toLocaleDateString('ar-EG')} • {new Date(u.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap shrink-0">
                          <button onClick={() => { setSelectedUserDetail(u); fetchUserDetail(u.id); }} className="px-3 py-2 rounded-lg bg-violet-500 text-white text-xs hover:bg-violet-600 transition-colors flex items-center gap-1" title="تفاصيل المستخدم"><Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">تفاصيل</span></button>
                          <button onClick={() => setDevMessageTo({ userId: u.id, userName: u.name })} className="px-3 py-2 rounded-lg bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors flex items-center gap-1" title="تواصل مع المستخدم"><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">رسالة</span></button>
                          {u.isBlocked ? (
                            <button onClick={() => unblockUser(u.id)} className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs hover:bg-emerald-600 transition-colors">🔓 فك الحظر</button>
                          ) : (
                            <button onClick={() => blockUser(u.id, 'حظر من المطور')} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs hover:bg-amber-600 transition-colors" title="حظر المستخدم">🔒 حظر</button>
                          )}
                          {u.isApproved === false && (
                            <button onClick={() => handleApproveUser(u.id, u.name)} className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs hover:bg-emerald-600 transition-colors flex items-center gap-1"><Check className="h-3.5 w-3.5" />تأكيد</button>
                          )}
                          <button onClick={() => handleDeleteUser(u.id, u.name)} className="px-3 py-2 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600 transition-colors flex items-center gap-1" title="حذف المستخدم نهائياً"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* User Logs Tab - سجل المستخدمين */}
              {devTab === 'userLogs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>سجل تأكيد المستخدمين والمدفوعات</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setUserLogTab('all'); fetchApprovalLogs(); }} className={`px-3 py-1 rounded-lg text-xs transition-colors ${userLogTab === 'all' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : (darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')}`}>الكل</button>
                        <button onClick={() => { setUserLogTab('approved'); }} className={`px-3 py-1 rounded-lg text-xs transition-colors ${userLogTab === 'approved' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>✅ مؤكد</button>
                        <button onClick={() => { setUserLogTab('revoked'); }} className={`px-3 py-1 rounded-lg text-xs transition-colors ${userLogTab === 'revoked' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>↩️ ملغي</button>
                        <button onClick={() => { setUserLogTab('rejected'); }} className={`px-3 py-1 rounded-lg text-xs transition-colors ${userLogTab === 'rejected' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>❌ مرفوض</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => fetchApprovalLogs()} className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`} title="تحديث"><RefreshCw className="h-4 w-4" /></button>
                      <button onClick={() => handleClearApprovalLogs()} className={`p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600`} title="حذف الكل"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {approvalLogs.length === 0 ? (
                    <div className="text-center py-12"><BookOpen className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد سجلات تأكيد</p></div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {approvalLogs
                        .filter(log => userLogTab === 'all' || log.action === userLogTab)
                        .map(log => {
                          const actionConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
                            'approve': { label: 'تأكيد تسجيل', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: '✅' },
                            'revoke': { label: 'إلغاء تأكيد', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '↩️' },
                            'reject': { label: 'رفض تسجيل', color: 'text-red-700', bgColor: 'bg-red-100', icon: '❌' },
                          };
                          const config = actionConfig[log.action] || { label: log.action, color: 'text-slate-700', bgColor: 'bg-slate-100', icon: '📋' };
                          const userPaymentsCount = payments.filter(p => p.userId === log.userId).length;
                          const userExists = allUsers.some(u => u.id === log.userId);

                          return (
                            <div key={log.id} className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-700/50 border-slate-600/50' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${config.bgColor} ${config.color}`}>{config.icon} {config.label}</span>
                                  <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{log.userName}</p>
                                  {log.userEmail && <p className={`text-xs truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{log.userEmail}</p>}
                                  {userPaymentsCount > 0 && <span className={`px-1.5 py-0.5 rounded text-xs ${darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>💳 {userPaymentsCount} مدفوعات</span>}
                                  {!userExists && log.action !== 'reject' && <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">محذوف</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                                  <button onClick={() => handleDeleteApprovalLog(log.id)} className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors" title="حذف السجل"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                              {log.reason && <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>📋 {log.reason}</p>}
                              {/* Show messages for this user if expanded */}
                              <div className="flex gap-1.5 mt-2">
                                {userExists && (
                                  <button onClick={() => fetchUserMessagesForLog(log.userId)} className={`px-2 py-1 rounded text-xs ${darkMode ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} flex items-center gap-1`}>
                                    <MessageCircle className="h-3 w-3" /> عرض الرسائل
                                  </button>
                                )}
                                {userExists && log.action === 'revoke' && (
                                  <button onClick={() => handleApproveUser(log.userId, log.userName)} className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> إعادة تأكيد
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* User messages section when viewing a user's messages */}
                  {userMessagesForLog.length > 0 && (
                    <div className={`mt-4 p-4 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-slate-900'}`}>💬 رسائل المستخدم ({userMessagesForLog.length})</h4>
                        <button onClick={() => setUserMessagesForLog([])} className={`p-1 rounded ${darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}><X className="h-4 w-4" /></button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {userMessagesForLog.map(msg => (
                          <div key={msg.id} className={`p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-white'} border ${darkMode ? 'border-slate-500' : 'border-slate-200'}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${msg.senderId === currentUser?.id ? (darkMode ? 'text-violet-400' : 'text-violet-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>{msg.senderId === currentUser?.id ? 'المطور' : (msg.sender?.name || 'مستخدم')}</span>
                                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                              </div>
                              <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600" title="حذف الرسالة"><Trash2 className="h-3 w-3" /></button>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Blocked Tab */}
              {devTab === 'blocked' && (
                <div className="space-y-4">
                  {blockedUsers.length === 0 ? <div className="text-center py-12"><Ban className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا يوجد مستخدمين محظورين</p></div> : blockedUsers.map(bu => {
                    const blockedUserApartments = allApartments.filter(a => a.createdBy === bu.userId);
                    return (
                    <div key={bu.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div><p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{bu.user.name}</p><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{bu.user.identifier} • {bu.reason || 'بدون سبب'}</p></div>
                        <button onClick={() => unblockUser(bu.userId)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm">إلغاء الحظر</button>
                      </div>
                      {blockedUserApartments.length > 0 && (
                        <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>عقاراته ({blockedUserApartments.length}):</p>
                          <div className="space-y-2">{blockedUserApartments.map(apt => (
                            <div key={apt.id} className="flex items-center justify-between">
                              <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.title}</span>
                              <button onClick={() => handleDeleteApartment(apt.id)} className="text-xs text-red-500 hover:text-red-600">حذف</button>
                            </div>
                          ))}</div>
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              )}

              {/* Settings Tab */}
              {devTab === 'settings' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>💰 رسوم بيانات التواصل</label>
                      <input type="number" min="0" value={settings.contactFee} onChange={(e) => setSettings({ ...settings, contactFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>🏠 رسوم العقار العادي</label>
                      <input type="number" min="0" value={settings.regularFee} onChange={(e) => setSettings({ ...settings, regularFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>⭐ رسوم العقار المميز</label>
                      <input type="number" min="0" value={settings.featuredFee} onChange={(e) => setSettings({ ...settings, featuredFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>👑 رسوم VIP</label>
                      <input type="number" min="0" value={settings.vipFee} onChange={(e) => setSettings({ ...settings, vipFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>📋 رسوم عرض البيع</label>
                      <input type="number" min="0" value={settings.saleDisplayFee} onChange={(e) => setSettings({ ...settings, saleDisplayFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>🔑 رسوم عرض الإيجار</label>
                      <input type="number" min="0" value={settings.rentDisplayFee} onChange={(e) => setSettings({ ...settings, rentDisplayFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>✨ رسوم إبراز العقار</label>
                      <input type="number" min="0" value={settings.highlightFee} onChange={(e) => setSettings({ ...settings, highlightFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>🔝 رسوم أولوية العرض</label>
                      <input type="number" min="0" value={settings.priorityListingFee} onChange={(e) => setSettings({ ...settings, priorityListingFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>✅ رسوم التحقق من العقار</label>
                      <input type="number" min="0" value={settings.verifiedListingFee} onChange={(e) => setSettings({ ...settings, verifiedListingFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>💎 رسوم الباقة المميزة</label>
                      <input type="number" min="0" value={settings.premiumFee} onChange={(e) => setSettings({ ...settings, premiumFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>🛠️ رسوم خدمات أخرى</label>
                      <input type="number" min="0" value={settings.otherServicesFee} onChange={(e) => setSettings({ ...settings, otherServicesFee: Math.max(0, parseInt(e.target.value) || 0) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>💱 العملة</label>
                      <input type="text" maxLength={10} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value.replace(/<[^>]*>/g, '').slice(0, 10) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                    </div>
                  </div>
                  <button onClick={() => updateSettings(settings)} disabled={settingsLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">{settingsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ الإعدادات</button>
                  {/* Developer Password Change */}
                  <div className={`p-4 rounded-xl border-2 ${darkMode ? 'bg-slate-700 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Key className="h-5 w-5 text-amber-500" />تغيير كلمة مرور المطور</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input type="password" placeholder="كلمة المرور الحالية" value={devPasswordChange.current} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, current: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                      <input type="password" placeholder="كلمة المرور الجديدة" value={devPasswordChange.new} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, new: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                      <input type="password" placeholder="تأكيد كلمة المرور" value={devPasswordChange.confirm} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, confirm: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                    </div>
                    <button onClick={async () => {
                      if (!devPasswordChange.current || !devPasswordChange.new || !devPasswordChange.confirm) { addToast('جميع الحقول مطلوبة', 'error'); return; }
                      if (devPasswordChange.new !== devPasswordChange.confirm) { addToast('كلمتا المرور غير متطابقتين', 'error'); return; }
                      if (devPasswordChange.new.length < 6) { addToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }
                      try {
                        const res = await fetch('/api/auth/change-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            identifier: DEVELOPER_EMAIL,
                            currentPassword: devPasswordChange.current,
                            newPassword: devPasswordChange.new
                          })
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          addToast('تم تغيير كلمة المرور بنجاح!', 'success');
                          setDevPasswordChange({ current: '', new: '', confirm: '' });
                        } else {
                          addToast(data.error || 'كلمة المرور الحالية غير صحيحة', 'error');
                        }
                      } catch {
                        addToast('حدث خطأ في تغيير كلمة المرور', 'error');
                      }
                    }} className="mt-3 px-6 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium text-sm">تغيير كلمة المرور</button>
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Eye className="h-5 w-5 text-emerald-500" />معاينة الأسعار للمستخدمين</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className={`p-2.5 rounded-lg ${settings.contactFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>💰 تواصل: {settings.contactFee === 0 ? 'مجاني ✨' : `${settings.contactFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.regularFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>🏠 عادي: {settings.regularFee === 0 ? 'مجاني ✨' : `${settings.regularFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.featuredFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>⭐ مميز: {settings.featuredFee === 0 ? 'مجاني ✨' : `${settings.featuredFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.vipFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>👑 VIP: {settings.vipFee === 0 ? 'مجاني ✨' : `${settings.vipFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.saleDisplayFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>📋 بيع: {settings.saleDisplayFee === 0 ? 'مجاني ✨' : `${settings.saleDisplayFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.rentDisplayFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>🔑 إيجار: {settings.rentDisplayFee === 0 ? 'مجاني ✨' : `${settings.rentDisplayFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.highlightFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>✨ إبراز: {settings.highlightFee === 0 ? 'مجاني ✨' : `${settings.highlightFee} ${settings.currency}`}</div>
                      <div className={`p-2.5 rounded-lg ${settings.priorityListingFee === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : (darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700')}`}>🔝 أولوية: {settings.priorityListingFee === 0 ? 'مجاني ✨' : `${settings.priorityListingFee} ${settings.currency}`}</div>
                    </div>
                    <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>💡 الأسعار تتحدث للمستخدمين تلقائياً بدون تحديث الصفحة</p>
                  </div>
                </div>
              )}

              {/* Edit Requests Tab */}
              {devTab === 'editRequests' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>طلبات التعديل</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${editRequests.filter(e => e.status === 'pending').length > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-slate-100 text-slate-500'}`}>
                        {editRequests.filter(e => e.status === 'pending').length} قيد المراجعة
                      </span>
                    </div>
                    <button onClick={fetchEditRequests} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`} title="تحديث">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  {editRequests.length === 0 ? (
                    <div className="text-center py-16">
                      <FilePen className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                      <p className={`text-lg font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد طلبات تعديل</p>
                      <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>ستظهر طلبات تعديل العقارات هنا عند استلامها</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editRequests.map((request) => (
                        <div key={request.id} className={`rounded-xl p-4 border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                request.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {request.status === 'pending' ? '⏳ قيد المراجعة' : request.status === 'approved' ? '✅ تمت الموافقة' : '❌ مرفوض'}
                              </span>
                              {request.editType && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                  {request.editType}
                                </span>
                              )}
                            </div>
                            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {new Date(request.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-2">
                              <User className={`h-4 w-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                              <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                                {request.user?.name || 'مستخدم'}
                              </span>
                            </div>
                            {request.apartment && (
                              <div className="flex items-center gap-2">
                                <Building2 className={`h-4 w-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {request.apartment.title}
                                </span>
                              </div>
                            )}
                          </div>
                          {request.description && (
                            <p className={`text-sm mb-3 p-3 rounded-lg ${darkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                              📝 {request.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {request.newPrice != null && request.newPrice !== undefined && (
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${darkMode ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                                <DollarSign className="h-3.5 w-3.5" />
                                السعر الجديد: {request.newPrice?.toLocaleString()} ج.م
                              </div>
                            )}
                            {request.newStatus && (
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${darkMode ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                                <Activity className="h-3.5 w-3.5" />
                                الحالة الجديدة: {request.newStatus === 'active' ? 'نشط' : request.newStatus === 'rented' ? 'مؤجر' : request.newStatus === 'sold' ? 'مباع' : request.newStatus}
                              </div>
                            )}
                            {request.newImages && request.newImages.length > 0 && (
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${darkMode ? 'bg-purple-900/20 text-purple-400' : 'bg-purple-50 text-purple-700'}`}>
                                <ImageIcon className="h-3.5 w-3.5" />
                                صور جديدة: {request.newImages.length}
                              </div>
                            )}
                            {request.newVideos && request.newVideos.length > 0 && (
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${darkMode ? 'bg-pink-900/20 text-pink-400' : 'bg-pink-50 text-pink-700'}`}>
                                <Video className="h-3.5 w-3.5" />
                                فيديوهات جديدة: {request.newVideos.length}
                              </div>
                            )}
                          </div>
                          {request.status === 'pending' && (
                            <div className={`flex gap-2 pt-3 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                              <button
                                onClick={() => handleApproveEditRequest(request.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all"
                              >
                                <Check className="h-4 w-4" />
                                موافقة
                              </button>
                              <button
                                onClick={() => handleRejectEditRequest(request.id)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 transition-all"
                              >
                                <X className="h-4 w-4" />
                                رفض
                              </button>
                            </div>
                          )}
                          {request.reviewNotes && (
                            <div className={`mt-3 p-3 rounded-lg text-sm ${darkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                              💬 ملاحظات المراجعة: {request.reviewNotes}
                            </div>
                          )}
                          {request.reviewedAt && (
                            <p className={`text-xs mt-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              تمت المراجعة: {new Date(request.reviewedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Logs Tab */}
              {devTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>سجل العمليات والأحداث</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => { fetchOperationLogs(); }} className={`px-3 py-1 rounded-lg text-xs ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>الكل</button>
                        <button onClick={async () => { try { const res = await fetch('/api/logs?action=APPROVE_USER&limit=50'); const data = await res.json(); setOperationLogs(Array.isArray(data) ? data : []); } catch {} }} className="px-3 py-1 rounded-lg text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200">✅ التأكيدات</button>
                        <button onClick={async () => { try { const res = await fetch('/api/logs?action=USER_REGISTER&limit=50'); const data = await res.json(); setOperationLogs(Array.isArray(data) ? data : []); } catch {} }} className="px-3 py-1 rounded-lg text-xs bg-blue-100 text-blue-700 hover:bg-blue-200">📝 التسجيلات</button>
                        <button onClick={async () => { try { const res = await fetch('/api/logs?action=BLOCK_USER&limit=50'); const data = await res.json(); setOperationLogs(Array.isArray(data) ? data : []); } catch {} }} className="px-3 py-1 rounded-lg text-xs bg-red-100 text-red-700 hover:bg-red-200">🚫 الحظر</button>
                        <button onClick={async () => { try { const res = await fetch('/api/logs?action=REVOKE_APPROVAL&limit=50'); const data = await res.json(); setOperationLogs(Array.isArray(data) ? data : []); } catch {} }} className="px-3 py-1 rounded-lg text-xs bg-amber-100 text-amber-700 hover:bg-amber-200">↩️ إلغاء التأكيد</button>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={fetchOperationLogs} className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`} title="تحديث"><RefreshCw className="h-4 w-4" /></button>
                      <button onClick={() => handleClearAllLogs()} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600" title="حذف الكل"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {operationLogs.length === 0 ? (
                    <div className="text-center py-12"><Activity className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد عمليات مسجلة</p></div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {operationLogs.map((log: any) => {
                        const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
                          'USER_REGISTER': { label: 'تسجيل جديد', color: 'bg-blue-100 text-blue-700', icon: '📝' },
                          'DEVELOPER_AUTO_REGISTER': { label: 'تسجيل مطور', color: 'bg-violet-100 text-violet-700', icon: '👑' },
                          'APPROVE_USER': { label: 'تأكيد تسجيل', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
                          'REJECT_USER': { label: 'رفض تسجيل', color: 'bg-red-100 text-red-700', icon: '❌' },
                          'REVOKE_APPROVAL': { label: 'إلغاء تأكيد', color: 'bg-amber-100 text-amber-700', icon: '↩️' },
                          'BLOCK_USER': { label: 'حظر مستخدم', color: 'bg-red-100 text-red-700', icon: '🚫' },
                          'UNBLOCK_USER': { label: 'فك حظر', color: 'bg-emerald-100 text-emerald-700', icon: '🔓' },
                          'DELETE_USER': { label: 'حذف مستخدم', color: 'bg-red-100 text-red-700', icon: '🗑️' },
                          'DELETE_MESSAGE': { label: 'حذف رسالة', color: 'bg-amber-100 text-amber-700', icon: '💬' },
                          'UPDATE_SETTINGS': { label: 'تحديث إعدادات', color: 'bg-violet-100 text-violet-700', icon: '⚙️' },
                          'APPROVE_APARTMENT': { label: 'موافقة عقار', color: 'bg-emerald-100 text-emerald-700', icon: '🏠' },
                          'REJECT_APARTMENT': { label: 'رفض عقار', color: 'bg-red-100 text-red-700', icon: '❌' },
                        };
                        const actionInfo = actionLabels[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-700', icon: '📋' };
                        let detailText = '';
                        try { const d = JSON.parse(log.details || '{}'); detailText = d.userName || d.reason || d.identifier || d.email || (typeof d === 'string' ? d : ''); } catch { detailText = log.details || ''; }
                        return (
                          <div key={log.id} className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${actionInfo.color}`}>{actionInfo.icon} {actionInfo.label}</span>
                                {detailText && <p className={`text-sm truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{detailText}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                                <button onClick={() => handleDeleteOperationLog(log.id)} className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors" title="حذف السجل"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>{paymentApartment && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPaymentApartment(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>طلب بيانات التواصل</h2>
              <button onClick={() => setPaymentApartment(null)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <div className={`p-4 rounded-xl mb-6 ${settings.contactFee === 0 ? (darkMode ? 'bg-emerald-900/30' : 'bg-emerald-50') : (darkMode ? 'bg-slate-700' : 'bg-slate-50')}`}><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>المبلغ المطلوب:</p><p className={`text-2xl font-bold ${settings.contactFee === 0 ? 'text-emerald-500' : 'text-emerald-500'}`}>{settings.contactFee === 0 ? 'مجاني ✨' : `${settings.contactFee} ${settings.currency}`}</p></div>
            {settings.contactFee === 0 ? (
              <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-emerald-900/20 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200'}`}>
                <p className={`text-center font-medium ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>🎉 هذه الخدمة مجانية! لا حاجة للدفع</p>
              </div>
            ) : (
            <div className="space-y-3 mb-6">
              <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>اختر طريقة الدفع:</p>
              {['فودافون كاش', 'أورنج كاش', 'اتصالات كاش', 'تحويل بنكي'].map(method => (
                <button key={method} onClick={() => setPaymentMethod(method)} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${paymentMethod === method ? 'border-emerald-500 bg-emerald-50' : darkMode ? 'border-slate-600 hover:border-slate-500' : 'border-slate-200 hover:border-slate-300'}`}>{method}</button>
              ))}
            </div>
            )}
            <button onClick={() => handlePayment()} disabled={settings.contactFee !== 0 && (!paymentMethod || paymentSubmitting)} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium disabled:opacity-50">{paymentSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : settings.contactFee === 0 ? 'الحصول مجاناً ✨' : 'تأكيد الطلب'}</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Forgot Password Modal */}
      <AnimatePresence>{showForgotPassword && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForgotPassword(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>استعادة كلمة المرور</h2>
              <button onClick={() => setShowForgotPassword(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            {forgotSuccess ? (
              <div className="text-center py-4"><CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-500" /><p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>تم إرسال رابط استعادة كلمة المرور</p></div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>البريد الإلكتروني</label><input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <button type="submit" disabled={forgotLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium disabled:opacity-50">{forgotLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'إرسال رابط الاستعادة'}</button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>{showResetPassword && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowResetPassword(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>كلمة المرور الجديدة</h2>
              <button onClick={() => setShowResetPassword(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور الجديدة</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>تأكيد كلمة المرور</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <button type="submit" disabled={resetLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium disabled:opacity-50">{resetLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'تغيير كلمة المرور'}</button>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      {/* OTP Verification Modal */}
      <AnimatePresence>{showOtpVerification && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowOtpVerification(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="text-center mb-6">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gradient-to-r from-emerald-500 to-teal-600`}><Send className="h-8 w-8 text-white" /></div>
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>تأكيد البريد الإلكتروني</h3>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>تم إرسال رمز تأكيد إلى<br /><span className="font-medium text-emerald-500">{otpEmail}</span></p>
            </div>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رمز التأكيد (6 أرقام)</label>
                <input type="text" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className={`w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-[0.5em] font-mono ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required />
              </div>
              <button type="submit" disabled={otpLoading || otpCode.length !== 6} className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all">{otpLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'تأكيد'}</button>
              <button type="button" onClick={handleResendOtp} disabled={otpResendLoading} className={`w-full py-2 rounded-xl text-sm ${darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50`}>{otpResendLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'إعادة إرسال الرمز'}</button>
              <button type="button" onClick={() => { setShowOtpVerification(false); setShowAuth(true); }} className={`w-full py-2 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>تسجيل الدخول بدلاً من ذلك</button>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50">
    <div className="text-center">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/30">
        <svg className="h-12 w-12 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      </div>
      <p className="mt-8 text-lg font-medium text-slate-600">جاري التحميل...</p>
    </div>
  </div>
);

export default dynamic(() => Promise.resolve({ default: App }), { ssr: false, loading: () => <AppLoader /> });
