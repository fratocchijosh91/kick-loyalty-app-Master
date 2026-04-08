#!/bin/bash

# Kick Loyalty - Project Setup Script
# Questo script configura l'ambiente di sviluppo

set -e  # Exit on error

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Start setup
print_header "🎮 Kick Loyalty - Setup Wizard"

echo -e "\nQuesto script configura il progetto per lo sviluppo locale."
echo -e "Assicurati di avere Node.js 18+ installato.\n"

# Check Node.js
print_header "1️⃣  Verifica Node.js"
if ! command -v node &> /dev/null; then
  print_error "Node.js non trovato!"
  echo -e "\nInstalla Node.js da: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v)
print_success "Node.js $NODE_VERSION trovato"

NPM_VERSION=$(npm -v)
print_success "npm $NPM_VERSION trovato"

# Setup Backend
print_header "2️⃣  Setup Backend"

cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    print_success "File .env creato dal template"
    print_warning "Ricordati di compilare le variabili in backend/.env"
  fi
else
  print_success "File .env già esiste"
fi

print_success "Installazione dipendenze backend..."
npm install

print_success "Backend setup completato"

# Setup Frontend
print_header "3️⃣  Setup Frontend"

cd "$(dirname "$0")/frontend"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    print_success "File .env creato dal template"
  fi
else
  print_success "File .env già esiste"
fi

print_success "Installazione dipendenze frontend..."
npm install

print_success "Frontend setup completato"

# Summary
print_header "✅ Setup Completato!"

echo -e "\n${GREEN}Prossimi step:${NC}\n"

echo -e "1. ${BLUE}Configura le variabili di ambiente:${NC}"
echo -e "   - backend/.env (MongoDB, Stripe, Email, Kick API)"
echo -e "   - frontend/.env (API URL)\n"

echo -e "2. ${BLUE}Avvia i server:${NC}\n"
echo -e "   # Terminal 1 - Backend"
echo -e "   cd backend"
echo -e "   npm run dev\n"
echo -e "   # Terminal 2 - Frontend"
echo -e "   cd frontend"
echo -e "   npm run dev\n"

echo -e "3. ${BLUE}Apri il browser:${NC}"
echo -e "   http://localhost:5173\n"

echo -e "4. ${BLUE}Esegui i test (optional):${NC}"
echo -e "   cd backend"
echo -e "   npm test\n"

echo -e "${YELLOW}📖 Documentazione:${NC}"
echo -e "   - README.md - Guida completa"
echo -e "   - backend/SAAS_IMPLEMENTATION.md - Architettura"
echo -e "   - backend/API_DOCUMENTATION.md - API reference"
echo -e "   - backend/EMAIL_SETUP.md - Configurazione email\n"

echo -e "${GREEN}🚀 Ready to develop!${NC}\n"
