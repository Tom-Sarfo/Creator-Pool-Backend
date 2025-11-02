#!/bin/bash

# YouTube Connection Test Script
# Usage: ./test-youtube-connection.sh <JWT_TOKEN>

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:3000}"
TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Error: JWT token required${NC}"
  echo "Usage: ./test-youtube-connection.sh <JWT_TOKEN>"
  echo ""
  echo "Or set environment variable:"
  echo "  export API_URL=http://localhost:3000"
  echo "  ./test-youtube-connection.sh <JWT_TOKEN>"
  exit 1
fi

echo -e "${YELLOW}🧪 Testing YouTube Connection${NC}"
echo "API URL: $API_URL"
echo ""

# Test connection endpoint
echo -e "${YELLOW}Running comprehensive connection test...${NC}"
RESPONSE=$(curl -s -X GET "${API_URL}/api/youtube/test" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

# Check if request was successful
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API_URL}/api/youtube/test" \
  -H "Authorization: Bearer ${TOKEN}")

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✅ Connection test completed${NC}"
  echo ""
  
  # Parse and display results
  SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,]*' | grep -o '[^:]*$')
  MESSAGE=$(echo $RESPONSE | grep -o '"message":"[^"]*' | sed 's/"message":"//')
  DETAILS=$(echo $RESPONSE | grep -o '"details":"[^"]*' | sed 's/"details":"//')
  
  if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}$MESSAGE${NC}"
  else
    echo -e "${RED}$MESSAGE${NC}"
  fi
  
  echo ""
  echo "Details: $DETAILS"
  echo ""
  echo "Full response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  
else
  echo -e "${RED}❌ Connection test failed (HTTP $HTTP_CODE)${NC}"
  echo ""
  echo "Response:"
  echo "$RESPONSE"
fi

