#!/bin/bash

echo "🧪 Testing API Integrations"
echo "=========================="

BASE_URL="http://localhost:4000"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-${TIMESTAMP}@example.com"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing $description... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" | tail -1)
    else
        full_response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
        response=$(echo "$full_response" | tail -1)
        
        # Debug output for failed requests
        if [ "$response" != "$expected_status" ] && [ "$response" == "500" ]; then
            echo -e "\n  Error details: $(echo "$full_response" | head -n -1 | jq -r '.message // "Unknown error"' 2>/dev/null || echo "Could not parse error")"
        fi
    fi
    
    if [ "$response" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $response)"
    fi
}

echo -e "\n1. Testing Registration Endpoint"
echo "--------------------------------"
REGISTER_DATA="{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\",\"firstName\":\"Test\",\"lastName\":\"User\",\"workspaceName\":\"Test Workspace\"}"
test_endpoint "POST" "/auth/register" "$REGISTER_DATA" "201" "User Registration"

# Get tokens for authenticated requests
echo -e "\n2. Testing Login Endpoint"
echo "-------------------------"
LOGIN_DATA="{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\"}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "$LOGIN_DATA")
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

if [ "$ACCESS_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "Access Token: ${ACCESS_TOKEN:0:20}..."
else
    echo -e "${RED}✗ Login failed${NC}"
fi

echo -e "\n3. Testing Protected Endpoints"
echo "------------------------------"
# Test /auth/me with token
if [ "$ACCESS_TOKEN" != "null" ]; then
    ME_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN")
    if echo $ME_RESPONSE | jq -e '.email' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ /auth/me endpoint working${NC}"
    else
        echo -e "${RED}✗ /auth/me endpoint failed${NC}"
    fi
fi

echo -e "\n4. Testing GraphQL Endpoint"
echo "---------------------------"
GRAPHQL_RESPONSE=$(curl -s -X POST "$BASE_URL/graphql" -H "Content-Type: application/json" -d '{"query":"{ health }"}')
if echo $GRAPHQL_RESPONSE | jq -e '.data.health' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GraphQL health query working${NC}"
else
    echo -e "${RED}✗ GraphQL health query failed${NC}"
fi

echo -e "\n5. Testing Google OAuth"
echo "-----------------------"
GOOGLE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE_URL/auth/google")
if [ "$GOOGLE_RESPONSE" == "302" ]; then
    echo -e "${GREEN}✓ Google OAuth redirect working${NC}"
else
    echo -e "${RED}✗ Google OAuth redirect failed${NC}"
fi

echo -e "\n6. Testing Error Handling"
echo "-------------------------"
test_endpoint "POST" "/auth/register" "$REGISTER_DATA" "409" "Duplicate registration prevention"
test_endpoint "POST" "/auth/login" "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword\"}" "401" "Invalid password rejection"
test_endpoint "POST" "/auth/login" "{\"email\":\"nonexistent@example.com\",\"password\":\"Test123456\"}" "401" "Non-existent user rejection"
test_endpoint "POST" "/auth/me" "" "401" "Unauthorized access prevention"

echo -e "\n7. Testing Input Validation"
echo "---------------------------"
test_endpoint "POST" "/auth/register" "{}" "400" "Empty registration data"
test_endpoint "POST" "/auth/register" "{\"email\":\"invalid-email\"}" "400" "Invalid email format"
test_endpoint "POST" "/auth/login" "{}" "400" "Empty login data"

echo -e "\n=========================="
echo "API Integration Tests Complete!"