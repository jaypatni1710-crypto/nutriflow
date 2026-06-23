#!/bin/bash
# NutriFlow Module 3.2 - macOS Setup Script

echo "╔══════════════════════════════════════════╗"
echo "║     NutriFlow Module 3.2 - macOS Setup   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo ""
    echo "Please install Docker Desktop for Mac:"
    echo "  1. Visit: https://www.docker.com/products/docker-desktop/"
    echo "  2. Download for Mac (Apple Silicon or Intel)"
    echo "  3. Install and start Docker Desktop"
    echo ""
    exit 1
fi

echo "✅ Docker is installed ($(docker --version))"

# Check if docker compose is available (modern Docker uses 'docker compose' not 'docker-compose')
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose is available"
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose (legacy) is available"
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not available"
    echo "Please update Docker Desktop to the latest version"
    exit 1
fi

echo ""
echo "📦 Starting NutriFlow services..."
echo ""

# Start PostgreSQL container first
echo "🐘 Starting PostgreSQL..."
$COMPOSE_CMD up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is healthy
if $COMPOSE_CMD ps postgres | grep -q "healthy"; then
    echo "✅ PostgreSQL is healthy"
else
    echo "⚠️  Waiting a bit more for PostgreSQL..."
    sleep 5
fi

echo ""
echo "📊 Running database migrations..."
cd backend
npm install
npm run migrate

echo ""
echo "🚀 Starting backend server..."
npm run dev &
BACKEND_PID=$!

cd ../frontend
echo ""
echo "🎨 Installing frontend dependencies..."
npm install

echo ""
echo "🎨 Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     🎉 NutriFlow is now running!         ║"
echo "║                                          ║"
echo "║  🌐 Frontend: http://localhost:5173      ║"
echo "║  🔌 Backend:  http://localhost:4000      ║"
echo "║                                          ║"
echo "║  Press Ctrl+C to stop both servers       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; $COMPOSE_CMD down; exit" INT
wait
