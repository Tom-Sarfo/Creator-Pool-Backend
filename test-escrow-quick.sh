#!/bin/bash

# Quick Escrow System Test Script
# Usage: ./test-escrow-quick.sh

echo "🧪 Quick Escrow System Test"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connection configured${NC}"
echo ""

# Test 1: Check if escrow columns exist
echo "📋 Test 1: Checking escrow columns..."
ESCROW_COLS=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'pools' 
AND column_name LIKE 'escrow%';
" | xargs)

if [ "$ESCROW_COLS" -eq 5 ]; then
    echo -e "${GREEN}✅ Escrow columns exist (5 columns)${NC}"
else
    echo -e "${RED}❌ Expected 5 escrow columns, found $ESCROW_COLS${NC}"
fi

# Test 2: Check if transactions table exists
echo ""
echo "📋 Test 2: Checking transactions table..."
TRANS_TABLE=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'transactions';
" | xargs)

if [ "$TRANS_TABLE" -eq 1 ]; then
    echo -e "${GREEN}✅ Transactions table exists${NC}"
else
    echo -e "${RED}❌ Transactions table not found${NC}"
fi

# Test 3: Check transaction enums
echo ""
echo "📋 Test 3: Checking transaction enums..."
TYPE_ENUM=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM pg_type 
WHERE typname = 'transactions_type_enum';
" | xargs)

STATUS_ENUM=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM pg_type 
WHERE typname = 'transactions_status_enum';
" | xargs)

if [ "$TYPE_ENUM" -eq 1 ] && [ "$STATUS_ENUM" -eq 1 ]; then
    echo -e "${GREEN}✅ Transaction enums exist${NC}"
else
    echo -e "${RED}❌ Transaction enums missing${NC}"
fi

# Test 4: Check for any existing escrow data
echo ""
echo "📋 Test 4: Checking existing escrow data..."
ESCROW_POOLS=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM pools 
WHERE \"escrowedAmount\" > 0;
" | xargs)

if [ "$ESCROW_POOLS" -gt 0 ]; then
    echo -e "${YELLOW}ℹ️  Found $ESCROW_POOLS pools with escrowed funds${NC}"
    
    # Show summary
    psql "$DATABASE_URL" -c "
    SELECT 
      id,
      question,
      status,
      \"escrowedAmount\",
      \"escrowedCreatorPledge\",
      \"escrowedPredictorStakes\"
    FROM pools 
    WHERE \"escrowedAmount\" > 0
    LIMIT 5;
    "
else
    echo -e "${YELLOW}ℹ️  No pools with escrowed funds yet${NC}"
fi

# Test 5: Check transaction count
echo ""
echo "📋 Test 5: Checking transaction records..."
TRANS_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM transactions;
" | xargs)

echo -e "${GREEN}✅ Found $TRANS_COUNT transaction records${NC}"

if [ "$TRANS_COUNT" -gt 0 ]; then
    echo ""
    echo "Transaction summary by type:"
    psql "$DATABASE_URL" -c "
    SELECT 
      type,
      COUNT(*) as count,
      SUM(amount) as total_amount
    FROM transactions
    GROUP BY type
    ORDER BY type;
    "
fi

echo ""
echo "=========================="
echo -e "${GREEN}✅ Quick test complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start your server: npm run start:dev"
echo "2. Test API endpoints (see ESCROW_TESTING_GUIDE.md)"
echo "3. Create a pool with pledge"
echo "4. Make predictions"
echo "5. Settle a pool"


