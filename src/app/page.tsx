'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Bed, Bath, Phone, ExternalLink, X,
  CreditCard, MessageSquare, Loader2, Eye, Lock,
  Sun, Moon, Check, AlertCircle, RefreshCw, Star,
  TrendingUp, Filter, Heart, User, MessageCircle, ThumbsUp,
  BarChart3, DollarSign, Settings, LogOut, Menu, AlertTriangle, 
  CheckCircle2, XCircle, Image as ImageIcon, Video,
  ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Hourglass,
  Send, Bot, Home, Crown, Diamond, Ban, Brain, Search,
  Play, Upload, Link, Activity, Wallet, PieChart, Layers, Key, ArrowUp,
  Download, RefreshCw as RefreshCwIcon, Smartphone, Banknote, Zap,
  Clock, Sparkles, Share2, Calendar, BookOpen, Users
} from 'lucide-react';
import { FileUpload } from '@/components/file-upload';

// Developer credentials
const DEVELOPER_EMAIL = 'ahmadmamdouh10030@gmail.com';

const CONTACT_FEE = 50;

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
  id: string; title: string; price: number; area: string; bedrooms: number; bathrooms: number;
  description: string; ownerPhone: string; mapLink: string; imageUrl?: string; images?: string[];
  videoUrl?: string; videos?: string[]; amenities?: string[]; isFeatured?: boolean; isVip?: boolean;
  type: 'rent' | 'sale'; status: string; paymentRef?: string; createdBy?: string; views?: number; createdAt: string;
}

interface Inquiry { id: string; apartmentId: string; userId?: string; name: string; email: string; phone: string; message: string; lifecycleStatus: string; createdAt: string; apartment?: { id: string; title: string; price: number; type: string } | null; payment?: { id: string; status: string; method: string } | null; }

interface Payment { id: string; inquiryId: string; method: string; status: string; amount: number; userId?: string; createdAt: string; inquiry?: { id: string; apartmentId: string; name: string; email: string; phone: string; apartment?: { id: string; title: string; price: number } | null } | null; }

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface User { id: string; identifier: string; name: string; }

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

const egyptianAreas = ['مدينة نصر', 'التجمع الخامس', 'المعادي', 'وسط البلد', 'جاردن سيتي', 'الزمالك', 'المهندسين', 'الدقي', '6 أكتوبر', 'الشيخ زايد', 'العاصمة الإدارية', 'المنصورة', 'الإسكندرية'];

