#!/bin/bash

echo "========================================="
echo "Testing hasteCRM API - Phase 1 & Phase 2"
echo "========================================="

API_URL="http://localhost:4000"
GRAPHQL_URL="http://localhost:4000/graphql"

# Test workspace ID
WORKSPACE_ID=""
ACCESS_TOKEN=""
USER_ID=""

echo -e "\n1. Testing User Registration..."
REGISTER_RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "firstName": "Test",
    "lastName": "User",
    "workspaceName": "Test Workspace"
  }')

echo "Registration Response: $REGISTER_RESPONSE"

# Extract tokens and IDs
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
WORKSPACE_ID=$(echo $REGISTER_RESPONSE | grep -o '"workspaceId":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Access Token: $ACCESS_TOKEN"
echo "Workspace ID: $WORKSPACE_ID"
echo "User ID: $USER_ID"

echo -e "\n2. Testing User Login..."
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }')

echo "Login Response: $LOGIN_RESPONSE"

echo -e "\n3. Testing Get Current User..."
ME_RESPONSE=$(curl -s -X POST $API_URL/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Current User Response: $ME_RESPONSE"

echo -e "\n4. Testing GraphQL Health Check..."
HEALTH_RESPONSE=$(curl -s -X POST $GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "query { health }"
  }')

echo "Health Check Response: $HEALTH_RESPONSE"

echo -e "\n5. Testing Create Contact (GraphQL)..."
CREATE_CONTACT_RESPONSE=$(curl -s -X POST $GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "mutation CreateContact($input: CreateContactInput!) { createContact(input: $input) { id firstName lastName email phone title } }",
    "variables": {
      "input": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "title": "Software Engineer"
      }
    }
  }')

echo "Create Contact Response: $CREATE_CONTACT_RESPONSE"

# Extract contact ID
CONTACT_ID=$(echo $CREATE_CONTACT_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Created Contact ID: $CONTACT_ID"

echo -e "\n6. Testing Get Contacts (GraphQL)..."
GET_CONTACTS_RESPONSE=$(curl -s -X POST $GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "query { contacts { contacts { id firstName lastName email } total hasMore } }"
  }')

echo "Get Contacts Response: $GET_CONTACTS_RESPONSE"

echo -e "\n7. Testing Create Company (GraphQL)..."
CREATE_COMPANY_RESPONSE=$(curl -s -X POST $GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "mutation CreateCompany($input: CreateCompanyInput!) { createCompany(input: $input) { id name domain website } }",
    "variables": {
      "input": {
        "name": "Acme Corp",
        "domain": "acme.com",
        "website": "https://acme.com",
        "industry": "Technology"
      }
    }
  }')

echo "Create Company Response: $CREATE_COMPANY_RESPONSE"

echo -e "\n8. Testing Search Contacts (GraphQL)..."
SEARCH_CONTACTS_RESPONSE=$(curl -s -X POST $GRAPHQL_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "query": "query SearchContacts($query: String!) { searchContacts(query: $query) { contacts { id firstName lastName email } total } }",
    "variables": {
      "query": "john"
    }
  }')

echo "Search Contacts Response: $SEARCH_CONTACTS_RESPONSE"

echo -e "\n9. Testing Password Reset Request..."
FORGOT_PASSWORD_RESPONSE=$(curl -s -X POST $API_URL/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }')

echo "Forgot Password Response: $FORGOT_PASSWORD_RESPONSE"

echo -e "\n10. Testing 2FA Setup..."
TWO_FA_SETUP_RESPONSE=$(curl -s -X POST $API_URL/auth/2fa/setup \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "2FA Setup Response: $TWO_FA_SETUP_RESPONSE"

echo -e "\n========================================="
echo "Testing Complete!"
echo "========================================="