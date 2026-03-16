#!/bin/bash

# ============================================
# 🚀 سكريبت إعداد سيرفر منطقتي
# ============================================

set -e

# الألوان
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# الشعار
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║     🏠 منطقتي - إعداد السيرفر 🏠      ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# التحقق من المستخدم
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ يجب تشغيل هذا السكريبت كمستخدم root${NC}"
    exit 1
fi

# تحديث النظام
echo -e "${YELLOW}📦 تحديث النظام...${NC}"
apt update && apt upgrade -y

# تثبيت المتطلبات الأساسية
echo -e "${YELLOW}📦 تثبيت المتطلبات الأساسية...${NC}"
apt install -y curl wget git ufw fail2ban

# تثبيت Docker
echo -e "${YELLOW}🐳 تثبيت Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker $SUDO_USER
    echo -e "${GREEN}✅ تم تثبيت Docker${NC}"
else
    echo -e "${GREEN}✅ Docker مثبت بالفعل${NC}"
fi

# تثبيت Docker Compose
echo -e "${YELLOW}🐳 تثبيت Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ تم تثبيت Docker Compose${NC}"
else
    echo -e "${GREEN}✅ Docker Compose مثبت بالفعل${NC}"
fi

# تثبيت Nginx
echo -e "${YELLOW}🌐 تثبيت Nginx...${NC}"
apt install -y nginx
systemctl enable nginx
systemctl start nginx
echo -e "${GREEN}✅ تم تثبيت Nginx${NC}"

# تثبيت Certbot (لشهادات SSL)
echo -e "${YELLOW}🔒 تثبيت Certbot...${NC}"
apt install -y certbot python3-certbot-nginx
echo -e "${GREEN}✅ تم تثبيت Certbot${NC}"

# إعداد جدار الحماية
echo -e "${YELLOW}🔥 إعداد جدار الحماية...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
echo -e "${GREEN}✅ تم إعداد جدار الحماية${NC}"

# إنشاء مجلد المشروع
echo -e "${YELLOW}📁 إنشاء مجلد المشروع...${NC}"
mkdir -p /var/www/manteqti
chown -R $SUDO_USER:$SUDO_USER /var/www/manteqti
echo -e "${GREEN}✅ تم إنشاء المجلد${NC}"

# إعداد Fail2Ban
echo -e "${YELLOW}🛡️ إعداد Fail2Ban...${NC}"
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
EOF
systemctl enable fail2ban
systemctl start fail2ban
echo -e "${GREEN}✅ تم إعداد Fail2Ban${NC}"

# إنشاء ملف Nginx
echo -e "${YELLOW}📄 إنشاء إعدادات Nginx...${NC}"
cat > /etc/nginx/sites-available/manteqti << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
ln -sf /etc/nginx/sites-available/manteqti /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo -e "${GREEN}✅ تم إعداد Nginx${NC}"

# إنشاء ملف .env
echo -e "${YELLOW}⚙️ إنشاء ملف البيئة...${NC}"
cd /var/www/manteqti
if [ ! -f .env ]; then
    cat > .env << EOF
# قاعدة البيانات
DATABASE_URL=file:/app/db/production.db

# الأمان
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://YOUR_DOMAIN.com
ENCRYPTION_KEY=$(openssl rand -base64 32)

# بيانات المطور
DEVELOPER_EMAIL=ahmadmamdouh10030@gmail.com
DEVELOPER_PASSWORD=admin123
EOF
    echo -e "${GREEN}✅ تم إنشاء ملف .env${NC}"
else
    echo -e "${GREEN}✅ ملف .env موجود بالفعل${NC}"
fi

# النهاية
echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║        ✅ تم إعداد السيرفر بنجاح       ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}📋 الخطوات التالية:${NC}"
echo ""
echo -e "1. ${YELLOW}رفع المشروع:${NC}"
echo "   scp -r /path/to/manteqti root@YOUR_SERVER_IP:/var/www/manteqti"
echo ""
echo -e "2. ${YELLOW}تغيير النطاق في الملفات:${NC}"
echo "   sed -i 's/YOUR_DOMAIN.com/your-actual-domain.com/g' /etc/nginx/sites-available/manteqti"
echo "   sed -i 's/YOUR_DOMAIN.com/your-actual-domain.com/g' /var/www/manteqti/.env"
echo ""
echo -e "3. ${YELLOW}تشغيل المشروع:${NC}"
echo "   cd /var/www/manteqti && docker-compose up -d"
echo ""
echo -e "4. ${YELLOW}تثبيت شهادة SSL:${NC}"
echo "   certbot --nginx -d your-actual-domain.com"
echo ""
echo -e "${GREEN}🎉 مبروك! السيرفر جاهز للعمل${NC}"
