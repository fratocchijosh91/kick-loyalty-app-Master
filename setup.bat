@echo off
setlocal enabledelayedexpansion

REM Kick Loyalty - Project Setup Script (Windows)
REM Questo script configura l'ambiente di sviluppo

title Kick Loyalty - Setup Wizard

echo.
echo ========================================
echo 🎮 Kick Loyalty - Setup Wizard
echo ========================================
echo.
echo Questo script configura il progetto per lo sviluppo locale.
echo Assicurati di avere Node.js 18+ installato.
echo.

REM Check Node.js
echo ========================================
echo 1️⃣  Verifica Node.js
echo ========================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ✗ Node.js non trovato!
  echo.
  echo Installa Node.js da: https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% trovato

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✓ npm %NPM_VERSION% trovato

REM Setup Backend
echo.
echo ========================================
echo 2️⃣  Setup Backend
echo ========================================

cd backend

if not exist ".env" (
  if exist ".env.example" (
    copy .env.example .env > nul
    echo ✓ File .env creato dal template
    echo ⚠ Ricordati di compilare le variabili in backend\.env
  )
) else (
  echo ✓ File .env già esiste
)

echo ✓ Installazione dipendenze backend...
call npm install

if %errorlevel% neq 0 (
  echo ✗ Errore nell'installazione backend
  pause
  exit /b 1
)

echo ✓ Backend setup completato

REM Setup Frontend
echo.
echo ========================================
echo 3️⃣  Setup Frontend
echo ========================================

cd ..\frontend

if not exist ".env" (
  if exist ".env.example" (
    copy .env.example .env > nul
    echo ✓ File .env creato dal template
  )
) else (
  echo ✓ File .env già esiste
)

echo ✓ Installazione dipendenze frontend...
call npm install

if %errorlevel% neq 0 (
  echo ✗ Errore nell'installazione frontend
  pause
  exit /b 1
)

echo ✓ Frontend setup completato

REM Summary
echo.
echo ========================================
echo ✅ Setup Completato!
echo ========================================
echo.

echo Prossimi step:
echo.
echo 1. Configura le variabili di ambiente:
echo    - backend\.env ^(MongoDB, Stripe, Email, Kick API^)
echo    - frontend\.env ^(API URL^)
echo.

echo 2. Avvia i server:
echo.
echo    REM Terminal 1 - Backend
echo    cd backend
echo    npm run dev
echo.
echo    REM Terminal 2 - Frontend
echo    cd frontend
echo    npm run dev
echo.

echo 3. Apri il browser:
echo    http://localhost:5173
echo.

echo 4. Esegui i test ^(optional^):
echo    cd backend
echo    npm test
echo.

echo 📖 Documentazione:
echo    - README.md - Guida completa
echo    - backend\SAAS_IMPLEMENTATION.md - Architettura
echo    - backend\API_DOCUMENTATION.md - API reference
echo    - backend\EMAIL_SETUP.md - Configurazione email
echo.

echo 🚀 Ready to develop!
echo.

pause
