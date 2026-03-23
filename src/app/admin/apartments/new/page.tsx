'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function NewApartmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    area: '',
    bedrooms: '',
    bathrooms: '',
    type: 'rent',
    status: 'available',
    ownerPhone: '',
    mapLink: '',
    images: [] as string[],
    videos: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/apartments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: parseInt(form.price),
          area: form.area,
          bedrooms: parseInt(form.bedrooms),
          bathrooms: parseInt(form.bathrooms),
          type: form.type,
          status: form.status,
          ownerPhone: form.ownerPhone,
          mapLink: form.mapLink,
          images: JSON.stringify(form.images),
          videos: JSON.stringify(form.videos),
        }),
      });

      if (response.ok) {
        toast.success('تم إضافة العقار بنجاح!');
        router.push('/admin/apartments');
      } else {
        const error = await response.json();
        toast.error(error.error || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">إضافة عقار جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* معلومات أساسية */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">المعلومات الأساسية</h3>
              
              <div>
                <Label htmlFor="title">عنوان العقار *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: شقة فاخرة في مدينة نصر"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="اكتب وصفاً تفصيلياً للعقار..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">السعر (ج.م) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="500000"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="area">المساحة (م²) *</Label>
                  <Input
                    id="area"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="150"
                    required
                  />
                </div>
              </div>
            </div>

            {/* تفاصيل العقار */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">تفاصيل العقار</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bedrooms">عدد الغرف *</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min="0"
                    value={form.bedrooms}
                    onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                    placeholder="3"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bathrooms">عدد الحمامات *</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min="0"
                    value={form.bathrooms}
                    onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                    placeholder="2"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">نوع العقار *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rent">إيجار</SelectItem>
                      <SelectItem value="sale">بيع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">الحالة</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">متاح</SelectItem>
                      <SelectItem value="reserved">محجوز</SelectItem>
                      <SelectItem value="sold">تم البيع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* معلومات الاتصال */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">معلومات الاتصال</h3>
              
              <div>
                <Label htmlFor="ownerPhone">رقم هاتف المالك *</Label>
                <Input
                  id="ownerPhone"
                  type="tel"
                  value={form.ownerPhone}
                  onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                  placeholder="+201001234567"
                  required
                />
              </div>

              <div>
                <Label htmlFor="mapLink">رابط الموقع على الخريطة</Label>
                <Input
                  id="mapLink"
                  type="url"
                  value={form.mapLink}
                  onChange={(e) => setForm({ ...form, mapLink: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>

            {/* الصور والفيديوهات */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">الصور والفيديوهات</h3>
              
              <div>
                <Label>الصور</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  ارفع حتى 5 صور للعقار (JPEG, PNG, WebP)
                </p>
                <FileUpload
                  type="image"
                  value={form.images}
                  onChange={(images) => setForm({ ...form, images })}
                  maxFiles={5}
                />
              </div>

              <div>
                <Label>الفيديوهات</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  ارفع حتى 2 فيديو للعقار (MP4, WebM)
                </p>
                <FileUpload
                  type="video"
                  value={form.videos}
                  onChange={(videos) => setForm({ ...form, videos })}
                  maxFiles={2}
                />
              </div>
            </div>

            {/* أزرار التحكم */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'جاري الحفظ...' : 'إضافة العقار'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()}
                disabled={loading}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
