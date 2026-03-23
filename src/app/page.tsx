"use client"

import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Home as HomeIcon,
  Users,
  Building2,
  Plus,
  LogOut,
  LogIn,
  Shield,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  Star,
  Ban,
  UserPlus,
  Menu,
  X as XIcon,
  Lock,
  Crown,
  Sparkles,
  Settings,
  User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

// أنواع البيانات
interface UserType {
  id: string
  name: string | null
  email: string
  role: string
  isBlocked: boolean
  createdAt: string
  _count?: { apartments: number }
}

interface ApartmentType {
  id: string
  title: string
  description: string | null
  price: number | null
  area: number | null
  rooms: number | null
  bathrooms: number | null
  address: string | null
  city: string | null
  neighborhood: string | null
  type: string | null
  status: string
  images: string | null
  isFeatured: boolean
  featuredType: string | null
  isHidden: boolean
  createdAt: string
  creator: {
    id: string
    name: string | null
    email: string
    isBlocked: boolean
  }
}

export default function Home() {
  const { data: session, status } = useSession()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("apartments")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // حالات النماذج
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "", phone: "" })
  const [apartmentForm, setApartmentForm] = useState({
    title: "",
    description: "",
    price: "",
    area: "",
    rooms: "",
    bathrooms: "",
    address: "",
    city: "",
    neighborhood: "",
    type: "sale"
  })
  const [blockReason, setBlockReason] = useState("")
  const [showLoginForm, setShowLoginForm] = useState(true)

  // جلب المستخدمين (للمطور)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("فشل في جلب المستخدمين")
      return res.json()
    },
    enabled: session?.user?.role === "developer"
  })

  // جلب العقارات
  const { data: apartmentsData, isLoading: apartmentsLoading } = useQuery({
    queryKey: ["apartments"],
    queryFn: async () => {
      const res = await fetch("/api/apartments")
      if (!res.ok) throw new Error("فشل في جلب العقارات")
      return res.json()
    }
  })

  // جلب عقاراتي
  const { data: myApartmentsData, isLoading: myApartmentsLoading } = useQuery({
    queryKey: ["my-apartments"],
    queryFn: async () => {
      const res = await fetch("/api/apartments/my")
      if (!res.ok) throw new Error("فشل في جلب عقاراتك")
      return res.json()
    },
    enabled: !!session?.user
  })

  // تسجيل الدخول
  const loginMutation = useMutation({
    mutationFn: async () => {
      const result = await signIn("credentials", {
        email: loginForm.email,
        password: loginForm.password,
        redirect: false
      })
      if (result?.error) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدخول بنجاح")
      setLoginForm({ email: "", password: "" })
      queryClient.invalidateQueries()
    },
    onError: () => {
      toast.error("فشل تسجيل الدخول - تحقق من البيانات")
    }
  })

  // التسجيل
  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح - يمكنك الآن تسجيل الدخول")
      setShowLoginForm(true)
      setRegisterForm({ name: "", email: "", password: "", phone: "" })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // إضافة عقار
  const addApartmentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apartmentForm)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setApartmentForm({
        title: "",
        description: "",
        price: "",
        area: "",
        rooms: "",
        bathrooms: "",
        address: "",
        city: "",
        neighborhood: "",
        type: "sale"
      })
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
      queryClient.invalidateQueries({ queryKey: ["my-apartments"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // حظر مستخدم
  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, action, reason }: { userId: string; action: string; reason?: string }) => {
      const res = await fetch(`/api/users/${userId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
      setBlockReason("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // الموافقة على عقار
  const approveApartmentMutation = useMutation({
    mutationFn: async ({ apartmentId, action }: { apartmentId: string; action: string }) => {
      const res = await fetch(`/api/apartments/${apartmentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // تمييز عقار
  const featureApartmentMutation = useMutation({
    mutationFn: async ({ apartmentId, action, featuredType }: { apartmentId: string; action: string; featuredType?: string }) => {
      const res = await fetch(`/api/apartments/${apartmentId}/feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, featuredType })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // إخفاء/إظهار عقار
  const hideApartmentMutation = useMutation({
    mutationFn: async ({ apartmentId, action }: { apartmentId: string; action: string }) => {
      const res = await fetch(`/api/apartments/${apartmentId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // حذف عقار
  const deleteApartmentMutation = useMutation({
    mutationFn: async (apartmentId: string) => {
      const res = await fetch(`/api/apartments/${apartmentId}/delete-content`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ["apartments"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // تسجيل الخروج
  const handleSignOut = () => {
    signOut()
    toast.success("تم تسجيل الخروج")
  }

  // مكون بطاقة العقار
  const ApartmentCard = ({ apartment, showActions = false }: { apartment: ApartmentType; showActions?: boolean }) => (
    <Card className={`overflow-hidden ${apartment.isHidden ? "opacity-60" : ""} ${
      apartment.featuredType === "featured_plus" ? "ring-2 ring-amber-500" :
      apartment.featuredType === "featured" ? "ring-2 ring-blue-500" : ""
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{apartment.title}</CardTitle>
            <CardDescription>
              {apartment.city && `${apartment.city}`} 
              {apartment.neighborhood && ` - ${apartment.neighborhood}`}
            </CardDescription>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {apartment.featuredType === "featured_plus" && (
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white">
                <Sparkles className="h-3 w-3 ml-1" />
                مميز+
              </Badge>
            )}
            {apartment.featuredType === "featured" && (
              <Badge className="bg-blue-500 text-white">
                <Star className="h-3 w-3 ml-1" />
                مميز
              </Badge>
            )}
            {apartment.status === "pending" && (
              <Badge variant="secondary">في الانتظار</Badge>
            )}
            {apartment.status === "rejected" && (
              <Badge variant="destructive">مرفوض</Badge>
            )}
            {apartment.isHidden && (
              <Badge variant="outline" className="border-red-500 text-red-500">
                <EyeOff className="h-3 w-3 ml-1" />
                مخفي
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          {apartment.price && (
            <div><span className="text-muted-foreground">السعر:</span> {apartment.price.toLocaleString()} ريال</div>
          )}
          {apartment.area && (
            <div><span className="text-muted-foreground">المساحة:</span> {apartment.area} م²</div>
          )}
          {apartment.rooms && (
            <div><span className="text-muted-foreground">الغرف:</span> {apartment.rooms}</div>
          )}
          {apartment.bathrooms && (
            <div><span className="text-muted-foreground">الحمامات:</span> {apartment.bathrooms}</div>
          )}
        </div>
        {apartment.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{apartment.description}</p>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <User className="h-3 w-3 inline ml-1" />
            {apartment.creator.name || apartment.creator.email}
            {apartment.creator.isBlocked && (
              <span className="text-red-500 mr-2">(محظور)</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(apartment.createdAt).toLocaleDateString("ar-SA")}
          </div>
        </div>
        
        {/* أزرار التحكم للمطور */}
        {showActions && session?.user?.role === "developer" && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {apartment.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8"
                  onClick={() => approveApartmentMutation.mutate({ apartmentId: apartment.id, action: "approve" })}
                >
                  <Check className="h-3 w-3 ml-1" />
                  موافقة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={() => approveApartmentMutation.mutate({ apartmentId: apartment.id, action: "reject" })}
                >
                  <X className="h-3 w-3 ml-1" />
                  رفض
                </Button>
              </>
            )}
            
            {apartment.status === "approved" && (
              <>
                {!apartment.featuredType ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => featureApartmentMutation.mutate({ apartmentId: apartment.id, action: "feature", featuredType: "featured" })}
                    >
                      <Star className="h-3 w-3 ml-1" />
                      مميز
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0"
                      onClick={() => featureApartmentMutation.mutate({ apartmentId: apartment.id, action: "feature", featuredType: "featured_plus" })}
                    >
                      <Sparkles className="h-3 w-3 ml-1" />
                      مميز+
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => featureApartmentMutation.mutate({ apartmentId: apartment.id, action: "unfeature" })}
                  >
                    إلغاء التمييز
                  </Button>
                )}
              </>
            )}

            {apartment.creator.isBlocked && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => hideApartmentMutation.mutate({ apartmentId: apartment.id, action: apartment.isHidden ? "show" : "hide" })}
                >
                  {apartment.isHidden ? (
                    <><Eye className="h-3 w-3 ml-1" /> إظهار</>
                  ) : (
                    <><EyeOff className="h-3 w-3 ml-1" /> إخفاء</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من حذف هذا العقار نهائياً؟")) {
                      deleteApartmentMutation.mutate(apartment.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 ml-1" />
                  حذف
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // شاشة التحميل
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // صفحة تسجيل الدخول
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">منطقتي</CardTitle>
            <CardDescription>منصة عقارية متكاملة</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={showLoginForm ? "login" : "register"} onValueChange={(v) => setShowLoginForm(v === "login")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="register">حساب جديد</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">البريد الإلكتروني</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    placeholder="أدخل بريدك الإلكتروني"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">كلمة المرور</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="أدخل كلمة المرور"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => loginMutation.mutate()}
                  disabled={loginMutation.isPending || !loginForm.email || !loginForm.password}
                >
                  {loginMutation.isPending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                </Button>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">الاسم</Label>
                  <Input
                    id="register-name"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="أدخل اسمك"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">البريد الإلكتروني</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="أدخل بريدك الإلكتروني"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-phone">رقم الهاتف (اختياري)</Label>
                  <Input
                    id="register-phone"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="أدخل رقم هاتفك"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">كلمة المرور</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="أدخل كلمة المرور"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending || !registerForm.email || !registerForm.password}
                >
                  {registerMutation.isPending ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    )
  }

  // الصفحة الرئيسية للمستخدم المسجل
  return (
    <div className="min-h-screen flex flex-col">
      {/* الهيدر */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">منطقتي</h1>
          </div>
          
          {/* القائمة للديسكتوب */}
          <nav className="hidden md:flex items-center gap-4">
            <Button
              variant={activeTab === "apartments" ? "default" : "ghost"}
              onClick={() => setActiveTab("apartments")}
            >
              <HomeIcon className="h-4 w-4 ml-2" />
              العقارات
            </Button>
            {session.user.role === "developer" && (
              <>
                <Button
                  variant={activeTab === "users" ? "default" : "ghost"}
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="h-4 w-4 ml-2" />
                  المستخدمين
                </Button>
                <Button
                  variant={activeTab === "pending" ? "default" : "ghost"}
                  onClick={() => setActiveTab("pending")}
                >
                  <Shield className="h-4 w-4 ml-2" />
                  المراجعة
                </Button>
              </>
            )}
            <Button
              variant={activeTab === "my-apartments" ? "default" : "ghost"}
              onClick={() => setActiveTab("my-apartments")}
            >
              <Building2 className="h-4 w-4 ml-2" />
              عقاراتي
            </Button>
            <Button
              variant={activeTab === "add" ? "default" : "ghost"}
              onClick={() => setActiveTab("add")}
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة عقار
            </Button>
          </nav>
          
          {/* معلومات المستخدم وتسجيل الخروج */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              {session.user.role === "developer" && (
                <Badge className="bg-amber-500 text-white">
                  <Crown className="h-3 w-3 ml-1" />
                  مطور
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {session.user.name || session.user.email}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 ml-2" />
              خروج
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* القائمة للموبايل */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t p-4 space-y-2">
            <Button
              variant={activeTab === "apartments" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => { setActiveTab("apartments"); setMobileMenuOpen(false) }}
            >
              <HomeIcon className="h-4 w-4 ml-2" />
              العقارات
            </Button>
            {session.user.role === "developer" && (
              <>
                <Button
                  variant={activeTab === "users" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => { setActiveTab("users"); setMobileMenuOpen(false) }}
                >
                  <Users className="h-4 w-4 ml-2" />
                  المستخدمين
                </Button>
                <Button
                  variant={activeTab === "pending" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => { setActiveTab("pending"); setMobileMenuOpen(false) }}
                >
                  <Shield className="h-4 w-4 ml-2" />
                  المراجعة
                </Button>
              </>
            )}
            <Button
              variant={activeTab === "my-apartments" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => { setActiveTab("my-apartments"); setMobileMenuOpen(false) }}
            >
              <Building2 className="h-4 w-4 ml-2" />
              عقاراتي
            </Button>
            <Button
              variant={activeTab === "add" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => { setActiveTab("add"); setMobileMenuOpen(false) }}
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة عقار
            </Button>
          </div>
        )}
      </header>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* تنبيه للمستخدم المحظور */}
        {session.user.isBlocked && (
          <Alert variant="destructive" className="mb-6">
            <Ban className="h-4 w-4" />
            <AlertDescription>
              تم حظر حسابك. لا يمكنك إضافة عقارات جديدة. تواصل مع الإدارة للمزيد من المعلومات.
            </AlertDescription>
          </Alert>
        )}

        {/* تبويب العقارات */}
        {activeTab === "apartments" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">العقارات المتاحة</h2>
            {apartmentsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-4 bg-muted rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {apartmentsData?.apartments?.filter((a: ApartmentType) => 
                  session.user.role === "developer" || (a.status === "approved" && !a.isHidden)
                ).map((apartment: ApartmentType) => (
                  <ApartmentCard 
                    key={apartment.id} 
                    apartment={apartment} 
                    showActions={session.user.role === "developer"}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* تبويب المستخدمين (للمطور فقط) */}
        {activeTab === "users" && session.user.role === "developer" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">إدارة المستخدمين</h2>
            {usersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-4">
                      <div className="flex justify-between">
                        <div className="space-y-2">
                          <div className="h-5 bg-muted rounded w-48"></div>
                          <div className="h-4 bg-muted rounded w-32"></div>
                        </div>
                        <div className="h-10 bg-muted rounded w-24"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-4">
                  {usersData?.users?.map((user: UserType) => (
                    <Card key={user.id}>
                      <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{user.name || "بدون اسم"}</span>
                              {user.role === "developer" && (
                                <Badge className="bg-amber-500 text-white text-xs">
                                  <Crown className="h-3 w-3 ml-1" />
                                  مطور
                                </Badge>
                              )}
                              {user.isBlocked && (
                                <Badge variant="destructive" className="text-xs">
                                  <Ban className="h-3 w-3 ml-1" />
                                  محظور
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {user._count?.apartments || 0} عقار • 
                              انضم {new Date(user.createdAt).toLocaleDateString("ar-SA")}
                            </p>
                          </div>
                          
                          {user.role !== "developer" && (
                            <div className="flex items-center gap-2">
                              {user.isBlocked ? (
                                <>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        <Eye className="h-4 w-4 ml-2" />
                                        عرض المحتوى
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl">
                                      <DialogHeader>
                                        <DialogTitle>محتوى المستخدم المحظور</DialogTitle>
                                        <DialogDescription>
                                          يمكنك إدارة محتوى هذا المستخدم من هنا
                                        </DialogDescription>
                                      </DialogHeader>
                                      <ScrollArea className="h-96">
                                        <div className="space-y-4">
                                          {apartmentsData?.apartments?.filter((a: ApartmentType) => a.createdBy === user.id).map((apartment: ApartmentType) => (
                                            <ApartmentCard key={apartment.id} apartment={apartment} showActions />
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </DialogContent>
                                  </Dialog>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => blockUserMutation.mutate({ userId: user.id, action: "unblock" })}
                                  >
                                    فك الحظر
                                  </Button>
                                </>
                              ) : (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Ban className="h-4 w-4 ml-2" />
                                      حظر
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>حظر المستخدم</DialogTitle>
                                      <DialogDescription>
                                        هل أنت متأكد من حظر هذا المستخدم؟ سيتم إخفاء جميع عقاراته تلقائياً.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label>سبب الحظر (اختياري)</Label>
                                        <Textarea
                                          value={blockReason}
                                          onChange={(e) => setBlockReason(e.target.value)}
                                          placeholder="أدخل سبب الحظر..."
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline">إلغاء</Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => blockUserMutation.mutate({ 
                                            userId: user.id, 
                                            action: "block", 
                                            reason: blockReason 
                                          })}
                                        >
                                          تأكيد الحظر
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* تبويب المراجعة (للمطور فقط) */}
        {activeTab === "pending" && session.user.role === "developer" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">العقارات في الانتظار</h2>
            {apartmentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {apartmentsData?.apartments?.filter((a: ApartmentType) => a.status === "pending").map((apartment: ApartmentType) => (
                  <ApartmentCard key={apartment.id} apartment={apartment} showActions />
                ))}
                {apartmentsData?.apartments?.filter((a: ApartmentType) => a.status === "pending").length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    لا توجد عقارات في الانتظار
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* تبويب عقاراتي */}
        {activeTab === "my-apartments" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">عقاراتي</h2>
            {myApartmentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myApartmentsData?.apartments?.map((apartment: ApartmentType) => (
                  <ApartmentCard key={apartment.id} apartment={apartment} />
                ))}
                {myApartmentsData?.apartments?.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">لم تقم بإضافة أي عقارات بعد</p>
                    <Button onClick={() => setActiveTab("add")}>
                      <Plus className="h-4 w-4 ml-2" />
                      أضف عقارك الأول
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* تبويب إضافة عقار */}
        {activeTab === "add" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">إضافة عقار جديد</h2>
            {session.user.isBlocked ? (
              <Alert variant="destructive">
                <Ban className="h-4 w-4" />
                <AlertDescription>
                  تم حظر حسابك، لا يمكنك إضافة عقارات جديدة.
                </AlertDescription>
              </Alert>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">عنوان العقار *</Label>
                      <Input
                        id="title"
                        value={apartmentForm.title}
                        onChange={(e) => setApartmentForm({ ...apartmentForm, title: e.target.value })}
                        placeholder="مثال: شقة فاخرة للبيع"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">الوصف</Label>
                      <Textarea
                        id="description"
                        value={apartmentForm.description}
                        onChange={(e) => setApartmentForm({ ...apartmentForm, description: e.target.value })}
                        placeholder="أدخل وصفاً تفصيلياً للعقار..."
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">السعر (ريال)</Label>
                        <Input
                          id="price"
                          type="number"
                          value={apartmentForm.price}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, price: e.target.value })}
                          placeholder="مثال: 500000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="area">المساحة (م²)</Label>
                        <Input
                          id="area"
                          type="number"
                          value={apartmentForm.area}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, area: e.target.value })}
                          placeholder="مثال: 200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rooms">عدد الغرف</Label>
                        <Input
                          id="rooms"
                          type="number"
                          value={apartmentForm.rooms}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, rooms: e.target.value })}
                          placeholder="مثال: 4"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bathrooms">عدد الحمامات</Label>
                        <Input
                          id="bathrooms"
                          type="number"
                          value={apartmentForm.bathrooms}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, bathrooms: e.target.value })}
                          placeholder="مثال: 2"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type">نوع العرض</Label>
                      <Select
                        value={apartmentForm.type}
                        onValueChange={(value) => setApartmentForm({ ...apartmentForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع العرض" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sale">للبيع</SelectItem>
                          <SelectItem value="rent">للإيجار</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">المدينة</Label>
                        <Input
                          id="city"
                          value={apartmentForm.city}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, city: e.target.value })}
                          placeholder="مثال: الرياض"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">الحي</Label>
                        <Input
                          id="neighborhood"
                          value={apartmentForm.neighborhood}
                          onChange={(e) => setApartmentForm({ ...apartmentForm, neighborhood: e.target.value })}
                          placeholder="مثال: النخيل"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">العنوان التفصيلي</Label>
                      <Input
                        id="address"
                        value={apartmentForm.address}
                        onChange={(e) => setApartmentForm({ ...apartmentForm, address: e.target.value })}
                        placeholder="مثال: شارع الملك فهد، بجانب مركز الراشد"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => addApartmentMutation.mutate()}
                      disabled={addApartmentMutation.isPending || !apartmentForm.title}
                    >
                      {addApartmentMutation.isPending ? "جاري الإضافة..." : "إضافة العقار"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* الفوتر */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-medium">منطقتي</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} منطقتي - جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
