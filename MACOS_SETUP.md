# NutriFlow Module 3.2 - macOS Setup Guide

## Problem: `docker-compose` not found?

Modern Docker (v2+) uses `docker compose` (space, no hyphen). The old `docker-compose` command is deprecated.

## Quick Start for macOS

### Step 1: Install Docker Desktop

If you haven't already:
```bash
# Download from: https://www.docker.com/products/docker-desktop/
# Or use Homebrew:
brew install --cask docker
```

**Start Docker Desktop** from Applications folder or Spotlight.

### Step 2: Verify Docker

```bash
docker --version          # Should show Docker version
docker compose version    # Should show Compose version (note: SPACE not hyphen)
```

If `docker compose` doesn't work, update Docker Desktop to the latest version.

### Step 3: Start PostgreSQL

```bash
cd nutriflow

# Start only PostgreSQL container
docker compose up -d postgres

# Wait 10 seconds for it to initialize
sleep 10

# Check if it's running
docker compose ps
```

### Step 4: Configure Backend Environment

Edit `backend/.env`:
```
DATABASE_URL=postgresql://nutriflow:nutriflow123@localhost:5432/nutriflow
JWT_SECRET=nutriflow-super-secret-jwt-key-2026-min-32-chars
FRONTEND_URL=http://localhost:5173
PORT=4000

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=devante.paucek@ethereal.email
SMTP_PASS=eJ66rMdQW2nBjzg8R8
SMTP_FROM=noreply@nutriflow.app
```

### Step 5: Run Migrations & Start Backend

```bash
cd backend
npm install
npm run migrate
npm run dev
```

### Step 6: Start Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

### Step 7: Access the App

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:4000

## Alternative: Use the Start Script

```bash
cd nutriflow
./start-macos.sh
```

## Module 3.2 Features

| Feature | Location |
|---------|----------|
| Communication Log | Client Profile → "Communication" tab |
| Assessment Completion | Client Profile header + Overview card |
| Client Tags | Client Profile header + Client list cards |
| Duplicate Detection | Triggered when creating new client |
| Archive/Restore | Client Profile action bar + Client list |
| Enhanced Summary | Client Profile → Overview tab |
| Timeline Filtering | Client Profile → Timeline tab |

## Stopping Everything

```bash
# Stop frontend/backend: Ctrl+C in each terminal

# Stop PostgreSQL:
docker compose down

# Or stop and remove data:
docker compose down -v
```
