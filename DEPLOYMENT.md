# 🚀 Skillture — Manual Deployment Guide

> Deploy Skillture Form manually on a Linux server without Docker.

---

## Prerequisites

- **OS**: Ubuntu 22.04 LTS or Debian 12 (recommended)
- **Root Access**: You need `sudo` privileges.
- **Port 80/443**: Available for Caddy.

---

## 1. Prepare Environment

### Clone Repository (or Upload Files)
```bash
git clone <your-repo-url>
cd Skillture_Form
```

### Create Environment File
Copy the example and edit:
```bash
cp .env.example .env
nano .env
```
Ensure `POSTGRES_USER`, `POSTGRES_PASSWORD`, etc., match what you intend to use. The setup script defaults to `skillture`/`placeholder_password` for the database if created fresh, so update your `.env` accordingly.

---

## 2. Run Setup Script

The `setup.sh` script handles:
- Installing System Dependencies (Go, Node.js, PostgreSQL, Caddy)
- Creating System User (`skillture`)
- Setting up Database and Users
- Building Backend & Frontend
- Configuring Systemd Service
- Configuring Caddy Reverse Proxy

```bash
# Make script executable
chmod +x setup.sh

# Run as root/sudo
sudo ./setup.sh
```

---

## 3. Manage Application

### Backend Service
The Go backend runs as a systemd service named `skillture`.

```bash
# Check status
sudo systemctl status skillture

# Restart
sudo systemctl restart skillture

# View Logs
sudo journalctl -u skillture -f
```

### Database
PostgreSQL runs as a standard service.

```bash
# Connect to DB
sudo -u postgres psql -d skillture_form
```

### Web Server (Caddy)
Caddy serves the frontend and proxies API requests.

```bash
# Reload config
sudo systemctl reload caddy

# View logs
sudo journalctl -u caddy -f
```

---

## Update Procedure

To update the application with new code:

```bash
# 1. Pull changes
git pull origin main

# 2. Rebuild
sudo systemctl stop skillture
/usr/local/go/bin/go build -o /opt/skillture/skillture-server ./cmd/api
cd web && npm ci && npm run build && cd ..
sudo cp -r web/dist/* /opt/skillture/web/dist/

# 3. Restart
sudo systemctl start skillture
```
