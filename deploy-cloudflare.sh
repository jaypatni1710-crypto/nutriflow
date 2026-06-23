#!/bin/bash
# NutriFlow Cloudflare Pages Deployment Script

echo "========================================"
echo "  NutriFlow → Cloudflare Pages"
echo "========================================"
echo ""

# Step 1: Build frontend
echo "[1/3] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Step 2: Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "Installing wrangler..."
    npm install -g wrangler
fi

# Step 3: Deploy to Cloudflare Pages
echo "[2/3] Deploying to Cloudflare Pages..."
npx wrangler pages deploy frontend/dist --project-name=nutriflow

echo ""
echo "[3/3] Done! Your app is live at:"
echo "  https://nutriflow.pages.dev"
echo ""
echo "========================================"
