'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, MapPin, Bed, Bath, Phone, ExternalLink, X,
  CreditCard, MessageSquare, Loader2, Eye, Lock,
  Smartphone, Banknote, Trash2, ShieldCheck, Zap,
  Clock, Sparkles, Send, Bot, Home, Search,
  Moon, Sun, Check, AlertCircle, RefreshCw, Star,
  TrendingUp, Filter, ChevronDown, Heart, Share2,
  Calendar, User, MessageCircle, ThumbsUp, Brain,
  BarChart3, DollarSign, BookOpen, Settings, LogOut,
  Menu, AlertTriangle, CheckCircle2, XCircle, Image as ImageIcon, Video,
  ChevronLeft, ChevronRight, Play, Hourglass, Plus, Upload, Link,
  Users, Activity, Wallet, PieChart, Layers, Key, ArrowUp, Download, RefreshCw as RefreshCwIcon
} from 'lucide-react';

// Developer credentials
const DEVELOPER_EMAIL = 'ahmadmamdouh10030@gmail.com';
const DEVELOPER_PASSWORD = 'admin123';

// Payment fee to view contact info
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
  'rejected': { label: 'مرفوض', color: 'text-red-700', bgColor: 'bg-red-200', dotColor: 'bg-red-500' }
};

// Interfaces
interface Apartment {
  id: string;
  title: string;
  price: number;
  area: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  ownerPhone: string;
  mapLink: string;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  amenities?: string[];
  featured?: boolean;
  type: 'rent' | 'sale';
  status: string;
  paymentRef?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  views?: number;
  createdAt: string;
}

interface Inquiry {
  id: string;
  apartmentId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  lifecycleStatus: string;
  createdAt: string;
  apartment?: { id: string; title: string; price: number; type: string; } | null;
  payment?: { id: string; status: string; method: string; } | null;
}

interface Payment {
  id: string;
  inquiryId: string;
  method: string;
  status: string;
  inquiryStatus: string;
  amount: number;
  transactionRef?: string;
  userId?: string;
  createdAt: string;
  inquiry?: {
    id: string;
    apartmentId: string;
    name: string;
    email: string;
    phone: string;
    message: string;
    apartment?: { id: string; title: string; price: number; } | null;
  } | null;
}

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface User { id: string; identifier: string; name: string; }

