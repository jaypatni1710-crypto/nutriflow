# NutriFlow — Cloudflare Workers Deployment Guide

## What changed from the Express backend

| Original (Render/Node.js) | Cloudflare Worker |
|---|---|
| `express` | `hono` |
| `bcrypt` | Web Crypto API (PBKDF2) |
| `jsonwebtoken` | `jose` |
| `nodemailer` + SMTP | Resend HTTP API |
| `pg` (direct TCP) | `pg` via Hyperdrive |
| `multer` + disk | Cloudflare R2 |
| `express-rate-limit` | Cloudflare KV |

---

## Step 1 — Prerequisites

```bash
npm install -g wrangler
wrangler login
```

---

## Step 2 — Create KV namespace (rate limiting)

```bash
wrangler kv namespace create RATE_LIMIT_KV
wrangler kv namespace create RATE_LIMIT_KV --preview
```

Copy the IDs printed and paste them into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "PASTE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"
```

---

## Step 3 — Create Hyperdrive (connects to your existing Postgres DB)

Your existing Neon / Supabase / Railway Postgres keeps working — Hyperdrive just proxies it.

```bash
wrangler hyperdrive create nutriflow-db \
  --connection-string="postgresql://USER:PASS@HOST:5432/DBNAME"
```

Copy the ID and paste into `wrangler.toml`:
```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "PASTE_HYPERDRIVE_ID_HERE"
```

---

## Step 4 — Set secrets

```bash
wrangler secret put JWT_SECRET
# paste a random 32+ char string

wrangler secret put RESEND_API_KEY
# sign up free at resend.com → API Keys → Create Key
# free tier: 3,000 emails/month

wrangler secret put FRONTEND_URL
# e.g. https://nutriflow.pages.dev
# or multiple: https://nutriflow.pages.dev,https://your-custom-domain.com
```

---

## Step 5 — Install dependencies & deploy

```bash
cd nutriflow-worker
npm install
npm run deploy
```

Your API will be live at:
`https://nutriflow-api.YOUR-SUBDOMAIN.workers.dev`

---

## Step 6 — Update your frontend .env

In `frontend/.env` (or Cloudflare Pages env vars):
```
VITE_API_URL=https://nutriflow-api.YOUR-SUBDOMAIN.workers.dev
```

Redeploy your Cloudflare Pages frontend.

---

## Step 7 (Optional) — R2 for file uploads

Lab reports and progress photos need R2 (Cloudflare's S3-compatible storage):

```bash
wrangler r2 bucket create nutriflow-files
```

Add to `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "FILES_BUCKET"
bucket_name = "nutriflow-files"
```

Then redeploy. Without this, file upload endpoints return `501` but all other routes work fine.

---

## ⚠️ Password hash migration note

The Worker uses **PBKDF2** instead of bcrypt (bcrypt requires native binaries unsupported in Workers).

**New registrations work immediately.**

**Existing users** with bcrypt hashes ($2b$...) will get `INVALID_CREDENTIALS` on login.
To migrate, run this one-time script on your old Render server (Node.js):

```js
// run with: node migrate-passwords.js
// It emails every user a "reset your password" link so they set a new PBKDF2 hash
const { Pool } = require('pg');
const db = new Pool({ connectionString: process.env.DATABASE_URL });
// ... call your /api/auth/forgot-password for each user
```

Or simpler: use the Admin panel to email a password reset to all existing users.

---

## Free tier limits (Cloudflare)

| Resource | Free limit |
|---|---|
| Workers requests | 100,000 / day |
| KV reads | 100,000 / day |
| KV writes | 1,000 / day |
| Hyperdrive | Included with Workers paid ($5/mo) — free trial available |
| R2 storage | 10 GB free |
| R2 operations | 1M reads / 10M writes free |

> Hyperdrive requires **Workers Paid** plan ($5/month). Without it, use the `DATABASE_URL` env var with a direct pg connection (but you lose connection pooling). For a dietitian practice this is very worth it.
