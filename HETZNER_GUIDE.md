# 🚀 دليل شراء وعداد سيرفر Hetzner لمنطقتي

## الخطوة 1: إنشاء حساب Hetzner

1. اذهب إلى: https://www.hetzner.com
2. اضغط على **"Sign Up"**
3. أدخل بريدك الإلكتروني
4. أكد الحساب من الإيميل

---

## الخطوة 2: شراء السيرفر (CX22)

1. بعد الدخول، اضغط **"Order"**
2. اختر **"Cloud"** من القائمة
3. اختر **"CX22"** (5.50€/شهر)

### مواصفات CX22:
```
✅ Intel CPU - 2 vCPU
✅ 8 GB RAM
✅ 80 GB Disk
✅ 20 TB Traffic
✅ 1 IPv4 + 1 IPv6
```

4. اختر الموقع:
   - 🇩🇪 **Falkenstein** (ألمانيا) - الأفضل لأوروبا
   - 🇫🇮 **Helsinki** (فنلندا) - بديل جيد

5. اختر نظام التشغيل: **Ubuntu 22.04**

6. أضف مفتاح SSH (اختياري لكن موصى به)

7. اضغط **"Order"** وادفع

---

## الخطوة 3: الاتصال بالسيرفر

### من Windows:
```powershell
# استخدام PowerShell
ssh root@YOUR_SERVER_IP
```

### من Mac/Linux:
```bash
ssh root@YOUR_SERVER_IP
```

كلمة المرور ستجدها في بريدك أو في لوحة تحكم Hetzner

---

## الخطوة 4: إعداد السيرفر (نسخ ولصق)

### 4.1 تحديث النظام
```bash
apt update && apt upgrade -y
```

### 4.2 تثبيت Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

### 4.3 تثبيت Docker Compose
```bash
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 4.4 تثبيت Nginx
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 4.5 إعداد جدار الحماية
```bash
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
```

---

## الخطوة 5: رفع المشروع

### من جهازك المحلي:
```bash
# ضغط المشروع
cd /home/z/my-project
tar -czvf manteqti.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dev.log' \
  .

# رفع المشروع
scp manteqti.tar.gz root@YOUR_SERVER_IP:/root/
```

### على السيرفر:
```bash
# فك الضغط
mkdir -p /var/www/manteqti
tar -xzvf /root/manteqti.tar.gz -C /var/www/manteqti
cd /var/www/manteqti

# تثبيت المتطلبات
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun install

# بناء المشروع
bun run build
```

---

## الخطوة 6: تشغيل المشروع

### باستخدام Docker:
```bash
cd /var/www/manteqti
docker-compose up -d
```

### أو بدون Docker:
```bash
cd /var/www/manteqti
bun run start
```

---

## الخطوة 7: ربط النطاق (Domain)

### 7.1 أضف DNS Record
```
Type: A
Name: @
Value: YOUR_SERVER_IP
```

### 7.2 إعداد Nginx
```bash
nano /etc/nginx/sites-available/manteqti
```

أضف:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7.3 تفعيل الموقع
```bash
ln -s /etc/nginx/sites-available/manteqti /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## الخطوة 8: تثبيت شهادة SSL (مجانية)

```bash
certbot --nginx -d yourdomain.com
```

سيطلب منك:
- البريد الإلكتروني
- الموافقة على الشروط

---

## ✅ انتهيت!

الآن موقعك يعمل على:
```
https://yourdomain.com
```

---

## 💰 التكلفة الإجمالية

| البند | التكلفة |
|-------|---------|
| سيرفر Hetzner CX22 | 5.50€/شهر |
| نطاق (Domain) | 10-15$/سنة |
| **الإجمالي** | **~7$/شهر** |

---

## 🆘 في حالة المشاكل

### التحقق من حالة السيرفر:
```bash
docker ps
systemctl status nginx
```

### عرض السجلات:
```bash
docker-compose logs -f
# أو
tail -f /var/log/nginx/error.log
```

### إعادة التشغيل:
```bash
docker-compose restart
systemctl restart nginx
```
