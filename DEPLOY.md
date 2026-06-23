# NutriFlow Deployment Guide

## Free Stack with Cloudflare (Recommended)

### Architecture
```
User → Cloudflare CDN (SSL + Cache) → Cloudflare Pages (Frontend)
                                    → Render (Backend API)
                                    → Neon (PostgreSQL Database)
                                    → Resend (Email)
```

---

## Step 1: Database (Neon - Free)

1. Go to https://neon.tech
2. Sign up with GitHub (no credit card)
3. Create a new project
4. Copy the connection string:
   ```
   postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/nutriflow?sslmode=require
   ```
5. Save this for later

---

## Step 2: Backend (Render - Free)

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Name**: `nutriflow-api`
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm run start`
   - **Plan**: `Free`
6. Add Environment Variables:
   ```
   DATABASE_URL=your-neon-connection-string
   JWT_SECRET=generate-64-char-random-string
   FRONTEND_URL=https://nutriflow.pages.dev
   PORT=10000
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=resend
   SMTP_PASS=your-resend-api-key
   SMTP_FROM=onboarding@yourdomain.com
   ```
7. Click "Deploy"
8. Copy your Render URL: `https://nutriflow-api.onrender.com`

---

## Step 3: Frontend (Cloudflare Pages - Free)

### Option A: Git-based Deployment (Auto-deploy on push)

1. Go to https://dash.cloudflare.com → Pages
2. Click "Create a project"
3. Connect your GitHub repo
4. Configure:
   - **Project name**: `nutriflow`
   - **Production branch**: `main`
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
5. Add Environment Variable:
   ```
   VITE_API_URL = https://nutriflow-api.onrender.com
   ```
6. Click "Save and Deploy"

### Option B: Direct Upload (Manual)

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
npx wrangler login

# Build and deploy
cd frontend
npm install
npm run build
cd ..
npx wrangler pages deploy frontend/dist --project-name=nutriflow
```

Your app will be live at: `https://nutriflow.pages.dev`

---

## Step 4: Custom Domain + Cloudflare CDN (Optional)

If you have a domain in Cloudflare:

1. In Cloudflare Pages → "Custom domains"
2. Add `app.yourdomain.com`
3. Cloudflare auto-configures:
   - ✅ SSL certificate (free)
   - ✅ DDoS protection
   - ✅ Global CDN caching
   - ✅ Bot protection

---

## Step 5: Email (Resend - Free)

1. Go to https://resend.com
2. Sign up with GitHub
3. Verify your domain (or use `resend.dev` for testing)
4. Get API key
5. Add to Render environment variables:
   ```
   SMTP_PASS=your-resend-api-key
   SMTP_FROM=onboarding@yourdomain.com
   ```

---

## Step 6: Run Database Migrations

```bash
# Using Render Shell (Dashboard → Shell)
cd backend
npm run migrate

# Or locally with Neon URL
DATABASE_URL=your-neon-url npm run migrate
```

---

## Cost Breakdown

| Service | Cost | Limits |
|---------|------|--------|
| Cloudflare Pages | **$0** | Unlimited bandwidth, 1 build at a time |
| Cloudflare CDN/SSL | **$0** | Unlimited, free forever |
| Render (Backend) | **$0** | Sleeps after 15 min idle |
| Neon (Database) | **$0** | 0.5GB storage, 100 hrs/month |
| Resend (Email) | **$0** | 100 emails/day |
| **TOTAL** | **$0/month** | Perfect for starting out |

---

## Troubleshooting

### 401 Error on Login
1. Check Render logs (Dashboard → Logs)
2. Verify user exists: `SELECT * FROM users;`
3. Check CORS: `FRONTEND_URL` must match your Pages URL exactly

### CORS Errors
- Ensure `FRONTEND_URL` in Render = your Cloudflare Pages URL
- Include `https://` and no trailing slash

### Backend Sleeping (Render Free)
- First request after 15 min idle takes ~30 seconds
- Use a free uptime monitor (UptimeRobot) to ping `/health` every 14 minutes
