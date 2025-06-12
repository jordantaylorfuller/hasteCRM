#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:4000"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="TestPassword123!"

echo -e "${YELLOW}=== PHASE 1 AUTHENTICATION TESTING ===${NC}\n"

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local token=$6
    
    if [ -n "$token" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
        echo "$body"
    else
        echo -e "${RED}✗${NC} $description (Expected: $expected_status, Got: $status_code)"
        FAILED=$((FAILED + 1))
        echo "$body"
    fi
    echo
}

# 1. Registration Tests
echo -e "${YELLOW}1. REGISTRATION${NC}\n"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\",\"workspaceName\":\"Test Workspace\"}")

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq .

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .accessToken)
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .refreshToken)

test_endpoint "POST" "/auth/register" \
    "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\",\"workspaceName\":\"Test Workspace\"}" \
    "409" "Prevent duplicate registration"

# 2. Email Verification Tests
echo -e "${YELLOW}2. EMAIL VERIFICATION${NC}\n"

test_endpoint "POST" "/auth/login" \
    "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    "401" "Block login before verification"

# Get verification token from Mailhog
echo "Checking Mailhog for verification email..."
MAILHOG_RESPONSE=$(curl -s "http://localhost:8025/api/v2/messages?limit=50")
echo "$MAILHOG_RESPONSE" | jq -r '.items[0].Content.Body' | grep -o 'token=[^"]*' | head -1

# For now, manually verify in database
echo -e "${YELLOW}Manually verifying user in database...${NC}"
docker exec -it crm-postgres psql -U postgres -d crm_dev -c "UPDATE \"User\" SET status = 'ACTIVE' WHERE email = '$EMAIL';" > /dev/null 2>&1

# 3. Login Tests
echo -e "${YELLOW}3. LOGIN & JWT${NC}\n"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq .

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .accessToken)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .refreshToken)

test_endpoint "POST" "/auth/me" "" "200" "Access protected route" "$ACCESS_TOKEN"

test_endpoint "POST" "/auth/refresh" "" "200" "Refresh token" "$REFRESH_TOKEN"

# 4. Google OAuth Test
echo -e "${YELLOW}4. GOOGLE OAUTH${NC}\n"

OAUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -L "$API_URL/auth/google")
if [ "$OAUTH_RESPONSE" = "200" ] || [ "$OAUTH_RESPONSE" = "302" ]; then
    echo -e "${GREEN}✓${NC} Google OAuth redirect works"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Google OAuth redirect failed"
    FAILED=$((FAILED + 1))
fi
echo

# 5. GraphQL Health Check
echo -e "${YELLOW}5. GRAPHQL${NC}\n"

test_endpoint "POST" "/graphql" \
    "{\"query\":\"{health}\"}" \
    "200" "GraphQL health check"

# 6. Rate Limiting Test
echo -e "${YELLOW}6. RATE LIMITING${NC}\n"

echo "Testing rate limiting (making 15 rapid requests)..."
RATE_LIMITED=false
for i in {1..15}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"ratelimit$i@test.com\",\"password\":\"wrong\"}")
    
    if [ "$STATUS" = "429" ]; then
        RATE_LIMITED=true
        break
    fi
done

if [ "$RATE_LIMITED" = true ]; then
    echo -e "${GREEN}✓${NC} Rate limiting is working"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗${NC} Rate limiting not working"
    FAILED=$((FAILED + 1))
fi
echo

# 7. 2FA Endpoints Check
echo -e "${YELLOW}7. TWO-FACTOR AUTHENTICATION${NC}\n"

# Check if 2FA endpoints exist
test_endpoint "POST" "/auth/2fa/setup" \
    "{\"password\":\"$PASSWORD\"}" \
    "401" "2FA setup endpoint exists (should require auth)"

# 8. Session Endpoints Check
echo -e "${YELLOW}8. SESSION MANAGEMENT${NC}\n"

test_endpoint "GET" "/auth/sessions" "" "401" "Sessions endpoint exists (should require auth)"

# 9. Password Reset
echo -e "${YELLOW}9. PASSWORD RESET${NC}\n"

test_endpoint "POST" "/auth/forgot-password" \
    "$EMAIL" \
    "200" "Password reset request"

# Summary
echo -e "${YELLOW}=== TEST SUMMARY ===${NC}\n"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
TOTAL=$((PASSED + FAILED))
PERCENTAGE=$(( (PASSED * 100) / TOTAL ))
echo -e "Total: $TOTAL (${PERCENTAGE}% pass rate)\n"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✨ All tests passed!${NC}"
else
    echo -e "${RED}⚠️  Some tests failed. Check the output above for details.${NC}"
fi