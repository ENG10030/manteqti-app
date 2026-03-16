#!/bin/bash
# ===========================================
# سكربت إعداد VPS لتطبيق منطقتي (Manteqti)
# ===========================================
# قم بتشغيل هذا السكربت على خادم Ubuntu 22.04 جديد

set -e

echo "🚀 بدء إعداد الخادم لمنطقتي..."

# الألوان للطباعة
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# تحديث النظام
echo -e "${YELLOW}📦 تحديث النظام...${NC}"
apt update && apt upgrade -y

# تثبيت المتطلبات الأساسية
echo -e "${YELLOW}📦 تثبيت المتطلبات الأساسية...${NC}"
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# تثبيت Node.js 20
echo -e "${YELLOW}📦 تثبيت Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# تثبيت Bun
echo -e "${YELLOW}📦 تثبيت Bun...${NC}"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# تثبيت PostgreSQL
echo -e "${YELLOW}🗄️ تثبيت PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib

# تثبيت PM2
echo -e "${YELLOW}📦 تثبيت PM2...${NC}"
npm install -g pm2

# إعداد جدار الحماية
echo -e "${YELLOW}🔒 إعداد جدار الحماية...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# إنشاء قاعدة البيانات
echo -e "${YELLOW}🗄️ إنشاء قاعدة البيانات...${NC}"
sudo -u postgres psql << 'EOF'
CREATE DATABASE manteqti;
CREATE USER manteqti_user WITH ENCRYPTED PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE manteqti TO manteqti_user;
ALTER DATABASE manteqti OWNER TO manteqti_user;
\c manteqti
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF

echo -e "${GREEN}✅ تم إنشاء قاعدة البيانات${NC}"
echo -e "${YELLOW}⚠️  تذكر: غيّر كلمة المرور في الأمر أعلاه!${NC}"

# إنشاء مجلد التطبيق
echo -e "${YELLOW}📁 إنشاء مجلد التطبيق...${NC}"
mkdir -p /var/www/manteqti
cd /var/www/manteqti

# إعداد Nginx
echo -e "${YELLOW}🌐 إعداد Nginx...${NC}"
cat > /etc/nginx/sites-available/manteqti << 'NGINX'
server {
    listen 80;
    server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;

    # إعدادات الأمان
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # تقييد حجم الملفات
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # ملفات ثابتة
    location /_next/static/ {
        alias /var/www/manteqti/.next/static/;
        expires 365d;
        access_log off;
    }

    location /public/ {
        alias /var/www/manteqti/public/;
        expires 30d;
        access_log off;
    }

    # الصحة
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
NGINX

# تفعيل الموقع
ln -sf /etc/nginx/sites-available/manteqti /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo -e "${GREEN}✅ تم إعداد Nginx${NC}"
echo -e "${YELLOW}⚠️  غيّر YOUR_DOMAIN.com إلى اسم النطاق الخاص بك${NC}"

# إنشاء ملف البيئة
echo -e "${YELLOW}📝 إنشاء ملف البيئة...${NC}"
cat > /var/www/manteqti/.env << 'ENV'
# قاعدة البيانات
DATABASE_URL="postgresql://manteqti_user:CHANGE_THIS_PASSWORD@localhost:5432/manteqti?schema=public"

# المطور
DEVELOPER_EMAIL="your-email@example.com"
DEVELOPER_PASSWORD="YOUR_SECURE_PASSWORD"

# الأمان
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="https://YOUR_DOMAIN.com"
ENV

echo -e "${GREEN}✅ تم إنشاء ملف البيئة${NC}"
echo -e "${YELLOW}⚠️  غيّر كلمات المرور والمتغيرات!${NC}"

# إنشاء سكربت النشر
cat > /var/www/manteqti/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e
cd /var/www/manteqti

echo "📥 سحب أحدث التغييرات..."
git pull origin main

echo "📦 تثبيت التبعيات..."
bun install

echo "🗄️ تحديث قاعدة البيانات..."
bun run db:push

echo "🏗️ بناء التطبيق..."
bun run build

echo "🔄 إعادة تشغيل التطبيق..."
pm2 restart manteqti || pm2 start "bun run start" --name manteqti

echo "✅ تم النشر بنجاح!"
DEPLOY

chmod +x /var/www/manteqti/deploy.sh

# إعداد النسخ الاحتياطي
echo -e "${YELLOW}💾 إعداد النسخ الاحتياطي...${NC}"
cat > /usr/local/bin/backup-manteqti << 'BACKUP'
#!/bin/bash
BACKUP_DIR="/var/backups/manteqti"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# نسخ احتياطي لقاعدة البيانات
pg_dump -U manteqti_user manteqti > $BACKUP_DIR/db_$DATE.sql

# ضغط الملفات القديمة
find $BACKUP_DIR -name "*.sql" -mtime +7 -exec gzip {} \;

# حذف النسخ القديمة (أكثر من 30 يوم)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql"
BACKUP

chmod +x /usr/local/bin/backup-manteqti

# إضافة النسخ الاحتياطي التلقائي
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-manteqti >> /var/log/manteqti-backup.log 2>&1") | crontab -

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ تم إعداد الخادم بنجاح!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}الخطوات التالية:${NC}"
echo "1. انسخ المشروع إلى /var/www/manteqti"
echo "   git clone https://github.com/USERNAME/manteqti.git /var/www/manteqti"
echo ""
echo "2. عدّل ملف البيئة:"
echo "   nano /var/www/manteqti/.env"
echo ""
echo "3. غيّر اسم النطاق في Nginx:"
echo "   nano /etc/nginx/sites-available/manteqti"
echo ""
echo "4. احصل على شهادة SSL:"
echo "   certbot --nginx -d YOUR_DOMAIN.com"
echo ""
echo "5. شغّل النشر:"
echo "   cd /var/www/manteqti && ./deploy.sh"
echo ""
echo -e "${YELLOW}⚠️  مهم: غيّر جميع كلمات المرور الافتراضية!${NC}"
