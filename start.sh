#!/bin/bash

# NutriFlow Module 3.2 - Start Script

echo "╔══════════════════════════════════════════╗"
echo "║       NutriFlow Module 3.2 Startup       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is running
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✓ PostgreSQL is running"
else
    echo "✗ PostgreSQL is not running"
    echo ""
    echo "Please start PostgreSQL first:"
    echo "  macOS: brew services start postgresql@16"
    echo "  Linux: sudo systemctl start postgresql"
    echo "  Or use Docker: docker-compose up -d postgres"
    echo ""
    exit 1
fi

# Check if database exists
if psql -U nutriflow -d nutriflow -c "SELECT 1" > /dev/null 2>&1; then
    echo "✓ Database 'nutriflow' exists"
else
    echo "✗ Database 'nutriflow' not found"
    echo "Creating database..."
    createdb -U postgres nutriflow
    psql -U postgres -c "CREATE USER nutriflow WITH PASSWORD 'nutriflow123';"
    psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE nutriflow TO nutriflow;"
fi

echo ""
echo "Installing backend dependencies..."
cd backend
npm install

echo ""
echo "Running database migrations..."
npm run migrate

echo ""
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!

cd ../frontend
echo ""
echo "Installing frontend dependencies..."
npm install

echo ""
echo "Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     NutriFlow is now running!            ║"
echo "║                                          ║"
echo "║  Frontend: http://localhost:5173         ║"
echo "║  Backend:  http://localhost:4000         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
