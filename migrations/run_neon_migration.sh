#!/bin/bash

# Script to run migration on Neon database
# Usage: ./migrations/run_neon_migration.sh

echo "=========================================="
echo "Neon Database Migration Runner"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not found in environment"
    echo ""
    echo "Please either:"
    echo "1. Export DATABASE_URL: export DATABASE_URL='your-neon-connection-string'"
    echo "2. Or load from .env file"
    echo ""
    read -p "Do you want to load from .env file? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f .env ]; then
            export $(grep -v '^#' .env | xargs)
            echo "✅ Loaded DATABASE_URL from .env"
        else
            echo "❌ .env file not found"
            exit 1
        fi
    else
        echo "❌ DATABASE_URL required. Exiting."
        exit 1
    fi
fi

echo "📋 Running migration: 003_add_escrow_and_transactions.sql"
echo ""

# Run the migration
psql "$DATABASE_URL" -f migrations/003_add_escrow_and_transactions.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Verifying migration..."
    psql "$DATABASE_URL" -f migrations/verify_escrow_migration.sql
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi


