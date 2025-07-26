#!/bin/bash

echo "🔍 Verifying Phase 5 Implementation..."
echo "================================================="

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "success" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "error" ]; then
        echo -e "${RED}❌ $message${NC}"
    elif [ "$status" = "warning" ]; then
        echo -e "${YELLOW}⚠️ $message${NC}"
    elif [ "$status" = "info" ]; then
        echo -e "${BLUE}ℹ️ $message${NC}"
    fi
}

# Check if servers are running
print_status "info" "Checking server status..."

# Check backend server
curl -s http://localhost:3000/health > /dev/null
if [ $? -ne 0 ]; then
    print_status "error" "Backend server not running"
    echo ""
    echo "Please start the backend server:"
    echo "cd froopy-backend && npm start"
    exit 1
fi
print_status "success" "Backend server running on port 3000"

# Check frontend server
curl -s http://localhost:5173 > /dev/null
if [ $? -ne 0 ]; then
    print_status "error" "Frontend server not running"
    echo ""
    echo "Please start the frontend server:"
    echo "cd froopy-frontend && npm run dev"
    exit 1
fi
print_status "success" "Frontend server running on port 5173"

echo ""
print_status "info" "Testing Phase 5 API endpoints..."

# Test Gemini API
gemini_response=$(curl -s http://localhost:3000/test-gemini)
if echo "$gemini_response" | grep -q '"success":true'; then
    print_status "success" "Gemini API endpoint working"
else
    print_status "error" "Gemini API endpoint failed"
    echo "Response: $gemini_response"
fi

# Test Bot Persona Generation
persona_response=$(curl -s http://localhost:3000/test-bot-persona)
if echo "$persona_response" | grep -q '"success":true'; then
    print_status "success" "Bot persona generation working"
else
    print_status "error" "Bot persona generation failed"
    echo "Response: $persona_response"
fi

# Test Bot Activation
activation_response=$(curl -s http://localhost:3000/test-bot-activation/9999)
if echo "$activation_response" | grep -q '"success":true'; then
    print_status "success" "Bot activation working"
else
    print_status "error" "Bot activation failed"
    echo "Response: $activation_response"
fi

# Cleanup bot state
curl -s http://localhost:3000/test-bot-cleanup -X POST > /dev/null

echo ""
print_status "info" "Running comprehensive Playwright tests..."

# Change to frontend directory
cd froopy-frontend

# Run Phase 5 verification tests
npx playwright test tests/e2e/phase5-complete-verification.spec.js --reporter=list

# Check test results
test_exit_code=$?

echo ""
echo "================================================="

if [ $test_exit_code -eq 0 ]; then
    print_status "success" "All Phase 5 tests passed!"
    echo ""
    print_status "success" "Phase 5 features verified:"
    echo "  • Gemini API Integration"
    echo "  • Indian Female Bot Persona"
    echo "  • 60-Second Activation Timer"
    echo "  • Hindi/Hinglish Conversation"
    echo "  • 3-Minute Timer & Exit"
    echo "  • Bot State Management"
    echo "  • Memory Leak Prevention"
    echo "  • No Regression in Phase 1-4"
    echo ""
    print_status "success" "🎉 Phase 5 is ready for production!"
else
    print_status "error" "Some tests failed. Please review and fix."
    echo ""
    print_status "info" "Common fixes:"
    echo "  • Check server logs for errors"
    echo "  • Verify GEMINI_API_KEY in .env"
    echo "  • Ensure database is connected"
    echo "  • Clear browser cache and restart servers"
    echo ""
    exit 1
fi

echo ""
print_status "info" "You can now proceed to Phase 6 development!"
echo "Next: Minimal Friends System implementation"