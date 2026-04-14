#!/bin/bash
# ===========================================
# VPS Setup Script for Signalmash Connect
# ===========================================
# Run on Ubuntu VPS as root or with sudo
#
# Usage: sudo bash setup-vps.sh

set -e

echo "=== Signalmash Connect VPS Setup ==="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/signalmash"
NODE_VERSION="20"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo bash setup-vps.sh)${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Update system packages${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Step 2: Install required packages${NC}"
apt install -y curl git nginx certbot python3-certbot-nginx

echo -e "${YELLOW}Step 3: Install Node.js ${NODE_VERSION}${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
else
    echo "Node.js already installed: $(node -v)"
fi

echo -e "${YELLOW}Step 4: Install pnpm${NC}"
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
else
    echo "pnpm already installed: $(pnpm -v)"
fi

echo -e "${YELLOW}Step 5: Install PM2${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 already installed: $(pm2 -v)"
fi

echo -e "${YELLOW}Step 6: Install PostgreSQL${NC}"
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    echo -e "${GREEN}PostgreSQL installed. Configure database manually.${NC}"
else
    echo "PostgreSQL already installed"
fi

echo -e "${YELLOW}Step 7: Install Redis${NC}"
if ! command -v redis-server &> /dev/null; then
    apt install -y redis-server
    systemctl start redis-server
    systemctl enable redis-server
else
    echo "Redis already installed"
fi

echo -e "${YELLOW}Step 8: Create app directory${NC}"
mkdir -p ${APP_DIR}
mkdir -p ${APP_DIR}/logs

echo -e "${YELLOW}Step 9: Setup PM2 startup${NC}"
pm2 startup systemd -u root --hp /root
pm2 save

echo ""
echo -e "${GREEN}=== Base setup complete! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository to ${APP_DIR}"
echo "2. Configure .env in packages/server/.env"
echo "3. Run: cd ${APP_DIR} && pnpm install"
echo "4. Run: pnpm build"
echo "5. Setup PostgreSQL database:"
echo "   sudo -u postgres psql"
echo "   CREATE USER signalmash WITH PASSWORD 'your_password';"
echo "   CREATE DATABASE signalmash OWNER signalmash;"
echo "   \\q"
echo "6. Run database migrations: cd packages/server && pnpm db:push"
echo "7. Copy and configure Nginx: see deploy/nginx.conf"
echo "8. Get SSL: sudo certbot --nginx -d your-api-domain -d your-app-domain"
echo "9. Start app: pm2 start ecosystem.config.cjs --env production"
echo ""
