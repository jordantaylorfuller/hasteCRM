#!/bin/bash

echo "Starting API server..."
npm run dev --workspace=@ai-crm/api &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Check if server is running
if ! curl -s http://localhost:4000 > /dev/null; then
    echo "Server failed to start"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo -e "\n=== Testing Rate Limiting ==="

# Test login rate limit (5 requests per 15 minutes)
echo -e "\n1. Testing login rate limit (5 requests allowed)..."
for i in {1..6}; do
    echo -n "Request $i: "
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:4000/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrong"}')
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:.*" | cut -d':' -f2)
    
    if [ "$HTTP_STATUS" = "429" ]; then
        echo "Rate limited! (429)"
        BODY=$(echo "$RESPONSE" | sed -n '1,/HTTP_STATUS/p' | sed '$d')
        echo "$BODY" | jq '.message, .retryAfter' 2>/dev/null || echo "$BODY"
    else
        echo "Status: $HTTP_STATUS"
    fi
    
    sleep 0.5
done

# Test register rate limit (3 requests per hour)
echo -e "\n\n2. Testing register rate limit (3 requests allowed)..."
for i in {1..4}; do
    echo -n "Request $i: "
    RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:4000/auth/register \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"ratelimit$i@example.com\",\"password\":\"Test123\",\"firstName\":\"Rate\",\"lastName\":\"Limit\",\"workspaceName\":\"Rate Test\"}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:.*" | cut -d':' -f2)
    
    if [ "$HTTP_STATUS" = "429" ]; then
        echo "Rate limited! (429)"
        BODY=$(echo "$RESPONSE" | sed -n '1,/HTTP_STATUS/p' | sed '$d')
        echo "$BODY" | jq '.message, .retryAfter' 2>/dev/null || echo "$BODY"
    else
        echo "Status: $HTTP_STATUS"
    fi
    
    sleep 0.5
done

# Check rate limit headers
echo -e "\n\n3. Checking rate limit headers..."
HEADERS=$(curl -s -I -X POST http://localhost:4000/auth/verify-email \
    -H "Content-Type: application/json" \
    -d '{"token":"test"}')

echo "Rate limit headers:"
echo "$HEADERS" | grep -i "x-ratelimit"

# Test with authenticated user (should have different limits)
echo -e "\n\n4. Testing with authenticated user..."

# First, login to get a token
echo "Getting auth token..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"TestPassword123"}')

TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken' 2>/dev/null)

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "Testing authenticated rate limits..."
    for i in {1..3}; do
        echo -n "Authenticated request $i: "
        RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST http://localhost:4000/auth/me \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN")
        
        HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:.*" | cut -d':' -f2)
        echo "Status: $HTTP_STATUS"
    done
else
    echo "Could not get auth token for testing"
fi

# Kill the server
echo -e "\n\nStopping server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo -e "\nRate limit test complete!"