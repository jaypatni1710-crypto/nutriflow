# NutriFlow - Module 3.2

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or Docker for containerized setup)

## Quick Start (with Docker - Recommended)

```bash
# 1. Start all services
docker-compose up -d

# 2. Run database migrations
cd backend
npm run migrate

# 3. Access the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
```

## Manual Setup (without Docker)

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In psql:
CREATE DATABASE nutriflow;
CREATE USER nutriflow WITH PASSWORD 'nutriflow123';
GRANT ALL PRIVILEGES ON DATABASE nutriflow TO nutriflow;
\q
```

### 3. Configure Environment

Update `backend/.env`:
```
DATABASE_URL=postgresql://nutriflow:nutriflow123@localhost:5432/nutriflow
JWT_SECRET=nutriflow-super-secret-jwt-key-2026-min-32-chars
FRONTEND_URL=http://localhost:5173
PORT=4000
```

Update `frontend/.env`:
```
VITE_API_URL=http://localhost:4000/api/auth
```

### 4. Install Dependencies & Run

**Backend:**
```bash
cd backend
npm install
npm run migrate
npm run dev
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

### 5. Access the App

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## Module 3.2 Features

1. **Communication Log** - Track all client communications (WhatsApp, Diet Plans, Follow-ups, etc.)
2. **Assessment Completion Indicator** - Visual progress bar showing profile completion %
3. **Client Tags** - Categorize clients with tags (Weight Loss, PCOS, Diabetes, etc.)
4. **Duplicate Detection** - Warns before creating duplicate clients
5. **Archive Client** - Soft delete with archive/restore functionality
6. **Enhanced Client Summary Card** - Rich profile card with stats and medical badges
7. **Timeline Improvements** - Auto-generated events with filtering

## Database Migrations

Run migrations in order:
```bash
cd backend
npm run migrate
```

This will execute:
1. `001_create_users.sql`
2. `002_email_verification_tokens.sql`
3. `003_create_clients.sql`
4. `004_client_enhancements.sql`
5. `005_module_3_2.sql` (Module 3.2)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new dietitian
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Clients
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/:id` - Get client profile
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `POST /api/clients/:id/archive` - Archive client
- `POST /api/clients/:id/restore` - Restore client
- `POST /api/clients/check-duplicates` - Check for duplicates

### Communications
- `GET /api/clients/:id/communications` - List communications
- `POST /api/clients/:id/communications` - Add communication
- `PUT /api/clients/:id/communications/:commId` - Update communication
- `DELETE /api/clients/:id/communications/:commId` - Delete communication

### Tags
- `GET /api/clients/:id/tags` - List tags
- `POST /api/clients/:id/tags` - Add tags
- `DELETE /api/clients/:id/tags/:tag` - Remove tag

### Assessment & Timeline
- `GET /api/clients/:id/assessment-completion` - Get completion %
- `GET /api/clients/:id/summary` - Get enhanced summary
- `GET /api/clients/:id/timeline` - Get timeline
- `GET /api/clients/:id/timeline/filter` - Filtered timeline

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, Recharts, Lucide React
- **Backend:** Node.js, Express, TypeScript, PostgreSQL, JWT, Zod
- **Database:** PostgreSQL with triggers for auto timeline events
