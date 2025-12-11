#!/usr/bin/env node

/**
 * Run database migration using Node.js
 * No need to install psql - uses the pg library
 * 
 * Usage: node migrations/run-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL not found in environment variables');
    console.error('   Make sure your .env file contains DATABASE_URL');
    process.exit(1);
  }

  console.log('📋 Running migration: 003_add_escrow_and_transactions.sql');
  console.log('');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    console.log('');

    // Read migration file
    const migrationPath = path.join(__dirname, '003_add_escrow_and_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Run migration
    console.log('🚀 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log('');

    // Run verification
    console.log('📊 Verifying migration...');
    const verifyPath = path.join(__dirname, 'verify_escrow_migration.sql');
    if (fs.existsSync(verifyPath)) {
      const verifySQL = fs.readFileSync(verifyPath, 'utf8');
      const result = await client.query(verifySQL);
      console.log('✅ Verification queries executed');
      console.log('');
      
      // Show summary if available
      if (result.rows && result.rows.length > 0) {
        console.log('📈 Summary:');
        result.rows.forEach(row => {
          console.log(`   ${JSON.stringify(row)}`);
        });
      }
    }

    console.log('');
    console.log('🎉 Migration complete! You can now restart your server.');
    console.log('   Run: npm run build && npm run start:dev');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.code === '42P07') {
      console.error('');
      console.error('ℹ️  This error usually means the table already exists.');
      console.error('   This is OK - the migration uses IF NOT EXISTS.');
    } else if (error.code === '42710') {
      console.error('');
      console.error('ℹ️  This error usually means the enum type already exists.');
      console.error('   This is OK - the migration handles this.');
    } else {
      console.error('');
      console.error('💡 Tip: Check your DATABASE_URL and database permissions.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
runMigration();


