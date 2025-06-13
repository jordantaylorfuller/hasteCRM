#!/bin/bash

echo "========================================="
echo "Testing Phase 1 - Authentication Features"
echo "========================================="

API_URL="http://localhost:4000"

# Test 1: Register a new user
echo ""
echo "1. Testing User Registration..."
TIMESTAMP=$(date +%s)
EMAIL="test${TIMESTAMP}@example.com"

REGISTER_RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Test123456!\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"workspaceName\": \"Test Workspace\"
  }")

if [[ $REGISTER_RESPONSE == *"accessToken"* ]]; then
  echo "✅ Registration successful"
  ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
  REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)
  echo "Email: $EMAIL"
  echo "Access token received: ${ACCESS_TOKEN:0:20}..."
else
  echo "❌ Registration failed: $REGISTER_RESPONSE"
fi

# Test 2: Login with credentials
echo ""
echo "2. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"Test123456!\"
  }")

if [[ $LOGIN_RESPONSE == *"accessToken"* ]]; then
  echo "✅ Login successful"
else
  echo "❌ Login failed: $LOGIN_RESPONSE"
fi

# Test 3: Get current user
echo ""
echo "3. Testing Get Current User..."
ME_RESPONSE=$(curl -s -X POST $API_URL/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $ME_RESPONSE == *"email"* ]]; then
  echo "✅ Get current user successful"
  echo "User data: $(echo $ME_RESPONSE | grep -o '"email":"[^"]*"' | head -1)"
else
  echo "❌ Get current user failed: $ME_RESPONSE"
fi

# Test 4: Refresh token
echo ""
echo "4. Testing Token Refresh..."
REFRESH_RESPONSE=$(curl -s -X POST $API_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

if [[ $REFRESH_RESPONSE == *"accessToken"* ]]; then
  echo "✅ Token refresh successful"
  NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
else
  echo "❌ Token refresh failed: $REFRESH_RESPONSE"
fi

# Test 5: Password reset request
echo ""
echo "5. Testing Password Reset Request..."
FORGOT_RESPONSE=$(curl -s -X POST $API_URL/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\"
  }")

echo "Password reset response: $FORGOT_RESPONSE"
if [[ $FORGOT_RESPONSE == *"reset link has been sent"* ]] || [[ $FORGOT_RESPONSE == *"If the email exists"* ]]; then
  echo "✅ Password reset request processed"
  echo "Note: Check Mailhog at http://localhost:8025 for reset email"
fi

# Test 6: 2FA Setup
echo ""
echo "6. Testing 2FA Setup..."
TFA_SETUP_RESPONSE=$(curl -s -X POST $API_URL/auth/2fa/setup \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $TFA_SETUP_RESPONSE == *"qrCode"* ]]; then
  echo "✅ 2FA setup successful"
  SECRET=$(echo $TFA_SETUP_RESPONSE | grep -o '"secret":"[^"]*' | cut -d'"' -f4)
  echo "2FA Secret generated: ${SECRET:0:10}..."
else
  echo "❌ 2FA setup failed: $TFA_SETUP_RESPONSE"
fi

# Test 7: Session management
echo ""
echo "7. Testing Session Management..."
SESSIONS_RESPONSE=$(curl -s -X GET $API_URL/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $SESSIONS_RESPONSE == *"["* ]] || [[ $SESSIONS_RESPONSE == *"sessions"* ]]; then
  echo "✅ Get sessions successful"
else
  echo "❌ Get sessions failed: $SESSIONS_RESPONSE"
fi

# Test 8: Logout
echo ""
echo "8. Testing Logout..."
LOGOUT_RESPONSE=$(curl -s -X POST $API_URL/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $LOGOUT_RESPONSE == *"success"* ]] || [[ -z "$LOGOUT_RESPONSE" ]] || [[ $LOGOUT_RESPONSE == "{}" ]]; then
  echo "✅ Logout successful"
else
  echo "❌ Logout failed: $LOGOUT_RESPONSE"
fi

# Test 9: Verify logout worked
echo ""
echo "9. Testing Access After Logout..."
ME_AFTER_LOGOUT=$(curl -s -X POST $API_URL/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [[ $ME_AFTER_LOGOUT == *"Unauthorized"* ]]; then
  echo "✅ Access correctly denied after logout"
else
  echo "❌ Access should be denied after logout: $ME_AFTER_LOGOUT"
fi

echo ""
echo "========================================="
echo "Phase 1 Testing Complete!"
echo "========================================="