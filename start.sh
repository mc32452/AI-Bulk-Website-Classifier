#!/bin/bash

# Startup script for the Website Classifier application
# This script starts both the Flask backend and Next.js frontend

set -e

echo "🚀 Starting Website Classifier Application"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies are installed${NC}"

# Setup Python backend
echo -e "${BLUE}Setting up Python backend...${NC}"

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -q -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating a template...${NC}"
    echo "# OpenAI API Key" > .env
    echo "OPENAI_API_KEY=your_api_key_here" >> .env
    echo -e "${YELLOW}Please edit .env and add your OpenAI API key${NC}"
fi

# Install Playwright browsers if needed
echo "Ensuring Playwright browsers are installed..."
playwright install chromium >/dev/null 2>&1 || true

# Setup Next.js frontend
echo -e "${BLUE}Setting up Next.js frontend...${NC}"
cd website-classifier

if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

cd ..

# Start services
echo -e "${BLUE}Starting services...${NC}"

# Check if ports are available
if port_in_use 5001; then
    echo -e "${YELLOW}⚠️  Port 5001 is already in use. The backend might already be running.${NC}"
else
    echo "Starting Flask backend on port 5001..."
    source venv/bin/activate
    PORT=5001 python flask_backend_enhanced.py &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
fi

if port_in_use 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use. The frontend might already be running.${NC}"
else
    echo "Starting Next.js frontend on port 3000..."
    cd website-classifier
    npm run dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    cd ..
fi

echo ""
echo -e "${GREEN}🎉 Application is starting up!${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  🐍 Backend API: ${YELLOW}http://localhost:5001${NC}"
echo -e "  ⚛️  Frontend UI: ${YELLOW}http://localhost:3000${NC}"
echo ""
echo -e "${BLUE}Quick Start:${NC}"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Enter some domains to classify"
echo "  3. Toggle 'Use Mock Data' for testing without API calls"
echo "  4. Click 'Start Classification' to begin"
echo ""
echo -e "${YELLOW}To stop the application:${NC}"
echo "  Press Ctrl+C or run: pkill -f 'flask_backend_enhanced.py' && pkill -f 'next dev'"
echo ""

# Keep script running and handle Ctrl+C
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    pkill -f 'flask_backend_enhanced.py' 2>/dev/null || true
    pkill -f 'next dev' 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

trap cleanup INT

# Wait indefinitely
echo -e "${BLUE}Application is running. Press Ctrl+C to stop.${NC}"
while true; do
    sleep 1
done