// Confirm Dialog Component
function ConfirmDialog({
  isOpen, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء',
  onConfirm, onCancel, type = 'warning', loading = false, darkMode
}: {
  isOpen: boolean; title: string; message: string; confirmText?: string; cancelText?: string;
  onConfirm: () => void; onCancel: () => void; type?: 'danger' | 'warning' | 'info'; loading?: boolean; darkMode: boolean;
}) {
  if (!isOpen) return null;
  const typeStyles = {
    danger: { icon: <Trash2 className="h-6 w-6 text-red-500" />, button: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700' },
    warning: { icon: <AlertTriangle className="h-6 w-6 text-amber-500" />, button: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' },
    info: { icon: <AlertCircle className="h-6 w-6 text-blue-500" />, button: 'bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800' }
  };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
          <div className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
              {typeStyles[type].icon}
            </div>
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{message}</p>
            <div className="flex gap-3">
              <button onClick={onCancel} disabled={loading}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {cancelText}
              </button>
              <button onClick={onConfirm} disabled={loading}
                className={`flex-1 py-3 rounded-xl font-medium text-white transition-all ${typeStyles[type].button} disabled:opacity-50`}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : confirmText}
              </button>
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
  const [allApartments, setAllApartments] = useState<Apartment[]>([]); // For developer
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);

  // Modal states
  const [showAuth, setShowAuth] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [editApartment, setEditApartment] = useState<Apartment | null>(null);
  const [inquiryApartment, setInquiryApartment] = useState<Apartment | null>(null);
  const [paymentApartment, setPaymentApartment] = useState<Apartment | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form states
  const [authStep, setAuthStep] = useState<'login' | 'register'>('login');
  const [authIdentifier, setAuthIdentifier] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  // Apartment form
  const [aptForm, setAptForm] = useState({
    title: '', price: '', area: '', bedrooms: '1', bathrooms: '1',
    description: '', ownerPhone: '', mapLink: '', type: 'rent' as 'rent' | 'sale',
    images: '' as string, videoUrl: ''
  });
  const [aptSubmitting, setAptSubmitting] = useState(false);
  
  // Image and video management
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  // Other states
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [userPaidApartments, setUserPaidApartments] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning' | 'info'; loading?: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [settings, setSettings] = useState({ contactFee: 50, featuredFee: 100, premiumFee: 200, currency: 'ج.م' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [operationLogs, setOperationLogs] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [devTab, setDevTab] = useState<'stats' | 'pending' | 'apartments' | 'payments' | 'settings' | 'logs'>('stats');

  // Add toast notification
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Check if user has paid for apartment (only confirmed payments)
  const hasPaidForApartment = useCallback((apartmentId: string) => {
    // Developer always has access
    if (isDeveloper) return true;
    // Check if there's a confirmed payment for this apartment
    return userPaidApartments.includes(apartmentId);
  }, [userPaidApartments, isDeveloper]);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user);
          if (data.user.identifier === DEVELOPER_EMAIL) {
            setIsDeveloper(true);
          }
        }
      });
  }, []);

  // Fetch apartments
  useEffect(() => {
    fetchApartments();
  }, []);

  const fetchApartments = async () => {
    try {
      const res = await fetch('/api/apartments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setApartments(data);
      setAllApartments(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Fetch payments for current user
  useEffect(() => {
    if (currentUser && !isDeveloper) {
      fetchUserPayments();
    }
  }, [currentUser, isDeveloper]);

  const fetchUserPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      const paidApartmentIds = data
        .filter((p: Payment) => p.userId === currentUser?.id && p.status === 'Paid')
        .map((p: Payment) => p.inquiry?.apartmentId)
        .filter(Boolean);
      setUserPaidApartments(paidApartmentIds);
    } catch (err) {
      console.error('Error fetching user payments:', err);
    }
  };

  // Fetch developer data
  const fetchDevData = async () => {
    if (!isDeveloper) return;
    try {
      const [inqRes, payRes] = await Promise.all([
        fetch('/api/inquiries'),
        fetch('/api/payments')
      ]);
      const [inqData, payData] = await Promise.all([inqRes.json(), payRes.json()]);
      setInquiries(inqData);
      setPayments(payData);
    } catch (err) {
      console.error('Error fetching dev data:', err);
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings({
          contactFee: data.contactFee || 50,
          featuredFee: data.featuredFee || 100,
          premiumFee: data.premiumFee || 200,
          currency: data.currency || 'ج.م'
        });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
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
        setSettings({ contactFee: data.contactFee, featuredFee: data.featuredFee, premiumFee: data.premiumFee, currency: data.currency });
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
      setOperationLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  useEffect(() => {
    if (isDeveloper) {
      fetchDevData();
      fetchSettings();
      fetchOperationLogs();
    }
  }, [isDeveloper]);

  // Get unique areas from apartments
  const uniqueAreas = [...new Set(apartments.map(apt => apt.area))].sort();

  // Filter apartments - regular users only see approved apartments
  const filteredApartments = apartments.filter(apt => {
    // Regular users only see approved apartments
    if (!isDeveloper && apt.status === 'pending') return false;
    if (!isDeveloper && apt.status === 'rejected') return false;
    
    if (typeFilter !== 'all' && apt.type !== typeFilter) return false;
    if (areaFilter !== 'all' && apt.area !== areaFilter) return false;
    if (bedroomsFilter !== 'all') {
      const minBedrooms = parseInt(bedroomsFilter);
      if (apt.bedrooms < minBedrooms) return false;
    }
    if (priceFilter !== 'all') {
      const maxPrice = parseInt(priceFilter);
      if (apt.price > maxPrice) return false;
    }
    if (searchQuery && !apt.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !apt.area.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Pending apartments for developer
  const pendingApartments = allApartments.filter(apt => apt.status === 'pending');

  // Handle developer login
  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevLoading(true);
    if (devEmail === DEVELOPER_EMAIL && devPassword === DEVELOPER_PASSWORD) {
      setIsDeveloper(true);
      setShowDevLogin(false);
      setDevEmail('');
      setDevPassword('');
      addToast('مرحباً بك في لوحة تحكم المطور!', 'success');
      fetchDevData();
    } else {
      addToast('بيانات الدخول غير صحيحة', 'error');
    }
    setDevLoading(false);
  };

  // Handle user login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: authIdentifier, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        setShowAuth(false);
        setAuthIdentifier('');
        setAuthPassword('');
        addToast(`مرحباً ${data.user.name}!`, 'success');
      } else {
        addToast(data.error || 'خطأ في تسجيل الدخول', 'error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle user registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: authIdentifier, name: authName, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        setShowAuth(false);
        setAuthIdentifier('');
        setAuthPassword('');
        setAuthName('');
        addToast(`مرحباً ${data.user.name}! تم التسجيل بنجاح`, 'success');
      } else {
        addToast(data.error || 'خطأ في التسجيل', 'error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setCurrentUser(null);
    setIsDeveloper(false);
    addToast('تم تسجيل الخروج', 'info');
  };

  // Submit apartment after login
  const submitApartment = async (data: any, userId?: string) => {
    setAptSubmitting(true);
    try {
      const res = await fetch('/api/apartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          images: JSON.stringify(imageUrls),
          videos: JSON.stringify(videoUrls),
          videoUrl: videoUrls[0] || null,
          createdBy: userId || currentUser?.id
        })
      });
      if (res.ok) {
        await fetchApartments();
        setShowAddModal(false);
        setAptForm({ title: '', price: '', area: '', bedrooms: '1', bathrooms: '1', description: '', ownerPhone: '', mapLink: '', type: 'rent', images: '', videoUrl: '' });
        setImageUrls([]);
        setVideoUrls([]);
        addToast('تم إضافة الشقة بنجاح!', 'success');
      }
    } finally {
      setAptSubmitting(false);
    }
  };

  // Handle add apartment - Developer Only
  const handleAddApartment = async (confirmed: boolean = false) => {
    if (!isDeveloper) {
      addToast('فقط المطور يمكنه إضافة عقارات', 'error');
      return;
    }

    if (!confirmed) {
      // Validate form first
      if (!aptForm.title || !aptForm.price || !aptForm.area || !aptForm.description || !aptForm.ownerPhone) {
        addToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }
      setConfirmDialog({
        isOpen: true,
        title: 'إضافة شقة جديدة',
        message: 'هل أنت متأكد من إضافة هذه الشقة؟',
        onConfirm: () => handleAddApartment(true),
        type: 'info'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));

    // Submit the apartment
    await submitApartment(aptForm);
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
  };

  // Handle approve apartment (developer only)
  const handleApproveApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true,
        title: 'الموافقة على الشقة',
        message: 'هل أنت متأكد من الموافقة على نشر هذه الشقة؟',
        onConfirm: () => handleApproveApartment(id, true),
        type: 'info'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvedBy: 'developer' })
      });
      if (res.ok) {
        await fetchApartments();
        addToast('تمت الموافقة على الشقة ونشرها', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle reject apartment (developer only)
  const handleRejectApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true,
        title: 'رفض الشقة',
        message: 'هل أنت متأكد من رفض هذه الشقة؟',
        onConfirm: () => handleRejectApartment(id, true),
        type: 'danger'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });
      if (res.ok) {
        await fetchApartments();
        addToast('تم رفض الشقة', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle delete apartment (developer only)
  const handleDeleteApartment = async (id: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true,
        title: 'حذف الشقة',
        message: 'هل أنت متأكد من حذف هذه الشقة؟ لا يمكن التراجع عن هذا الإجراء.',
        onConfirm: () => handleDeleteApartment(id, true),
        type: 'danger'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/apartments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchApartments();
        setSelectedApartment(null);
        setEditApartment(null);
        addToast('تم حذف الشقة بنجاح', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle edit apartment (developer only)
  const handleEditApartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editApartment) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/apartments/${editApartment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editApartment.title,
          price: editApartment.price,
          area: editApartment.area,
          bedrooms: editApartment.bedrooms,
          bathrooms: editApartment.bathrooms,
          description: editApartment.description,
          ownerPhone: editApartment.ownerPhone,
          mapLink: editApartment.mapLink,
          type: editApartment.type,
          images: editApartment.images,
          videoUrl: editApartment.videoUrl
        })
      });
      if (res.ok) {
        await fetchApartments();
        setEditApartment(null);
        addToast('تم تحديث الشقة بنجاح', 'success');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle update status (developer only)
  const handleUpdateStatus = async (id: string, newStatus: string, confirmed: boolean = false) => {
    // Final statuses that trigger auto-delete after 48 hours
    const finalStatuses = ['sold', 'unavailable', 'rented'];
    
    if (!confirmed) {
      const statusLabels: Record<string, string> = {
        'available': 'متاح', 'preview': 'في معاينة', 'reserved': 'محجوز',
        'unavailable': 'غير متاح', 'sold': 'تم البيع', 'rented': 'تم التأجير'
      };
      
      // Add warning for final statuses
      const isFinalStatus = finalStatuses.includes(newStatus);
      const warningMessage = isFinalStatus 
        ? `هل تريد تغيير الحالة إلى "${statusLabels[newStatus]}"؟\n\n⚠️ تنبيه: سيتم حذف العقار تلقائياً بعد 48 ساعة من هذا التغيير!`
        : `هل تريد تغيير الحالة إلى "${statusLabels[newStatus]}"؟`;
      
      setConfirmDialog({
        isOpen: true,
        title: 'تغيير حالة العقار',
        message: warningMessage,
        onConfirm: () => handleUpdateStatus(id, newStatus, true),
        type: isFinalStatus ? 'danger' : 'warning'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/apartments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchApartments();
        const isFinalStatus = finalStatuses.includes(newStatus);
        addToast(isFinalStatus ? 'تم تغيير الحالة - سيُحذف العقار بعد 48 ساعة' : 'تم تغيير حالة العقار', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle add inquiry
  const handleAddInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryApartment) return;
    setInquirySubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartmentId: inquiryApartment.id, userId: currentUser?.id, ...inquiryForm })
      });
      if (res.ok) {
        setInquiryApartment(null);
        setInquiryForm({ name: '', email: '', phone: '', message: '' });
        addToast('تم إرسال استفسارك بنجاح!', 'success');
      }
    } finally {
      setInquirySubmitting(false);
    }
  };

  // Handle payment
  const handlePayment = async (confirmed: boolean = false) => {
    if (!paymentApartment || !paymentMethod) return;

    if (!confirmed) {
      setConfirmDialog({
        isOpen: true,
        title: 'تأكيد الدفع',
        message: `هل تريد الدفع بمبلغ ${CONTACT_FEE} ج.م للحصول على بيانات التواصل؟`,
        onConfirm: () => handlePayment(true),
        type: 'info'
      });
      return;
    }

    setConfirmDialog(prev => ({ ...prev, loading: true }));
    setPaymentSubmitting(true);

    try {
      const inqRes = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartmentId: paymentApartment.id, userId: currentUser?.id,
          name: currentUser?.name || 'زائر', email: currentUser?.identifier || 'guest@example.com',
          phone: 'N/A', message: 'طلب بيانات تواصل'
        })
      });
      const inquiry = await inqRes.json();

      const payRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: inquiry.id, method: paymentMethod, status: 'Pending',
          amount: CONTACT_FEE, userId: currentUser?.id
        })
      });

      if (payRes.ok) {
        setPaymentApartment(null);
        setPaymentMethod('');
        addToast('تم إرسال طلب الدفع بنجاح! سيتم تأكيده من المطور.', 'success');
      }
    } finally {
      setPaymentSubmitting(false);
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle confirm payment (developer)
  const handleConfirmPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: 'تأكيد الدفع', message: 'هل أنت متأكد من تأكيد هذا الدفع؟',
        onConfirm: () => handleConfirmPayment(paymentId, true), type: 'info'
      });
      return;
    }
    setConfirmDialog(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      if (res.ok) {
        fetchDevData();
        addToast('تم تأكيد الدفع', 'success');
      }
    } finally {
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' });
    }
  };

  // Handle reject payment (developer)
  const handleRejectPayment = async (paymentId: string, confirmed: boolean = false) => {
    if (!confirmed) {
      setConfirmDialog({
        isOpen: true, title: 'رفض الدفع', message: 'هل أنت متأكد من رفض هذا الدفع؟',
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

  // Handle chat
  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentUser?.id || 'guest', message: userMessage })
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        addToast('حدث خطأ في الاتصال بالمساعد', 'error');
      }
    } catch {
      addToast('فشل الاتصال', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Handle AI assistant for developer
  const handleAiAction = async (action: string) => {
    setAiAction(action);
    setAiLoading(true);
    setAiResponse('');

    try {
      let prompt = '';
      const totalViews = apartments.reduce((sum, a) => sum + ((a as any).views || 0), 0);
      const avgPrice = apartments.length > 0 ? Math.round(apartments.reduce((sum, a) => sum + a.price, 0) / apartments.length) : 0;
      const totalRevenue = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
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

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50'}`}>
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/30">
            <Building2 className="h-12 w-12 text-white" />
          </div>
          <p className={`mt-8 text-lg font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>جاري التحميل...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-slate-100 p-4" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">حدث خطأ</h2>
          <p className="text-slate-500 mb-8">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-4 rounded-2xl font-bold hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg">
            <RefreshCw className="h-5 w-5 inline-block ml-2" />إعادة المحاولة
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/30'}`} dir="rtl">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -left-40 w-80 h-80 rounded-full ${darkMode ? 'bg-violet-900/20' : 'bg-violet-200/40'} blur-3xl`} />
        <div className={`absolute top-1/2 -right-20 w-60 h-60 rounded-full ${darkMode ? 'bg-purple-900/20' : 'bg-purple-200/40'} blur-3xl`} />
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${darkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Building2 className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent">
                  منطقتي | Manteqti
                </h1>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لوحة الشقق الذكية</p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setDarkMode(!darkMode)}
                className={`p-3 rounded-xl ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-600'} transition-all`}>
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </motion.button>

              {/* Add Apartment Button - Developer Only */}
              {isDeveloper && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all">
                  <Building2 className="h-5 w-5" />
                  <span>إضافة شقة</span>
                </motion.button>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowChat(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all">
                <Brain className="h-5 w-5" />
                <span>المساعد الذكي</span>
              </motion.button>

              {isDeveloper ? (
                <div className="flex items-center gap-2">
                  <motion.button whileHover={{ scale: 1.02 }} onClick={() => setShowDevPanel(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium shadow-lg relative">
                    <ShieldCheck className="h-5 w-5" />
                    <span>لوحة المطور</span>
                    {pendingApartments.length > 0 && (
                      <span className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {pendingApartments.length}
                      </span>
                    )}
                  </motion.button>
                  <button onClick={handleLogout} className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : currentUser ? (
                <div className="flex items-center gap-2">
                  <div className={`px-4 py-2 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <User className="h-4 w-4 inline ml-2" />
                    <span className="text-sm font-medium">{currentUser.name}</span>
                  </div>
                  <button onClick={handleLogout} className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium shadow-lg">
                  <User className="h-5 w-5" />
                  <span>تسجيل الدخول</span>
                </motion.button>
              )}

              <button onClick={() => setShowDevLogin(true)}
                className={`p-2 rounded-lg text-xs ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                <Lock className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`md:hidden p-3 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>إجمالي العقارات</p>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{filteredApartments.length}</p>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>للإيجار</p>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{filteredApartments.filter(a => a.type === 'rent').length}</p>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>للبيع</p>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{filteredApartments.filter(a => a.type === 'sale').length}</p>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>المناطق</p>
                  <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{uniqueAreas.length}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Search and Filters */}
          <div className={`p-6 rounded-2xl mb-8 ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg`}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className={`absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                <input type="text" placeholder="ابحث عن شقة..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pr-12 pl-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}
                  className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">الكل</option>
                  <option value="rent">إيجار</option>
                  <option value="sale">بيع</option>
                </select>
                <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
                  className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">كل المناطق</option>
                  {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
                <select value={bedroomsFilter} onChange={(e) => setBedroomsFilter(e.target.value)}
                  className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">كل الغرف</option>
                  <option value="1">1+ غرفة</option>
                  <option value="2">2+ غرفة</option>
                  <option value="3">3+ غرفة</option>
                  <option value="4">4+ غرفة</option>
                </select>
                <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)}
                  className={`px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">كل الأسعار</option>
                  <option value="5000">حتى 5,000 ج.م</option>
                  <option value="10000">حتى 10,000 ج.م</option>
                  <option value="20000">حتى 20,000 ج.م</option>
                  <option value="50000">حتى 50,000 ج.م</option>
                  <option value="100000">حتى 100,000 ج.م</option>
                  <option value="500000">حتى 500,000 ج.م</option>
                  <option value="1000000">حتى 1,000,000 ج.م</option>
                  <option value="5000000">حتى 5,000,000 ج.م</option>
                  <option value="10000000">حتى 10,000,000 ج.م</option>
                </select>
              </div>
            </div>
          </div>

          {/* Apartments Grid */}
          {filteredApartments.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>لا توجد شقق</h3>
              <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لم يتم العثور على شقق تطابق معايير البحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApartments.map((apartment, index) => (
                <motion.div key={apartment.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  className={`rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur shadow-lg group`}>
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img src={apartment.imageUrl || apartment.images?.[0] || '/generated-images/apt1.png'}
                      alt={apartment.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      {apartment.featured && (
                        <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-medium flex items-center gap-1">
                          <Star className="h-3 w-3" /> مميز
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusConfig[apartment.status]?.bgColor || 'bg-slate-100'} ${statusConfig[apartment.status]?.color || 'text-slate-600'}`}>
                        {statusConfig[apartment.status]?.label || apartment.status}
                      </span>
                    </div>
                    {/* Type Badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`relative px-3 py-1.5 rounded-full text-xs font-bold text-white overflow-hidden ${
                        apartment.type === 'rent' 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                          : 'bg-gradient-to-r from-blue-500 to-cyan-600'
                      } shadow-lg`}>
                        <span className="relative z-10 flex items-center gap-1">
                          {apartment.type === 'rent' ? (
                            <>
                              <Home className="h-3.5 w-3.5" />
                              للإيجار
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-3.5 w-3.5" />
                              للبيع
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                    {/* Favorite Button */}
                    <button onClick={() => toggleFavorite(apartment.id)}
                      className={`absolute bottom-3 right-3 p-2 rounded-full ${darkMode ? 'bg-slate-900/80' : 'bg-white/80'} backdrop-blur transition-all hover:scale-110`}>
                      <Heart className={`h-5 w-5 ${favorites.includes(apartment.id) ? 'fill-red-500 text-red-500' : darkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                    </button>
                  </div>
                  {/* Content */}
                  <div className="p-4">
                    <h3 className={`text-lg font-bold mb-2 line-clamp-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apartment.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-violet-500" />
                      <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apartment.area}</span>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4 text-violet-500" />
                        <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{apartment.bedrooms}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="h-4 w-4 text-violet-500" />
                        <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{apartment.bathrooms}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent">
                        {apartment.price.toLocaleString()} ج.م
                        <span className={`text-xs font-normal ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {apartment.type === 'rent' ? '/شهر' : ''}
                        </span>
                      </p>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button 
                        onClick={() => setSelectedApartment(apartment)}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium text-sm hover:from-violet-700 hover:to-purple-800 transition-all flex items-center justify-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        التفاصيل
                      </button>
                      {isDeveloper && (
                        <>
                          <button 
                            onClick={() => setEditApartment(apartment)}
                            className={`py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            تعديل
                          </button>
                          <button 
                            onClick={() => handleDeleteApartment(apartment.id)}
                            className="py-2.5 px-4 rounded-xl bg-red-500/10 text-red-500 font-medium text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5">
                            <Trash2 className="h-4 w-4" />
                            حذف
                          </button>
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
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            © 2024 منطقتي | Manteqti - جميع الحقوق محفوظة
          </p>
        </div>
      </footer>

      {/* Add Apartment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>إضافة شقة جديدة</h2>
                <button onClick={() => setShowAddModal(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                  <X className={`h-6 w-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عنوان الشقة *</label>
                    <input type="text" value={aptForm.title} onChange={(e) => setAptForm({ ...aptForm, title: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="مثال: شقة فاخرة في التجمع الخامس" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر *</label>
                    <input type="number" value={aptForm.price} onChange={(e) => setAptForm({ ...aptForm, price: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="0" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة *</label>
                    <input type="text" value={aptForm.area} onChange={(e) => setAptForm({ ...aptForm, area: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="مثال: التجمع الخامس" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عدد الغرف</label>
                    <select value={aptForm.bedrooms} onChange={(e) => setAptForm({ ...aptForm, bedrooms: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عدد الحمامات</label>
                    <select value={aptForm.bathrooms} onChange={(e) => setAptForm({ ...aptForm, bathrooms: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>النوع</label>
                    <select value={aptForm.type} onChange={(e) => setAptForm({ ...aptForm, type: e.target.value as 'rent' | 'sale' })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                      <option value="rent">إيجار</option>
                      <option value="sale">بيع</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رقم الهاتف *</label>
                    <input type="tel" value={aptForm.ownerPhone} onChange={(e) => setAptForm({ ...aptForm, ownerPhone: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="+20 1xx xxx xxxx" />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الوصف *</label>
                  <textarea value={aptForm.description} onChange={(e) => setAptForm({ ...aptForm, description: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                    rows={3} placeholder="اكتب وصفاً تفصيلياً للشقة..." />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رابط الخريطة</label>
                  <input type="url" value={aptForm.mapLink} onChange={(e) => setAptForm({ ...aptForm, mapLink: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                    placeholder="https://maps.google.com/..." />
                </div>
                
                {/* Images Section */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <ImageIcon className="h-4 w-4 inline ml-1" />
                    صور الشقة
                  </label>
                  
                  {/* Add Image Input */}
                  <div className="flex gap-2 mb-3">
                    <input type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                      className={`flex-1 px-4 py-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="الصق رابط الصورة هنا..." 
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newImageUrl.trim()) {
                          e.preventDefault();
                          setImageUrls([...imageUrls, newImageUrl.trim()]);
                          setNewImageUrl('');
                        }
                      }} />
                    <button type="button" onClick={() => {
                      if (newImageUrl.trim()) {
                        setImageUrls([...imageUrls, newImageUrl.trim()]);
                        setNewImageUrl('');
                      }
                    }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium hover:from-violet-700 hover:to-purple-800 transition-all flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة
                    </button>
                  </div>
                  
                  {/* Image Preview Grid */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img src={url} alt={`صورة ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border-2 border-transparent group-hover:border-violet-500 transition-all"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=خطأ'; }} />
                          <button type="button" onClick={() => setImageUrls(imageUrls.filter((_, i) => i !== index))}
                            className="absolute -top-2 -left-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <X className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Image URL List */}
                  {imageUrls.length > 0 && (
                    <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      تم إضافة {imageUrls.length} صورة
                    </div>
                  )}
                  
                  <p className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    نصيحة: استخدم روابط من مواقع مثل Imgur أو Google Drive أو أي خدمة استضافة صور
                  </p>
                </div>
                
                {/* Videos Section */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                  <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <Video className="h-4 w-4 inline ml-1" />
                    فيديوهات الشقة (اختياري)
                  </label>
                  
                  {/* Add Video Input */}
                  <div className="flex gap-2 mb-3">
                    <input type="url" value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)}
                      className={`flex-1 px-4 py-2 rounded-xl border text-sm ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="الصق رابط الفيديو (YouTube, Vimeo...)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newVideoUrl.trim()) {
                          e.preventDefault();
                          setVideoUrls([...videoUrls, newVideoUrl.trim()]);
                          setNewVideoUrl('');
                        }
                      }} />
                    <button type="button" onClick={() => {
                      if (newVideoUrl.trim()) {
                        setVideoUrls([...videoUrls, newVideoUrl.trim()]);
                        setNewVideoUrl('');
                      }
                    }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-medium hover:from-rose-600 hover:to-pink-700 transition-all flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة
                    </button>
                  </div>
                  
                  {/* Video List */}
                  {videoUrls.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {videoUrls.map((url, index) => (
                        <div key={index} className={`flex items-center gap-2 p-2 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-white'} border ${darkMode ? 'border-slate-500' : 'border-slate-200'}`}>
                          <Play className="h-4 w-4 text-rose-500 flex-shrink-0" />
                          <a href={url} target="_blank" rel="noopener noreferrer" 
                            className={`flex-1 text-sm truncate hover:underline ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {url.length > 50 ? url.substring(0, 50) + '...' : url}
                          </a>
                          <button type="button" onClick={() => setVideoUrls(videoUrls.filter((_, i) => i !== index))}
                            className="p-1 rounded hover:bg-red-500/10 text-red-500">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    يمكنك إضافة روابط من YouTube أو Vimeo أو أي منصة فيديو أخرى
                  </p>
                </div>

                {/* Notice */}
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-amber-900/20 border border-amber-700' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-medium ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>ملاحظة مهمة</p>
                      <p className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        {currentUser 
                          ? 'سيتم إرسال الشقة للمراجعة وسيتم نشرها بعد موافقة المطور.'
                          : 'يجب تسجيل الدخول لإضافة شقة. سيتم إرسال الشقة للمراجعة بعد تسجيل الدخول.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowAddModal(false)}
                    className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    إلغاء
                  </button>
                  <button onClick={() => handleAddApartment(false)} disabled={aptSubmitting}
                    className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all">
                    {aptSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'إرسال للمراجعة'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apartment Details Modal */}
      <AnimatePresence>
        {selectedApartment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedApartment(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              {/* Image */}
              <div className="relative h-64 md:h-80">
                <img src={selectedApartment.imageUrl || selectedApartment.images?.[0] || '/generated-images/apt1.png'}
                  alt={selectedApartment.title}
                  className="w-full h-full object-cover" />
                <button onClick={() => setSelectedApartment(null)}
                  className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute top-4 right-4 flex gap-2">
                  {selectedApartment.featured && (
                    <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium">
                      <Star className="h-4 w-4 inline ml-1" /> مميز
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusConfig[selectedApartment.status]?.bgColor} ${statusConfig[selectedApartment.status]?.color}`}>
                    {statusConfig[selectedApartment.status]?.label}
                  </span>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedApartment.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-violet-500" />
                      <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{selectedApartment.area}</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold bg-gradient-to-l from-violet-600 to-purple-700 bg-clip-text text-transparent">
                    {selectedApartment.price.toLocaleString()} ج.م
                    <span className={`block text-xs font-normal text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {selectedApartment.type === 'rent' ? 'شهرياً' : ''}
                    </span>
                  </p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Bed className="h-5 w-5 text-violet-500 mx-auto mb-1" />
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.bedrooms} غرف</p>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Bath className="h-5 w-5 text-violet-500 mx-auto mb-1" />
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.bathrooms} حمام</p>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Home className="h-5 w-5 text-violet-500 mx-auto mb-1" />
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.type === 'rent' ? 'إيجار' : 'بيع'}</p>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Eye className="h-5 w-5 text-violet-500 mx-auto mb-1" />
                    <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.views || 0} مشاهدة</p>
                  </div>
                </div>

                {/* Description */}
                <p className={`mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{selectedApartment.description}</p>

                {/* Amenities */}
                {selectedApartment.amenities && selectedApartment.amenities.length > 0 && (
                  <div className="mb-6">
                    <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>المميزات</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedApartment.amenities.map((amenity, idx) => (
                        <span key={idx} className={`px-3 py-1 rounded-lg text-sm ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          <Check className="h-3 w-3 inline ml-1 text-emerald-500" />{amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Info - Only show if paid or developer */}
                {hasPaidForApartment(selectedApartment.id) ? (
                  <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-emerald-900/20 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>بيانات التواصل</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-500" />
                        <a href={`tel:${selectedApartment.ownerPhone}`} className={`${darkMode ? 'text-emerald-300' : 'text-emerald-700'} hover:underline`}>
                          {selectedApartment.ownerPhone}
                        </a>
                      </div>
                      {selectedApartment.mapLink && (
                        <a href={selectedApartment.mapLink} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center gap-2 ${darkMode ? 'text-emerald-300' : 'text-emerald-700'} hover:underline`}>
                          <ExternalLink className="h-4 w-4" />
                          عرض على الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-xl mb-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-violet-500" />
                        <div>
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>بيانات التواصل محجوبة</p>
                          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>ادفع {CONTACT_FEE} ج.م للوصول لبيانات المالك</p>
                        </div>
                      </div>
                      <button onClick={() => { setPaymentApartment(selectedApartment); setSelectedApartment(null); }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium hover:from-violet-700 hover:to-purple-800">
                        طلب بيانات
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => { setInquiryApartment(selectedApartment); setSelectedApartment(null); }}
                    className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    <MessageSquare className="h-5 w-5 inline ml-2" />استفسار
                  </button>
                  <button onClick={() => toggleFavorite(selectedApartment.id)}
                    className={`py-3 px-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    <Heart className={`h-5 w-5 ${favorites.includes(selectedApartment.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </button>
                </div>

                {/* Developer Actions */}
                {isDeveloper && (
                  <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>إجراءات المطور</h3>
                    <div className="flex flex-wrap gap-2">
                      <select onChange={(e) => { if (e.target.value) handleUpdateStatus(selectedApartment.id, e.target.value); }}
                        className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <option value="">تغيير الحالة</option>
                        <option value="available">متاح</option>
                        <option value="preview">في معاينة</option>
                        <option value="reserved">محجوز</option>
                        <option value="sold">تم البيع</option>
                        <option value="rented">تم التأجير</option>
                        <option value="unavailable">غير متاح</option>
                      </select>
                      <button onClick={() => handleDeleteApartment(selectedApartment.id)}
                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
                        <Trash2 className="h-4 w-4 ml-1" />حذف
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Apartment Modal */}
      <AnimatePresence>
        {editApartment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditApartment(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>تعديل الشقة</h2>
                <button onClick={() => setEditApartment(null)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                  <X className={`h-6 w-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                </button>
              </div>

              <form onSubmit={handleEditApartment}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عنوان الشقة</label>
                      <input type="text" value={editApartment.title} onChange={(e) => setEditApartment({ ...editApartment, title: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>السعر</label>
                      <input type="number" value={editApartment.price} onChange={(e) => setEditApartment({ ...editApartment, price: Number(e.target.value) })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>المنطقة</label>
                      <input type="text" value={editApartment.area} onChange={(e) => setEditApartment({ ...editApartment, area: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عدد الغرف</label>
                      <select value={editApartment.bedrooms} onChange={(e) => setEditApartment({ ...editApartment, bedrooms: Number(e.target.value) })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>عدد الحمامات</label>
                      <select value={editApartment.bathrooms} onChange={(e) => setEditApartment({ ...editApartment, bathrooms: Number(e.target.value) })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                        {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>النوع</label>
                      <select value={editApartment.type} onChange={(e) => setEditApartment({ ...editApartment, type: e.target.value as 'rent' | 'sale' })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                        <option value="rent">إيجار</option>
                        <option value="sale">بيع</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رقم الهاتف</label>
                      <input type="tel" value={editApartment.ownerPhone} onChange={(e) => setEditApartment({ ...editApartment, ownerPhone: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>الوصف</label>
                    <textarea value={editApartment.description} onChange={(e) => setEditApartment({ ...editApartment, description: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      rows={3} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>رابط الخريطة</label>
                    <input type="url" value={editApartment.mapLink || ''} onChange={(e) => setEditApartment({ ...editApartment, mapLink: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <button type="button" onClick={() => setEditApartment(null)}
                    className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    إلغاء
                  </button>
                  <button type="submit" disabled={editSubmitting}
                    className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all">
                    {editSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'حفظ التغييرات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAuth(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {authStep === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                </h2>
                <button onClick={() => { setShowAuth(false); setAuthStep('login'); }} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                  <X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="flex gap-2 mb-6">
                <button onClick={() => setAuthStep('login')}
                  className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                    authStep === 'login' 
                      ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white' 
                      : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                  تسجيل الدخول
                </button>
                <button onClick={() => setAuthStep('register')}
                  className={`flex-1 py-2 rounded-xl font-medium transition-all ${
                    authStep === 'register' 
                      ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white' 
                      : darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                  إنشاء حساب
                </button>
              </div>

              {authStep === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      البريد الإلكتروني أو رقم الهاتف
                    </label>
                    <input type="text" value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="example@email.com أو +20123456789" required />
                  </div>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور</label>
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="••••••••" required />
                  </div>
                  <button type="submit" disabled={authLoading}
                    className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50">
                    {authLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'تسجيل الدخول'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      الاسم الكامل
                    </label>
                    <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="أدخل اسمك" required />
                  </div>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      البريد الإلكتروني أو رقم الهاتف
                    </label>
                    <input type="text" value={authIdentifier} onChange={(e) => setAuthIdentifier(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="example@email.com أو +20123456789" required />
                  </div>
                  <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>كلمة المرور</label>
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-violet-500`}
                      placeholder="6 أحرف على الأقل" required minLength={6} />
                  </div>
                  <button type="submit" disabled={authLoading}
                    className="w-full py-3 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50">
                    {authLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'إنشاء حساب'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Login Modal */}
      <AnimatePresence>
        {showDevLogin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDevLogin(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>دخول المطور</h2>
              </div>
              <form onSubmit={handleDevLogin}>
                <div className="space-y-4">
                  <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="البريد الإلكتروني" required />
                  <input type="password" value={devPassword} onChange={(e) => setDevPassword(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                    placeholder="كلمة المرور" required />
                </div>
                <button type="submit" disabled={devLoading}
                  className="w-full mt-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50">
                  {devLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'دخول'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Panel Modal */}
      <AnimatePresence>
        {showDevPanel && isDeveloper && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDevPanel(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-3xl ${darkMode ? 'bg-slate-900' : 'bg-white'} shadow-2xl`}>
              {/* Header */}
              <div className={`sticky top-0 z-10 p-6 border-b ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                      <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>لوحة تحكم المطور</h2>
                      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>جميع الصلاحيات والإحصائيات</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDevPanel(false)} className={`p-3 rounded-xl ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} transition-all`}>
                    <X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                  </button>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {[
                    { id: 'stats', label: 'الإحصائيات', icon: BarChart3, color: 'from-violet-500 to-purple-600' },
                    { id: 'pending', label: 'في انتظار الموافقة', count: pendingApartments.length, icon: Hourglass, color: 'from-amber-500 to-orange-600' },
                    { id: 'apartments', label: 'العقارات', count: allApartments.length, icon: Building2, color: 'from-blue-500 to-cyan-600' },
                    { id: 'payments', label: 'المدفوعات', count: payments.length, icon: CreditCard, color: 'from-emerald-500 to-teal-600' },
                    { id: 'settings', label: 'الإعدادات', icon: Settings, color: 'from-pink-500 to-rose-600' },
                    { id: 'logs', label: 'السجل', icon: BookOpen, color: 'from-slate-500 to-slate-600' },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setDevTab(tab.id as any)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                        devTab === tab.id
                          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                          : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${devTab === tab.id ? 'bg-white/20' : darkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Statistics Tab */}
                {devTab === 'stats' && (
                  <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {[
                        { label: 'إجمالي العقارات', value: allApartments.length, icon: Building2, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-500/10' },
                        { label: 'المتاحة', value: allApartments.filter(a => a.status === 'available').length, icon: CheckCircle2, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10' },
                        { label: 'للبيع', value: allApartments.filter(a => a.type === 'sale').length, icon: TrendingUp, color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500/10' },
                        { label: 'للإيجار', value: allApartments.filter(a => a.type === 'rent').length, icon: Home, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10' },
                        { label: 'المباعة', value: allApartments.filter(a => a.status === 'sold').length, icon: DollarSign, color: 'from-green-500 to-emerald-600', bg: 'bg-green-500/10' },
                        { label: 'المؤجرة', value: allApartments.filter(a => a.status === 'rented').length, icon: Key, color: 'from-teal-500 to-cyan-600', bg: 'bg-teal-500/10' },
                      ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${stat.color} flex items-center justify-center mb-3`}>
                            <stat.icon className="h-5 w-5 text-white" />
                          </div>
                          <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Revenue Stats */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className={`p-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white`}>
                        <div className="flex items-center justify-between mb-4">
                          <Wallet className="h-8 w-8" />
                          <span className="px-3 py-1 rounded-full bg-white/20 text-sm">الإيرادات</span>
                        </div>
                        <p className="text-3xl font-bold">{payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
                        <p className="text-sm opacity-80">جنيه مصري</p>
                      </div>
                      <div className={`p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white`}>
                        <div className="flex items-center justify-between mb-4">
                          <CreditCard className="h-8 w-8" />
                          <span className="px-3 py-1 rounded-full bg-white/20 text-sm">المدفوعات</span>
                        </div>
                        <p className="text-3xl font-bold">{payments.filter(p => p.status === 'Paid').length}</p>
                        <p className="text-sm opacity-80">عملية ناجحة</p>
                      </div>
                      <div className={`p-6 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white`}>
                        <div className="flex items-center justify-between mb-4">
                          <Hourglass className="h-8 w-8" />
                          <span className="px-3 py-1 rounded-full bg-white/20 text-sm">معلقة</span>
                        </div>
                        <p className="text-3xl font-bold">{payments.filter(p => p.status === 'Pending').length}</p>
                        <p className="text-sm opacity-80">في الانتظار</p>
                      </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Status Distribution */}
                      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          <PieChart className="h-5 w-5 text-violet-500" />
                          توزيع الحالات
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(statusConfig).map(([key, config]) => {
                            const count = allApartments.filter(a => a.status === key).length;
                            const percentage = allApartments.length > 0 ? (count / allApartments.length) * 100 : 0;
                            return (
                              <div key={key} className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${config.dotColor}`} />
                                <span className={`flex-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{config.label}</span>
                                <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{count}</span>
                                <div className={`w-24 h-2 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                  <div className={`h-full rounded-full ${config.bgColor}`} style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Type Distribution */}
                      <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          <Layers className="h-5 w-5 text-blue-500" />
                          توزيع الأنواع
                        </h3>
                        <div className="flex gap-4">
                          <div className="flex-1 p-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-5 w-5 text-blue-500" />
                              <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>للبيع</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-500">{allApartments.filter(a => a.type === 'sale').length}</p>
                            <p className="text-xs text-blue-400">{((allApartments.filter(a => a.type === 'sale').length / allApartments.length) * 100 || 0).toFixed(1)}%</p>
                          </div>
                          <div className="flex-1 p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <Home className="h-5 w-5 text-emerald-500" />
                              <span className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>للإيجار</span>
                            </div>
                            <p className="text-2xl font-bold text-emerald-500">{allApartments.filter(a => a.type === 'rent').length}</p>
                            <p className="text-xs text-emerald-400">{((allApartments.filter(a => a.type === 'rent').length / allApartments.length) * 100 || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        <Activity className="h-5 w-5 text-violet-500" />
                        النشاط الأخير
                      </h3>
                      <div className="space-y-3">
                        {operationLogs.slice(0, 5).map(log => (
                          <div key={log.id} className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-white'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              log.action === 'create' ? 'bg-blue-500/20 text-blue-500' :
                              log.action === 'delete' ? 'bg-red-500/20 text-red-500' :
                              log.action === 'approve' ? 'bg-emerald-500/20 text-emerald-500' :
                              'bg-violet-500/20 text-violet-500'
                            }`}>
                              {log.action === 'create' ? <Plus className="h-4 w-4" /> :
                               log.action === 'delete' ? <Trash2 className="h-4 w-4" /> :
                               log.action === 'approve' ? <Check className="h-4 w-4" /> :
                               <Eye className="h-4 w-4" />}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{log.action}</p>
                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.details}</p>
                            </div>
                            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {new Date(log.createdAt).toLocaleString('ar-EG')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending Apartments Tab */}
                {devTab === 'pending' && (
                  <div>
                    {pendingApartments.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckCircle2 className={`h-16 w-16 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>لا توجد شقق في انتظار الموافقة</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingApartments.map(apt => (
                          <div key={apt.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                            <div className="flex flex-col md:flex-row gap-4">
                              <img src={apt.imageUrl || apt.images?.[0] || '/generated-images/apt1.png'} alt={apt.title}
                                className="w-full md:w-32 h-24 object-cover rounded-lg" />
                              <div className="flex-1">
                                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{apt.title}</h3>
                                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{apt.area} • {apt.bedrooms} غرف • {apt.type === 'rent' ? 'إيجار' : 'بيع'}</p>
                                <p className={`text-sm mt-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{apt.description?.substring(0, 100)}...</p>
                                <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <Phone className="h-3 w-3 inline ml-1" />{apt.ownerPhone}
                                </p>
                              </div>
                              <div className="flex md:flex-col gap-2">
                                <button onClick={() => handleApproveApartment(apt.id)}
                                  className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-sm font-medium">
                                  <Check className="h-4 w-4 inline ml-1" />موافقة
                                </button>
                                <button onClick={() => handleRejectApartment(apt.id)}
                                  className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 text-sm font-medium">
                                  <XCircle className="h-4 w-4 inline ml-1" />رفض
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Apartments Tab */}
                {devTab === 'apartments' && (
                  <div className="overflow-x-auto">
                    <table className={`w-full ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <thead>
                        <tr className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                          <th className="text-right py-3 px-2">العنوان</th>
                          <th className="text-right py-3 px-2">المنطقة</th>
                          <th className="text-right py-3 px-2">السعر</th>
                          <th className="text-right py-3 px-2">الحالة</th>
                          <th className="text-right py-3 px-2">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allApartments.map(apt => (
                          <tr key={apt.id} className={`border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                            <td className="py-3 px-2">{apt.title}</td>
                            <td className="py-3 px-2">{apt.area}</td>
                            <td className="py-3 px-2">{apt.price.toLocaleString()}</td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-1 rounded-lg text-xs ${statusConfig[apt.status]?.bgColor} ${statusConfig[apt.status]?.color}`}>
                                {statusConfig[apt.status]?.label}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex gap-2">
                                <select onChange={(e) => { if (e.target.value) handleUpdateStatus(apt.id, e.target.value); }}
                                  className={`px-2 py-1 rounded text-xs ${darkMode ? 'bg-slate-600 text-white' : 'bg-slate-200'}`}>
                                  <option value="">تغيير</option>
                                  <option value="available">متاح</option>
                                  <option value="reserved">محجوز</option>
                                  <option value="sold">تم البيع</option>
                                  <option value="rented">تم التأجير</option>
                                </select>
                                <button onClick={() => handleDeleteApartment(apt.id)} className="text-red-500 hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Payments Tab */}
                {devTab === 'payments' && (
                  <div className="overflow-x-auto">
                    <table className={`w-full ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <thead>
                        <tr className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                          <th className="text-right py-3 px-2">المستخدم</th>
                          <th className="text-right py-3 px-2">العقار</th>
                          <th className="text-right py-3 px-2">المبلغ</th>
                          <th className="text-right py-3 px-2">الطريقة</th>
                          <th className="text-right py-3 px-2">الحالة</th>
                          <th className="text-right py-3 px-2">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(payment => (
                          <tr key={payment.id} className={`border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                            <td className="py-3 px-2">{payment.inquiry?.name || '-'}</td>
                            <td className="py-3 px-2">{payment.inquiry?.apartment?.title || '-'}</td>
                            <td className="py-3 px-2">{payment.amount} ج.م</td>
                            <td className="py-3 px-2">{payment.method}</td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-1 rounded-lg text-xs ${
                                payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' :
                                payment.status === 'Pending' ? 'bg-amber-100 text-amber-600' :
                                'bg-red-100 text-red-600'
                              }`}>
                                {payment.status === 'Paid' ? 'مدفوع' : payment.status === 'Pending' ? 'معلق' : 'فشل'}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              {payment.status === 'Pending' && (
                                <div className="flex gap-2">
                                  <button onClick={() => handleConfirmPayment(payment.id)} className="text-emerald-500 hover:text-emerald-600">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleRejectPayment(payment.id)} className="text-red-500 hover:text-red-600">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Settings Tab */}
                {devTab === 'settings' && (
                  <div className="space-y-6">
                    {/* Fees Settings */}
                    <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <h3 className={`font-bold mb-6 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        <Wallet className="h-5 w-5 text-emerald-500" />
                        رسوم الخدمات (بالجنيه المصري)
                      </h3>
                      <div className="grid md:grid-cols-3 gap-4">
                        {[
                          { key: 'contactFee', label: 'عرض بيانات التواصل', icon: Phone, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                          { key: 'featuredFee', label: 'العقار المميز', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                          { key: 'premiumFee', label: 'العقار المميز+', icon: Sparkles, color: 'text-pink-500', bg: 'bg-pink-500/10' },
                          { key: 'saleDisplayFee', label: 'عرض عقارات للبيع', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                          { key: 'rentDisplayFee', label: 'عرض عقارات الإيجار', icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                          { key: 'otherServicesFee', label: 'خدمات أخرى', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-500/10' },
                          { key: 'highlightFee', label: 'التمييز الخاص', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                          { key: 'priorityListingFee', label: 'الإدراج المميز', icon: ArrowUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                          { key: 'verifiedListingFee', label: 'التحقق من العقار', icon: ShieldCheck, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
                        ].map(fee => (
                          <div key={fee.key} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-white'} border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-8 h-8 rounded-lg ${fee.bg} flex items-center justify-center`}>
                                <fee.icon className={`h-4 w-4 ${fee.color}`} />
                              </div>
                              <label className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{fee.label}</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" value={settings[fee.key as keyof typeof settings] || 0}
                                onChange={(e) => updateSettings({ [fee.key]: parseInt(e.target.value) || 0 })}
                                className={`flex-1 px-3 py-2 rounded-lg border text-lg font-bold ${darkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                              <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>ج.م</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={async () => { await updateSettings(settings); addToast('تم حفظ جميع الإعدادات', 'success'); }}
                        disabled={settingsLoading}
                        className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {settingsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                        حفظ جميع الإعدادات
                      </button>
                    </div>

                    {/* AI Assistant */}
                    <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        <Brain className="h-5 w-5 text-violet-500" />
                        المساعد الذكي للمطور
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { id: 'stats', label: 'تحليل الإحصائيات', icon: BarChart3, color: 'from-violet-500 to-purple-600' },
                          { id: 'payments', label: 'تحليل المدفوعات', icon: DollarSign, color: 'from-emerald-500 to-teal-600' },
                          { id: 'suggestions', label: 'اقتراحات تحسين', icon: Sparkles, color: 'from-amber-500 to-orange-600' },
                          { id: 'help', label: 'مساعدة', icon: BookOpen, color: 'from-blue-500 to-cyan-600' },
                        ].map(action => (
                          <button key={action.id} onClick={() => handleAiAction(action.id)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r ${action.color} text-white font-medium hover:opacity-90 transition-all`}>
                            <action.icon className="h-4 w-4" />{action.label}
                          </button>
                        ))}
                      </div>
                      {aiLoading && (
                        <div className="mt-4 flex items-center gap-2 text-violet-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جاري التحليل...
                        </div>
                      )}
                      {aiResponse && (
                        <div className={`mt-4 p-4 rounded-xl text-sm whitespace-pre-wrap ${darkMode ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700'} border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                          {aiResponse}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-800' : 'bg-slate-50'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      <h3 className={`font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        <Zap className="h-5 w-5 text-amber-500" />
                        إجراءات سريعة
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        <button onClick={async () => { await fetchApartments(); addToast('تم تحديث البيانات', 'info'); }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-700 hover:bg-slate-100'} border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                          <RefreshCw className="h-4 w-4" />تحديث البيانات
                        </button>
                        <button onClick={() => addToast('ميزة قيد التطوير', 'info')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-700 hover:bg-slate-100'} border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                          <Download className="h-4 w-4" />تصدير البيانات
                        </button>
                        <button onClick={() => addToast('ميزة قيد التطوير', 'info')}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-700 hover:bg-slate-100'} border ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                          <Upload className="h-4 w-4" />استيراد البيانات
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logs Tab */}
                {devTab === 'logs' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {operationLogs.map(log => (
                      <div key={log.id} className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>{log.action}</span>
                          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {new Date(log.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentApartment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPaymentApartment(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-white" />
                </div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>طلب بيانات التواصل</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ادفع {CONTACT_FEE} ج.م للحصول على بيانات مالك "{paymentApartment.title}"
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: 'Visa', label: 'فيزا', icon: CreditCard },
                  { id: 'Mastercard', label: 'ماستركارد', icon: CreditCard },
                  { id: 'InstaPay', label: 'إنستاباي', icon: Smartphone },
                  { id: 'Cash', label: 'كاش', icon: Banknote },
                ].map(method => (
                  <button key={method.id} onClick={() => setPaymentMethod(method.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === method.id
                        ? 'border-violet-500 bg-violet-50'
                        : darkMode ? 'border-slate-600 hover:border-slate-500' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <method.icon className={`h-6 w-6 mx-auto mb-2 ${paymentMethod === method.id ? 'text-violet-500' : darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span className={paymentMethod === method.id ? 'text-violet-600 font-medium' : darkMode ? 'text-slate-300' : 'text-slate-600'}>{method.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPaymentApartment(null)}
                  className={`flex-1 py-3 rounded-xl font-medium ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  إلغاء
                </button>
                <button onClick={() => handlePayment(false)} disabled={!paymentMethod || paymentSubmitting}
                  className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 disabled:opacity-50">
                  {paymentSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'تأكيد'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setShowChat(false)}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg h-[80vh] md:h-[70vh] rounded-t-2xl md:rounded-2xl flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}>
              {/* Header */}
              <div className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>المساعد الذكي</h3>
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>اسألني عن أي شقة</p>
                    </div>
                  </div>
                  <button onClick={() => setShowChat(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                    <X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                  </button>
                </div>
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className={`h-12 w-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>مرحباً! كيف يمكنني مساعدتك؟</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {['شقق في التجمع', 'أرخص شقة', 'شقة 3 غرف'].map(q => (
                        <button key={q} onClick={() => setChatInput(q)}
                          className={`px-3 py-1 rounded-full text-sm ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-tr-none'
                        : darkMode ? 'bg-slate-700 text-slate-200 rounded-tl-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-end">
                    <div className={`p-3 rounded-2xl rounded-tl-none ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                    </div>
                  </div>
                )}
              </div>
              {/* Input */}
              <div className={`p-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex gap-2">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="اكتب رسالتك..."
                    className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-500'} focus:outline-none focus:ring-2 focus:ring-violet-500`} />
                  <button onClick={handleSendMessage} disabled={!chatInput.trim() || chatLoading}
                    className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white hover:from-violet-700 hover:to-purple-800 disabled:opacity-50">
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <ConfirmDialog {...confirmDialog} darkMode={darkMode} onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning' })} />

      {/* Toasts */}
      <div className="fixed top-4 left-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div key={toast.id} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
                toast.type === 'success' ? 'bg-emerald-500 text-white' :
                toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-violet-500 text-white'
              }`}>
              {toast.type === 'success' && <Check className="h-5 w-5" />}
              {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
              {toast.type === 'info' && <AlertTriangle className="h-5 w-5" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setShowMobileMenu(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className={`absolute left-0 top-0 bottom-0 w-80 ${darkMode ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>القائمة</h2>
                  <button onClick={() => setShowMobileMenu(false)} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                    <X className={`h-5 w-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                  </button>
                </div>
                <div className="space-y-3">
                  <button onClick={() => { setShowAddModal(true); setShowMobileMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                    <Building2 className="h-5 w-5" />إضافة شقة
                  </button>
                  <button onClick={() => { setShowChat(true); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <Brain className="h-5 w-5" />المساعد الذكي
                  </button>
                  {isDeveloper ? (
                    <>
                      <button onClick={() => { setShowDevPanel(true); setShowMobileMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                        <ShieldCheck className="h-5 w-5" />لوحة المطور
                        {pendingApartments.length > 0 && (
                          <span className="mr-auto px-2 py-0.5 rounded-full bg-white/20 text-xs">{pendingApartments.length}</span>
                        )}
                      </button>
                      <button onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-red-400' : 'bg-slate-100 text-red-500'}`}>
                        <LogOut className="h-5 w-5" />تسجيل الخروج
                      </button>
                    </>
                  ) : currentUser ? (
                    <button onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-red-400' : 'bg-slate-100 text-red-500'}`}>
                      <LogOut className="h-5 w-5" />تسجيل الخروج
                    </button>
                  ) : (
                    <button onClick={() => { setShowAuth(true); setShowMobileMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white">
                      <User className="h-5 w-5" />تسجيل الدخول
                    </button>
                  )}
                  <button onClick={() => setDarkMode(!darkMode)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-700 text-amber-400' : 'bg-slate-100 text-slate-700'}`}>
                    {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    {darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
