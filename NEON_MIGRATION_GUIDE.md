# Running Migration on Neon Database

## 🚀 Quick Start (Choose One Method)

### Method 1: Neon SQL Editor (Easiest - Recommended)

1. **Go to Neon Dashboard**
   - Visit: https://console.neon.tech
   - Log in and select your project

2. **Open SQL Editor**
   - Click on your database
   - Click "SQL Editor" in the left sidebar

3. **Copy and Paste Migration**
   - Open the file: `migrations/003_add_escrow_and_transactions.sql`
   - Copy ALL the SQL content
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

4. **Verify Migration**
   - Copy content from: `migrations/verify_escrow_migration.sql`
   - Paste and run in SQL Editor
   - Check that all checks pass ✅

---

### Method 2: Using Command Line (psql)

**Prerequisites:** You need `psql` installed on your machine.

1. **Get Your Connection String**
   - Go to Neon Dashboard → Your Project → Connection Details
   - Copy the connection string (it looks like: `postgresql://user:password@host/dbname?sslmode=require`)

2. **Run Migration**

   ```bash
   # Option A: Set DATABASE_URL and run
   export DATABASE_URL="your-neon-connection-string-here"
   psql "$DATABASE_URL" -f migrations/003_add_escrow_and_transactions.sql
   
   # Option B: Use the helper script
   ./migrations/run_neon_migration.sh
   ```

3. **Verify**

   ```bash
   psql "$DATABASE_URL" -f migrations/verify_escrow_migration.sql
   ```

---

### Method 3: Using Node.js Script

If you prefer to run it programmatically:

```bash
# Install pg if not already installed
npm install pg

# Then create and run a simple script
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => {
    const sql = fs.readFileSync('migrations/003_add_escrow_and_transactions.sql', 'utf8');
    return client.query(sql);
  })
  .then(() => {
    console.log('✅ Migration completed!');
    client.end();
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    client.end();
    process.exit(1);
  });
"
```

---

## 📋 Step-by-Step: Neon SQL Editor (Recommended)

### Step 1: Access Neon SQL Editor

1. Go to https://console.neon.tech
2. Select your project
3. Click on your database name
4. Click **"SQL Editor"** in the left sidebar

### Step 2: Run Migration

1. Open `migrations/003_add_escrow_and_transactions.sql` in your code editor
2. **Copy the entire file content** (all 65 lines)
3. Paste into the Neon SQL Editor
4. Click **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)

### Step 3: Check Results

You should see:
```
✅ Success: Query executed successfully
```

If you see errors, they're likely because:
- Columns already exist (safe to ignore if using `IF NOT EXISTS`)
- Enums already exist (safe to ignore)

### Step 4: Verify Migration

1. Copy content from `migrations/verify_escrow_migration.sql`
2. Paste into SQL Editor
3. Run it
4. Check the results - you should see:
   - 5 escrow columns in pools table
   - transactions table exists
   - All indexes created
   - Foreign keys set up

---

## 🔍 Verification Checklist

After running the migration, verify:

```sql
-- 1. Check escrow columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'pools' 
AND column_name LIKE 'escrow%';
-- Should return 5 rows

-- 2. Check transactions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'transactions';
-- Should return 1 row

-- 3. Check transaction enums exist
SELECT typname FROM pg_type 
WHERE typname IN ('transactions_type_enum', 'transactions_status_enum');
-- Should return 2 rows
```

---

## 🐛 Troubleshooting

### Error: "relation already exists"
- **Solution:** This is OK! The migration uses `IF NOT EXISTS` so it's safe to run multiple times.

### Error: "type already exists"
- **Solution:** The enum types already exist. This is safe to ignore.

### Error: "column already exists"
- **Solution:** The columns already exist. The migration uses `IF NOT EXISTS` so it's safe.

### Can't connect to Neon
- **Check:** Your connection string is correct
- **Check:** Your IP is allowed (Neon allows all IPs by default)
- **Check:** SSL mode is set correctly (`?sslmode=require`)

### psql not found
- **Install:** `brew install postgresql` (Mac) or download from postgresql.org
- **Or use:** Neon SQL Editor instead (no installation needed)

---

## ✅ Success Indicators

After successful migration, you should see:

1. ✅ **5 new columns** in `pools` table:
   - `escrowedAmount`
   - `escrowedCreatorPledge`
   - `escrowedPredictorStakes`
   - `platformFeeCollected`
   - `creatorRoyaltyCollected`

2. ✅ **New table** `transactions` with:
   - All required columns
   - Foreign keys to `users` and `pools`
   - Indexes on userId, poolId, type, status, createdAt

3. ✅ **Two new enum types**:
   - `transactions_type_enum`
   - `transactions_status_enum`

---

## 🎯 Next Steps

After migration is complete:

1. **Restart your server:**
   ```bash
   npm run build
   npm run start:dev
   ```

2. **Test the escrow system:**
   - Create a pool with pledge
   - Make a prediction
   - Settle the pool
   - Check transaction history

---

## 💡 Pro Tip

**For future migrations:** Always use Neon SQL Editor for quick migrations. It's the easiest and most reliable method for Neon databases.


