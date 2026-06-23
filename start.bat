@echo off
echo ==========================================
echo        NutriFlow Module 3.2 Startup
echo ==========================================
echo.

echo Installing backend dependencies...
cd backend
call npm install

echo.
echo Running database migrations...
call npm run migrate

echo.
echo Starting backend server...
start cmd /k "npm run dev"

cd ..rontend
echo.
echo Installing frontend dependencies...
call npm install

echo.
echo Starting frontend dev server...
start cmd /k "npm run dev"

echo.
echo ==========================================
echo     NutriFlow is now running!
echo.
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:4000
echo ==========================================
pause
