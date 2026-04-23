#!/bin/bash

# Health Check Script for Miksir Application
# Tests if all services are running correctly

set -e

echo "🔍 Miksir Application Health Check"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:3000"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:8080"}

# Function to check URL
check_url() {
    local url=$1
    local name=$2
    
    if curl -f -s -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT running"
        return 1
    fi
}

# Check Backend
echo "Checking Backend..."
if check_url "$BACKEND_URL/health" "Backend API"; then
    BACKEND_OK=1
else
    BACKEND_OK=0
fi

echo ""

# Check Frontend
echo "Checking Frontend..."
if check_url "$FRONTEND_URL" "Frontend"; then
    FRONTEND_OK=1
else
    FRONTEND_OK=0
fi

echo ""

# Check Database (if backend is running)
if [ $BACKEND_OK -eq 1 ]; then
    echo "Checking Database Connection..."
    DB_CHECK=$(curl -s "$BACKEND_URL/api/health/db" 2>/dev/null || echo "failed")
    
    if [[ $DB_CHECK == *"ok"* ]] || [[ $DB_CHECK == *"healthy"* ]]; then
        echo -e "${GREEN}✓${NC} Database is connected"
        DB_OK=1
    else
        echo -e "${RED}✗${NC} Database connection failed"
        DB_OK=0
    fi
else
    echo -e "${YELLOW}⊘${NC} Skipping database check (backend not running)"
    DB_OK=0
fi

echo ""
echo "===================================="
echo "Summary:"

if [ $BACKEND_OK -eq 1 ] && [ $FRONTEND_OK -eq 1 ] && [ $DB_OK -eq 1 ]; then
    echo -e "${GREEN}All services are running properly! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some services are not running properly.${NC}"
    
    if [ $BACKEND_OK -eq 0 ]; then
        echo "  - Start backend: cd backend && npm start"
    fi
    
    if [ $FRONTEND_OK -eq 0 ]; then
        echo "  - Start frontend: cd frontend && python3 -m http.server 8080"
    fi
    
    if [ $DB_OK -eq 0 ]; then
        echo "  - Check database configuration and ensure PostgreSQL is running"
    fi
    
    exit 1
fi
