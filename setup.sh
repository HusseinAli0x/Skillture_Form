#!/bin/bash
set -e

# ==========================================
# Skillture Form - Manual Deployment Script
# ==========================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Skillture Deployment Setup...${NC}"

# Check for root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo${NC}"
  exit 1
fi

APP_DIR="/opt/skillture"
USER_NAME="skillture"
DB_NAME="skillture_form"
DB_USER="skillture"

# 1. Update System & Install Dependencies
echo -e "${GREEN}[1/7] Updating system and installing dependencies...${NC}"
apt-get update
apt-get install -y curl git make build-essential postgresql postgresql-contrib

# Install Go 1.22+
if ! command -v go &> /dev/null; then
    echo "Installing Go..."
    wget -q https://go.dev/dl/go1.22.1.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.22.1.linux-amd64.tar.gz
    rm go1.22.1.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
fi

# Install Node.js 20
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install Caddy
if ! command -v caddy &> /dev/null; then
    echo "Installing Caddy..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
fi

# 2. Setup Application User & Directory
echo -e "${GREEN}[2/7] Setting up application user and directory...${NC}"
if ! id "$USER_NAME" &>/dev/null; then
    useradd -r -s /bin/false $USER_NAME
fi

mkdir -p $APP_DIR
# Copy project files to /opt/skillture (assuming script is run from project root)
cp -r . $APP_DIR
chown -R $USER_NAME:$USER_NAME $APP_DIR

# Ensure .env exists
if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f "$APP_DIR/.env.example" ]; then
        echo -e "${YELLOW}No .env found, creating from .env.example...${NC}"
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        chown $USER_NAME:$USER_NAME "$APP_DIR/.env"
        echo -e "${YELLOW}IMPORTANT: You must edit /opt/skillture/.env and set valid database credentials!${NC}"
    else
        echo -e "${RED}Error: No .env or .env.example found!${NC}"
    fi
fi

# 3. Database Setup
echo -e "${GREEN}[3/7] Configuring PostgreSQL...${NC}"
# Try to install pgvector via apt, optimize for common versions
PG_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)

if apt-get install -y postgresql-$PG_VER-pgvector; then
    echo "pgvector installed via apt."
else
    echo -e "${YELLOW}pgvector package not found, attempting build from source...${NC}"
    apt-get install -y postgresql-server-dev-$PG_VER
    
    # Clone and build pgvector in a temp dir
    cd /tmp
    rm -rf pgvector
    git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
    cd pgvector
    make
    make install
    cd $APP_DIR
fi

# Create user and db if not exist
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'placeholder_password';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# 4. Build Application
echo -e "${GREEN}[4/7] Building application...${NC}"
cd $APP_DIR

# Build Backend - Fix VCS stamping erorr
echo "Building Go backend..."
# Use -buildvcs=false to avoid git permission errors when running as sudo
/usr/local/go/bin/go build -buildvcs=false -o skillture-server ./cmd/api

# Build Frontend
echo "Building React frontend..."
cd web
npm ci
npm run build
cd ..

# Fix ownership again after build
chown -R $USER_NAME:$USER_NAME $APP_DIR

# 5. Configure Systemd
echo -e "${GREEN}[5/7] Configuring Systemd service...${NC}"
cp skillture.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable skillture
systemctl restart skillture

# 6. Configure Caddy
echo -e "${GREEN}[6/7] Configuring Caddy...${NC}"
cp Caddyfile /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

echo -e "${GREEN}[7/7] Setup Complete!${NC}"
echo -e "${YELLOW}IMPORTANT: Update /opt/skillture/.env with your database password!${NC}"
echo -e "Then restart the service: ${GREEN}systemctl restart skillture${NC}"
