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

echo -e "\n1. Testing Registration"
echo "----------------------"
echo "Creating new user with email: $TEST_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\",\"firstName\":\"Test\",\"lastName\":\"User\",\"workspaceName\":\"Test Workspace\"}")

if echo "$REGISTER_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Registration successful${NC}"
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')
else
    echo -e "${RED}✗ Registration failed${NC}"
    echo "Response: $REGISTER_RESPONSE"
fi

echo -e "\n2. Testing Login"
echo "---------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\"}")

if echo "$LOGIN_RESPONSE" | jq -e '.accessToken' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Login successful${NC}"
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
fi

echo -e "\n3. Testing Protected Endpoint"
echo "----------------------------"
if [ ! -z "$ACCESS_TOKEN" ]; then
    ME_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/me" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    if echo "$ME_RESPONSE" | jq -e '.email' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ /auth/me working${NC}"
        echo "User email: $(echo "$ME_RESPONSE" | jq -r '.email')"
    else
        echo -e "${RED}✗ /auth/me failed${NC}"
        echo "Response: $ME_RESPONSE"
    fi
else
    echo -e "${RED}✗ Skipped (no access token)${NC}"
fi

echo -e "\n4. Testing GraphQL"
echo "-----------------"
GRAPHQL_RESPONSE=$(curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health }"}')

if echo "$GRAPHQL_RESPONSE" | jq -e '.data.health' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GraphQL working${NC}"
    echo "Health: $(echo "$GRAPHQL_RESPONSE" | jq -r '.data.health')"
else
    echo -e "${RED}✗ GraphQL failed${NC}"
    echo "Response: $GRAPHQL_RESPONSE"
fi

echo -e "\n5. Testing Google OAuth"
echo "----------------------"
GOOGLE_REDIRECT=$(curl -s -I "$BASE_URL/auth/google" | grep -i location | cut -d' ' -f2)
if [[ "$GOOGLE_REDIRECT" == *"accounts.google.com"* ]]; then
    echo -e "${GREEN}✓ Google OAuth working${NC}"
    echo "Redirects to: ${GOOGLE_REDIRECT:0:50}..."
else
    echo -e "${RED}✗ Google OAuth failed${NC}"
fi

echo -e "\n6. Testing Validation"
echo "--------------------"
# Test empty data
EMPTY_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$EMPTY_RESPONSE" | jq -e '.statusCode' | grep -q 400; then
    echo -e "${GREEN}✓ Empty data validation working${NC}"
else
    echo -e "${RED}✗ Empty data validation failed${NC}"
fi

# Test invalid email
INVALID_EMAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"Test123456","firstName":"Test","lastName":"User","workspaceName":"Test"}')

if echo "$INVALID_EMAIL_RESPONSE" | jq -e '.statusCode' | grep -q 400; then
    echo -e "${GREEN}✓ Email validation working${NC}"
else
    echo -e "${RED}✗ Email validation failed${NC}"
fi

# Test duplicate registration
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\",\"firstName\":\"Test\",\"lastName\":\"User\",\"workspaceName\":\"Test Workspace\"}")

if echo "$DUPLICATE_RESPONSE" | jq -e '.statusCode' | grep -q 409; then
    echo -e "${GREEN}✓ Duplicate prevention working${NC}"
else
    echo -e "${RED}✗ Duplicate prevention failed${NC}"
    echo "Response: $DUPLICATE_RESPONSE"
fi

echo -e "\n========================"
echo "Test Summary Complete!"