// Confirm Dialog Component
function ConfirmDialog({ isOpen, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', onConfirm, onCancel, type = 'warning', loading = false, darkMode }: { isOpen: boolean; title: string; message: string; confirmText?: string; cancelText?: string; onConfirm: () => void; onCancel: () => void; type?: 'danger' | 'warning' | 'info'; loading?: boolean; darkMode: boolean; }) {
  if (!isOpen) return null;
  const icons = { danger: <Trash2 className="h-6 w-6 text-red-500" />, warning: <AlertTriangle className="h-6 w-6 text-amber-500" />, info: <AlertCircle className="h-6 w-6 text-blue-500" /> };
  const buttons = { danger: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700', warning: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700', info: 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800' };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
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

export default function App() {
  // State
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [allApartments, setAllApartments] = useState<Apartment[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'rent' | 'sale'>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [bedroomsFilter, setBedroomsFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [bathroomsFilter, setBathroomsFilter] = useState<string>('all');
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
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; identifier: string; email: string; isBlocked: boolean; blockReason?: string | null; createdAt: string }>>([]);
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
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [aptForm, setAptForm] = useState({ title: '', price: '', area: '', bedrooms: '1', bathrooms: '1', description: '', ownerPhone: '', mapLink: '', type: 'rent' as 'rent' | 'sale' });
  const [aptSubmitting, setAptSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [userPaidApartments, setUserPaidApartments] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [devPasswordChange, setDevPasswordChange] = useState({ current: '', new: '', confirm: '' });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' | 'info'; loading?: boolean; confirmText?: string; cancelText?: string; }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
  const [settings, setSettings] = useState<{ 
    contactFee: number; 
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
  const [devTab, setDevTab] = useState<'stats' | 'pending' | 'apartments' | 'favorites' | 'payments' | 'messages' | 'users' | 'blocked' | 'settings' | 'logs' | 'editRequests'>('stats');
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

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const hasPaidForApartment = useCallback((apartmentId: string) => isDeveloper || userPaidApartments.includes(apartmentId), [userPaidApartments, isDeveloper]);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.user) {
        setCurrentUser(data.user);
        if (data.user.isBlocked) setIsBlocked(true);
        if (data.user.identifier === DEVELOPER_EMAIL) setIsDeveloper(true);
      }
    });
  }, []);

  // Fetch apartments
  useEffect(() => { fetchApartments(); }, []);
  
  const fetchApartments = async (retryCount = 0) => {
    try {
      setLoading(true);
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
      if (retryCount < 3) setTimeout(() => fetchApartments(retryCount + 1), 1000 * (retryCount + 1));
      else { setApartments([]); setAllApartments([]); }
    } finally { setLoading(false); }
  };

  // Fetch user payments and pending apartments
  useEffect(() => {
    if (currentUser && !isDeveloper) { fetchUserPayments(); fetchMyPendingApartments(); }
  }, [currentUser, isDeveloper]);

  const fetchUserPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (Array.isArray(data)) {
        const paidIds = data.filter((p: Payment) => p.userId === currentUser?.id && p.status === 'Paid').map((p: Payment) => p.inquiry?.apartmentId).filter((id): id is string => Boolean(id));
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

  // Fetch developer data
  const fetchDevData = async () => {
    if (!isDeveloper) return;
    try {
      const [inqRes, payRes] = await Promise.all([fetch('/api/inquiries'), fetch('/api/payments')]);
      const [inqData, payData] = await Promise.all([inqRes.json(), payRes.json()]);
      setInquiries(Array.isArray(inqData) ? inqData : []); 
      setPayments(Array.isArray(payData) ? payData : []);
    } catch {}
  };

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) setSettings({ 
        contactFee: data.contactFee || data.settings?.contactFee || 50, 
        featuredFee: data.featuredFee || data.settings?.featuredFee || 100, 
        premiumFee: data.premiumFee || data.settings?.premiumFee || 200, 
        vipFee: data.vipFee || data.settings?.vipFee || 300,
        saleDisplayFee: data.saleDisplayFee || data.settings?.saleDisplayFee || 100,
        rentDisplayFee: data.rentDisplayFee || data.settings?.rentDisplayFee || 75,
        otherServicesFee: data.otherServicesFee || data.settings?.otherServicesFee || 50,
        highlightFee: data.highlightFee || data.settings?.highlightFee || 150,
        priorityListingFee: data.priorityListingFee || data.settings?.priorityListingFee || 200,
        verifiedListingFee: data.verifiedListingFee || data.settings?.verifiedListingFee || 250,
        currency: data.currency || data.settings?.currency || 'ج.م'
      });
    } catch {}
  };

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
        setSettings(prev => ({ ...prev, ...newSettings }));
        addToast('تم تحديث الإعدادات بنجاح', 'success');
      }
    } catch {
      addToast('حدث خطأ في تحديث الإعدادات', 'error');
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

  useEffect(() => {
    if (isDeveloper) { fetchDevData(); fetchSettings(); fetchAllLikes(); fetchAllComments(); fetchMessages(); fetchBlockedUsers(); fetchAllUsers(); fetchOperationLogs(); fetchEditRequests(); }
  }, [isDeveloper]);

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
      const res = await fetch('/api/block?all=true');
      const data = await res.json();
      const users = data.blockedUsers || data.users || data;
      setAllUsers(Array.isArray(users) ? users : []);
    } catch {}
  };

  useEffect(() => { if (currentUser) fetchUserLikes(); }, [currentUser]);

  // Load favorites from localStorage
  useEffect(() => {
    try { const saved = localStorage.getItem('manteqti_favorites'); if (saved) setFavorites(JSON.parse(saved)); } catch {}
  }, []);

  // Load remembered identifier
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('manteqti_remembered_identifier');
      const rememberMeFlag = localStorage.getItem('manteqti_remember_me');
      if (remembered && rememberMeFlag === 'true') { setAuthIdentifier(remembered); setRememberMe(true); }
    } catch {}
  }, []);

  // Load remembered dev email
  useEffect(() => {
    try {
      const devEmailSaved = localStorage.getItem('manteqti_dev_email');
      const devRemember = localStorage.getItem('manteqti_dev_remember');
      if (devEmailSaved && devRemember === 'true') { setDevEmail(devEmailSaved); setRememberMe(true); }
    } catch {}
  }, []);

  // Filter apartments
  const uniqueAreas = [...new Set(apartments.map(apt => apt.area))].filter(a => a).sort();
  const filteredApartments = apartments.filter(apt => {
    if (!isDeveloper && (apt.status === 'pending' || apt.status === 'rejected')) return false;
    if (typeFilter !== 'all' && apt.type !== typeFilter) return false;
    if (areaFilter !== 'all' && apt.area !== areaFilter) return false;
    if (bedroomsFilter !== 'all' && apt.bedrooms < parseInt(bedroomsFilter)) return false;
    if (bathroomsFilter !== 'all' && apt.bathrooms < parseInt(bathroomsFilter)) return false;
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
        setCurrentUser(data.user); setShowAuth(false);
        if (rememberMe) { localStorage.setItem('manteqti_remembered_identifier', authIdentifier.trim().toLowerCase()); localStorage.setItem('manteqti_remember_me', 'true'); }
        else { localStorage.removeItem('manteqti_remembered_identifier'); localStorage.removeItem('manteqti_remember_me'); }
        setAuthPassword('');
        addToast(`مرحباً ${data.user.name}!`, 'success');
      } else addToast(data.error || 'خطأ في تسجيل الدخول', 'error');
    } catch { addToast('حدث خطأ في الاتصال', 'error'); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: authIdentifier.trim().toLowerCase(), name: authName.trim(), password: authPassword }) });
      const data = await res.json();
      if (res.ok) { setCurrentUser(data.user); setShowAuth(false); addToast(`مرحباً ${data.user.name}!`, 'success'); }
      else addToast(data.error || 'خطأ في التسجيل', 'error');
    } catch { addToast('حدث خطأ في الاتصال', 'error'); }
    finally { setAuthLoading(false); }
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
      if (!aptForm.title || !aptForm.price || !aptForm.area || !aptForm.description || !aptForm.ownerPhone) { addToast('يرجى ملء جميع الحقول المطلوبة', 'error'); return; }
      setConfirmDialog({ isOpen: true, title: isDeveloper ? 'إضافة شقة جديدة' : 'إرسال شقة للمراجعة', message: isDeveloper ? 'هل أنت متأكد من إضافة هذه الشقة؟' : 'سيتم إرسال الشقة للمراجعة', confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleAddApartment(true), type: 'info' }); return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    setAptSubmitting(true);
    try {
      const res = await fetch('/api/apartments', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          ...aptForm, 
          price: parseInt(aptForm.price), 
          bedrooms: parseInt(aptForm.bedrooms), 
          bathrooms: parseInt(aptForm.bathrooms), 
          images: Array.isArray(imageUrls) && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null, 
          videos: Array.isArray(videoUrls) && videoUrls.length > 0 ? JSON.stringify(videoUrls) : null, 
          createdBy: currentUser?.id, 
          status: isDeveloper ? 'available' : 'pending' 
        }) 
      });
      const data = await res.json();
      if (res.ok) { 
        fetchApartments(); 
        setShowAddModal(false); 
        setAptForm({ title: '', price: '', area: '', bedrooms: '1', bathrooms: '1', description: '', ownerPhone: '', mapLink: '', type: 'rent' }); 
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
    try { await fetch(`/api/apartments/${editApartment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editApartment) }); fetchApartments(); setEditApartment(null); addToast('تم تحديث الشقة', 'success'); }
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
    if (!paymentApartment || !paymentMethod) return;
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'تأكيد الدفع', message: `هل تريد الدفع بمبلغ ${CONTACT_FEE} ج.م؟`, confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handlePayment(true), type: 'info' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    setPaymentSubmitting(true);
    try {
      const inqRes = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apartmentId: paymentApartment.id, userId: currentUser?.id, name: currentUser?.name || 'زائر', email: currentUser?.identifier || 'guest@example.com', phone: 'N/A', message: 'طلب بيانات تواصل' }) });
      const inquiry = await inqRes.json();
      await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inquiryId: inquiry.id, method: paymentMethod, status: 'Pending', amount: CONTACT_FEE, userId: currentUser?.id }) });
      setPaymentApartment(null); setPaymentMethod('');
      addToast('تم إرسال طلب الدفع!', 'success');
    } finally { setPaymentSubmitting(false); setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' }); }
  };

  const handleConfirmPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) { setConfirmDialog({ isOpen: true, title: 'تأكيد الدفع', message: 'هل أنت متأكد؟', confirmText: 'تأكيد', cancelText: 'إلغاء', onConfirm: () => handleConfirmPayment(paymentId, true), type: 'info' }); return; }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try { await fetch(`/api/payments/${paymentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Paid' }) }); fetchDevData(); addToast('تم تأكيد الدفع', 'success'); }
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
        body: JSON.stringify({ sessionId: 'developer-' + Date.now(), message: prompt })
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
${aptForm.bedrooms} غرف نوم، ${aptForm.bathrooms} حمام.
عقار مميز في موقع استراتيجي، قريب من جميع الخدمات والمرافق.`;
        setAptForm({ ...aptForm, description: fallbackDesc });
        addToast('تم إنشاء وصف افتراضي', 'success');
      }
    } catch {
      // Fallback on error
      const fallbackDesc = `${aptForm.title} - ${aptForm.type === 'rent' ? 'للإيجار' : 'للبيع'} في ${aptForm.area}.
${aptForm.bedrooms} غرف نوم، ${aptForm.bathrooms} حمام.
عقار مميز في موقع استراتيجي، قريب من جميع الخدمات والمرافق.`;
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
      setFavorites(prev => {
        const newFavorites = prev.includes(apartmentId) ? prev.filter(f => f !== apartmentId) : [...prev, apartmentId];
        localStorage.setItem('manteqti_favorites', JSON.stringify(newFavorites));
        addToast(newFavorites.includes(apartmentId) ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة من المفضلة', newFavorites.includes(apartmentId) ? 'success' : 'info');
        return newFavorites;
      });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-slate-100 p-4" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="h-8 w-8 text-rose-500" /></div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">حدث خطأ</h2>
        <p className="text-slate-500 mb-8">{error}</p>
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
                    <img src={apartment.imageUrl || apartment.images?.[0] || '/generated-images/apt1.png'} alt={apartment.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-3 right-3 flex gap-2 flex-wrap">
                      {apartment.isVip && <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs font-medium flex items-center gap-1"><Diamond className="h-3 w-3" /> VIP</span>}
                      {apartment.isFeatured && !apartment.isVip && <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-medium flex items-center gap-1"><Star className="h-3 w-3" /> مميز</span>}
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
                          <Bed className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.bedrooms || '-'} غرف</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bath className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.bathrooms || '-'} حمام</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-violet-500" />
                          <span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{apartment.type === 'rent' ? 'إيجار' : 'بيع'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button onClick={() => { setSelectedApartment(apartment); fetchComments(apartment.id); setCurrentImageIndex(0); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden">
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

      {/* Toasts */}
      <div className="fixed top-4 left-4 z-50 space-y-2">
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setShowMobileMenu(false)}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className={`absolute left-0 top-0 bottom-0 w-80 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>القائمة</h2>
                <button onClick={() => setShowMobileMenu(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setShowAddModal(true); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white"><Building2 className="h-5 w-5" />إضافة شقة</button>
                <button onClick={() => { setShowChat(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><Brain className="h-5 w-5" />المساعد الذكي</button>
                {isDeveloper ? (
                  <>
        <button onClick={() => { setShowDevPanel(true); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white"><ShieldCheck className="h-5 w-5" />لوحة المطور{pendingApartments.length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-white/20 text-xs">{pendingApartments.length}</span>}</button>
    <button onClick={() => { setShowMessages(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'} relative`}><MessageCircle className="h-5 w-5" />الرسائل{messages.filter(m => !m.isRead).length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-red-500 text-white text-xs">{messages.filter(m => !m.isRead).length}</span>}</button>
    <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-red-400' : 'bg-slate-100 text-red-500'}`}><LogOut className="h-5 w-5" />تسجيل الخروج</button>
  </>
) : currentUser ? (
  <>
    <button onClick={() => { fetchMyPendingApartments(); setShowMyPending(true); setShowMobileMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}><User className="h-5 w-5" />حسابي{myPendingApartments.length > 0 && <span className="mr-auto px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{myPendingApartments.length}</span>}</button>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMyPending(false)}>
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
                      <img src={apt.imageUrl || apt.images?.[0] || '/generated-images/apt1.png'} alt={apt.title} className="w-24 h-20 object-cover rounded-lg" />
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

      {/* Messages Modal */}
      <AnimatePresence>{showMessages && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowMessages(false)}>
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
              {messages.length === 0 ? <div className="text-center py-8"><MessageCircle className={`h-12 w-12 mx-auto mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد رسائل</p></div> : messages.map(msg => (
                <div key={msg.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                  {isDeveloper && msg.sender && <div className="flex items-center justify-between mb-2"><span className={`text-sm font-medium ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>{msg.sender.name} ({msg.sender.identifier})</span><span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span></div>}
                  <p className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{msg.content}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>{showAuth && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAuth(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{authStep === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
              <button onClick={() => setShowAuth(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={authStep === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {authStep === 'register' && <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الاسم</label><input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>}
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>البريد الإلكتروني أو رقم الهاتف</label><input type="text" value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور</label><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded" /><label htmlFor="rememberMe" className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>تذكرني</label></div>
              <button type="submit" disabled={authLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium disabled:opacity-50">{authLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : authStep === 'login' ? 'دخول' : 'تسجيل'}</button>
            </form>
            <div className="mt-4 text-center"><button onClick={() => setAuthStep(authStep === 'login' ? 'register' : 'login')} className={`text-sm ${darkMode ? 'text-violet-400' : 'text-violet-600'} hover:underline`}>{authStep === 'login' ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل دخولك'}</button></div>
            {authStep === 'login' && <div className="mt-2 text-center"><button onClick={() => { setShowAuth(false); setShowForgotPassword(true); }} className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'} hover:underline`}>نسيت كلمة المرور؟</button></div>}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Developer Login Modal */}
      <AnimatePresence>{showDevLogin && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDevLogin(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Lock className="h-6 w-6 text-amber-500" />دخول المطور</h2>
              <button onClick={() => setShowDevLogin(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={handleDevLogin} className="space-y-4">
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>البريد الإلكتروني</label><input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور</label><input type="password" value={devPassword} onChange={(e) => setDevPassword(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="devRememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded" /><label htmlFor="devRememberMe" className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>تذكرني</label></div>
              <button type="submit" disabled={devLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium disabled:opacity-50">{devLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'دخول'}</button>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Add Apartment Modal */}
      <AnimatePresence>{showAddModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>إضافة شقة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleAddApartment(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عنوان الشقة *</label><input type="text" value={aptForm.title} onChange={(e) => setAptForm({ ...aptForm, title: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر *</label><input type="number" value={aptForm.price} onChange={(e) => setAptForm({ ...aptForm, price: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة *</label><select value={aptForm.area} onChange={(e) => setAptForm({ ...aptForm, area: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} required><option value="">اختر المنطقة</option>{egyptianAreas.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>غرف النوم</label><select value={aptForm.bedrooms} onChange={(e) => setAptForm({ ...aptForm, bedrooms: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الحمامات</label><select value={aptForm.bathrooms} onChange={(e) => setAptForm({ ...aptForm, bathrooms: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>النوع</label><select value={aptForm.type} onChange={(e) => setAptForm({ ...aptForm, type: e.target.value as 'rent' | 'sale' })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}><option value="rent">إيجار</option><option value="sale">بيع</option></select></div>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setSelectedApartment(null); setCurrentImageIndex(0); }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="relative h-72 md:h-96">
              <img src={selectedApartment.images?.[currentImageIndex] || selectedApartment.imageUrl || '/generated-images/apt1.png'} alt={selectedApartment.title} className="w-full h-full object-cover" />
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
                <div className="flex items-center gap-1"><Bed className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.bedrooms} غرف</span></div>
                <div className="flex items-center gap-1"><Bath className="h-5 w-5 text-violet-500" /><span className={darkMode ? 'text-slate-300' : 'text-slate-600'}>{selectedApartment.bathrooms} حمام</span></div>
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
                      <p className={`text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>ادفع {CONTACT_FEE} ج.م للحصول على بيانات التواصل</p>
                    </div>
                  </div>
                  <button onClick={() => setPaymentApartment(selectedApartment)} className="mt-3 w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium"><CreditCard className="h-4 w-4 inline ml-2" />طلب بيانات التواصل</button>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditApartment(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>تعديل الشقة</h2>
              <button onClick={() => setEditApartment(null)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <form onSubmit={handleEditApartment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>العنوان</label><input type="text" value={editApartment.title} onChange={(e) => setEditApartment({ ...editApartment, title: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر</label><input type="number" value={editApartment.price} onChange={(e) => setEditApartment({ ...editApartment, price: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة</label><select value={editApartment.area} onChange={(e) => setEditApartment({ ...editApartment, area: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{egyptianAreas.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>غرف النوم</label><select value={editApartment.bedrooms} onChange={(e) => setEditApartment({ ...editApartment, bedrooms: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الحمامات</label><select value={editApartment.bathrooms} onChange={(e) => setEditApartment({ ...editApartment, bathrooms: parseInt(e.target.value) })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowChat(false); setChatMessages([]); }}>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDevPanel(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl flex flex-col`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><ShieldCheck className="h-6 w-6 text-amber-500" />لوحة تحكم المطور</h2>
                <button onClick={() => setShowDevPanel(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
              </div>
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {[ { id: 'stats', icon: BarChart3, label: 'الإحصائيات' }, { id: 'pending', icon: Hourglass, label: 'قيد المراجعة', count: pendingApartments.length }, { id: 'apartments', icon: Building2, label: 'العقارات', count: allApartments.length }, { id: 'favorites', icon: Heart, label: 'المفضلة', count: likes.length }, { id: 'payments', icon: CreditCard, label: 'المدفوعات', count: payments.length }, { id: 'messages', icon: MessageCircle, label: 'الرسائل' }, { id: 'users', icon: User, label: 'المستخدمين', count: allUsers.length }, { id: 'blocked', icon: Ban, label: 'محظورين' }, { id: 'settings', icon: Settings, label: 'الإعدادات' } ].map(tab => (
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
                        <img src={apt.imageUrl || apt.images?.[0] || '/generated-images/apt1.png'} alt={apt.title} className="w-32 h-24 object-cover rounded-lg" />
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
                          <img src={apt.imageUrl || apt.images?.[0] || '/generated-images/apt1.png'} alt={apt.title} className="w-16 h-12 object-cover rounded" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</h3>
                              {apt.isVip && <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-purple-500 to-pink-600 text-white">VIP+</span>}
                              {apt.isFeatured && !apt.isVip && <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-amber-500 to-orange-600 text-white">مميز</span>}
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

              {/* Payments Tab */}
              {devTab === 'payments' && (
                <div className="space-y-4">
                  {payments.length === 0 ? <div className="text-center py-12"><CreditCard className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا توجد مدفوعات</p></div> : payments.map(payment => (
                    <div key={payment.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <div><p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{payment.amount} ج.م - {payment.method}</p><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{payment.inquiry?.name} • {new Date(payment.createdAt).toLocaleDateString('ar-EG')}</p></div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{payment.status === 'Paid' ? 'مدفوع' : payment.status === 'Pending' ? 'قيد الانتظار' : 'مرفوض'}</span>
                          {payment.status === 'Pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleConfirmPayment(payment.id)} className="p-1 rounded bg-emerald-500 text-white"><Check className="h-4 w-4" /></button>
                              <button onClick={() => { }} className="p-1 rounded bg-red-500 text-white"><X className="h-4 w-4" /></button>
                            </div>
                          )}
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
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">{msg.sender?.name?.charAt(0) || 'م'}</div>
                          <div>
                            <span className={`font-medium ${darkMode ? 'text-violet-400' : 'text-violet-600'}`}>{msg.sender?.name || 'مستخدم'}</span>
                            {msg.sender?.identifier && <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{msg.sender.identifier}</p>}
                          </div>
                        </div>
                        <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(msg.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                      <p className={`mb-3 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{msg.content}</p>
                      {/* Reply input for developer */}
                      <div className="flex gap-2 mt-2">
                        <input 
                          type="text" 
                          placeholder="اكتب رداً..." 
                          className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'} border`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              // Send reply logic
                              addToast('تم إرسال الرد!', 'success');
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            if (input?.value.trim()) {
                              addToast('تم إرسال الرد!', 'success');
                              input.value = '';
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Users Tab */}
              {devTab === 'users' && (
                <div className="space-y-4">
                  {allUsers.length === 0 ? <div className="text-center py-12"><User className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} /><p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>لا يوجد مستخدمين</p></div> : allUsers.map(u => (
                    <div key={u.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'} flex items-center justify-between`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{u.name}</p>
                          {u.isBlocked && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">محظور</span>}
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{u.identifier || u.email}</p>
                      </div>
                      <div className="flex gap-2">
                        {u.isBlocked ? (
                          <button onClick={() => unblockUser(u.id)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm">إلغاء الحظر</button>
                        ) : (
                          <button onClick={() => blockUser(u.id, 'حظر من المطور')} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm">حظر</button>
                        )}
                      </div>
                    </div>
                  ))}
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
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رسوم بيانات التواصل (ج.م)</label><input type="number" value={settings.contactFee} onChange={(e) => setSettings({ ...settings, contactFee: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رسوم العقار المميز (ج.م)</label><input type="number" value={settings.featuredFee} onChange={(e) => setSettings({ ...settings, featuredFee: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رسوم العقار المميز+ VIP (ج.م)</label><input type="number" value={settings.vipFee} onChange={(e) => setSettings({ ...settings, vipFee: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رسوم عرض البيع (ج.م)</label><input type="number" value={settings.saleDisplayFee} onChange={(e) => setSettings({ ...settings, saleDisplayFee: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رسوم عرض الإيجار (ج.م)</label><input type="number" value={settings.rentDisplayFee} onChange={(e) => setSettings({ ...settings, rentDisplayFee: parseInt(e.target.value) || 0 })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                    <div><label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>العملة</label><input type="text" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'}`} /></div>
                  </div>
                  {/* Developer Password Change */}
                  <div className={`p-4 rounded-xl border-2 ${darkMode ? 'bg-slate-700 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                    <h3 className={`font-bold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}><Key className="h-5 w-5 text-amber-500" />تغيير كلمة مرور المطور</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input type="password" placeholder="كلمة المرور الحالية" value={devPasswordChange.current} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, current: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                      <input type="password" placeholder="كلمة المرور الجديدة" value={devPasswordChange.new} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, new: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                      <input type="password" placeholder="تأكيد كلمة المرور" value={devPasswordChange.confirm} onChange={(e) => setDevPasswordChange({ ...devPasswordChange, confirm: e.target.value })} className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 placeholder-slate-400'}`} />
                    </div>
                    <button onClick={async () => {
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
                    }} className="mt-3 px-6 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium text-sm">تغيير كلمة المرور</button>
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                    <h3 className={`font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>معاينة الأسعار للمستخدمين</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {settings.contactFee === 0 ? <div className={`p-2 rounded-lg bg-emerald-100 text-emerald-700`}>بيانات التواصل: مجاني ✨</div> : <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700'}`}>بيانات التواصل: {settings.contactFee} {settings.currency}</div>}
                      {settings.featuredFee === 0 ? <div className={`p-2 rounded-lg bg-emerald-100 text-emerald-700`}>مميز: مجاني ✨</div> : <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700'}`}>مميز: {settings.featuredFee} {settings.currency}</div>}
                      {settings.vipFee === 0 ? <div className={`p-2 rounded-lg bg-emerald-100 text-emerald-700`}>VIP+: مجاني ✨</div> : <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-600 text-white' : 'bg-white text-slate-700'}`}>VIP+: {settings.vipFee} {settings.currency}</div>}
                    </div>
                  </div>
                  <button onClick={async () => { await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); addToast('تم حفظ الإعدادات', 'success'); }} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium">حفظ الإعدادات</button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>{paymentApartment && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPaymentApartment(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>طلب بيانات التواصل</h2>
              <button onClick={() => setPaymentApartment(null)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}><X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} /></button>
            </div>
            <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}><p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>المبلغ المطلوب:</p><p className="text-2xl font-bold text-emerald-500">{CONTACT_FEE} ج.م</p></div>
            <div className="space-y-3 mb-6">
              <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>اختر طريقة الدفع:</p>
              {['فودافون كاش', 'أورنج كاش', 'اتصالات كاش', 'تحويل بنكي'].map(method => (
                <button key={method} onClick={() => setPaymentMethod(method)} className={`w-full p-4 rounded-xl border-2 text-right transition-all ${paymentMethod === method ? 'border-emerald-500 bg-emerald-50' : darkMode ? 'border-slate-600 hover:border-slate-500' : 'border-slate-200 hover:border-slate-300'}`}>{method}</button>
              ))}
            </div>
            <button onClick={() => handlePayment()} disabled={!paymentMethod || paymentSubmitting} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium disabled:opacity-50">{paymentSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'تأكيد الطلب'}</button>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Forgot Password Modal */}
      <AnimatePresence>{showForgotPassword && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForgotPassword(false)}>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowResetPassword(false)}>
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
    </div>
  );
}
