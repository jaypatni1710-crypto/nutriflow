#!/bin/bash
echo "╔══════════════════════════════════════════╗"
echo "║  NutriFlow Module 3.2 - Startup Script   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  Starting PostgreSQL..."
    brew services start postgresql@16
    sleep 3
fi

echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install

echo ""
echo "📊 Running database migrations..."
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

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
