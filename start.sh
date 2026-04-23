#!/bin/bash

# Miksir Application - Quick Start Script
# This script helps you get started with the application quickly

set -e

echo "🚀 Miksir Application - Quick Start"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file. Please edit it with your credentials.${NC}"
    echo ""
    echo "Required configuration:"
    echo "  - POSTGRES_PASSWORD (set a secure password)"
    echo "  - SUPABASE_URL (from your Supabase project)"
    echo "  - SUPABASE_KEY (from your Supabase project)"
    echo "  - ANTHROPIC_API_KEY (from Anthropic console)"
    echo "  - JWT_SECRET (generate a random string)"
    echo ""
    read -p "Press Enter to open .env file for editing (or Ctrl+C to exit)..."
    ${EDITOR:-nano} .env
fi

# Check if backend .env exists
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}⚠️  No backend/.env file found. Creating from template...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Created backend/.env file.${NC}"
fi

echo ""
echo "Select deployment mode:"
echo "1) Docker (recommended)"
echo "2) Local development"
echo "3) Exit"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}🐳 Starting with Docker...${NC}"
        
        # Check if Docker is installed
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
            exit 1
        fi
        
        echo "Building and starting containers..."
        docker-compose up -d --build
        
        echo ""
        echo -e "${GREEN}✅ Application started!${NC}"
        echo ""
        echo "Services:"
        echo "  - Frontend: http://localhost:8080"
        echo "  - Backend API: http://localhost:3000"
        echo "  - Database: localhost:5432"
        echo ""
        echo "Commands:"
        echo "  - View logs: docker-compose logs -f"
        echo "  - Stop: docker-compose down"
        echo "  - Restart: docker-compose restart"
        ;;
        
    2)
        echo ""
        echo -e "${GREEN}💻 Starting local development...${NC}"
        
        # Check if Node.js is installed
        if ! command -v node &> /dev/null; then
            echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
            exit 1
        fi
        
        # Check Node version
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
            exit 1
        fi
        
        # Install backend dependencies
        echo "Installing backend dependencies..."
        cd backend
        npm install
        
        echo ""
        echo -e "${YELLOW}⚠️  Make sure PostgreSQL is running and you've run schema.sql${NC}"
        echo ""
        
        # Start backend
        echo "Starting backend..."
        npm start &
        BACKEND_PID=$!
        
        cd ..
        
        # Wait a bit for backend to start
        sleep 3
        
        # Start frontend
        echo "Starting frontend..."
        cd frontend
        
        if command -v python3 &> /dev/null; then
            echo "Using Python HTTP server..."
            python3 -m http.server 8080 &
            FRONTEND_PID=$!
        elif command -v php &> /dev/null; then
            echo "Using PHP server..."
            php -S localhost:8080 &
            FRONTEND_PID=$!
        else
            echo "Installing http-server..."
            npx http-server -p 8080 &
            FRONTEND_PID=$!
        fi
        
        echo ""
        echo -e "${GREEN}✅ Application started!${NC}"
        echo ""
        echo "Services:"
        echo "  - Frontend: http://localhost:8080"
        echo "  - Backend API: http://localhost:3000"
        echo ""
        echo "Press Ctrl+C to stop all services"
        
        # Trap Ctrl+C to kill both processes
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
        
        # Wait for processes
        wait
        ;;
        
    3)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice. Exiting...${NC}"
        exit 1
        ;;
esac
