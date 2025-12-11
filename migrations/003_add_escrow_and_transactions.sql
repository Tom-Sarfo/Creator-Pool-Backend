-- Migration: Add escrow fields to pools table and create transactions table
-- Date: 2024

-- Add escrow fields to pools table
ALTER TABLE "pools"
  ADD COLUMN IF NOT EXISTS "escrowedAmount" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escrowedCreatorPledge" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escrowedPredictorStakes" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "platformFeeCollected" numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creatorRoyaltyCollected" numeric(10,2) NOT NULL DEFAULT 0;

-- Create transaction type enum
DO $$ BEGIN
  CREATE TYPE "public"."transactions_type_enum" AS ENUM(
    'deposit',
    'withdrawal',
    'stake',
    'pledge',
    'winnings',
    'royalty',
    'platform_fee',
    'refund'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create transaction status enum
DO $$ BEGIN
  CREATE TYPE "public"."transactions_status_enum" AS ENUM(
    'pending',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create transactions table
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL,
  "poolId" uuid,
  "type" "public"."transactions_type_enum" NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'completed',
  "description" text,
  "reference" character varying,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
  CONSTRAINT "FK_transactions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_transactions_pool" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_transactions_userId" ON "transactions" ("userId");
CREATE INDEX IF NOT EXISTS "IDX_transactions_poolId" ON "transactions" ("poolId");
CREATE INDEX IF NOT EXISTS "IDX_transactions_type" ON "transactions" ("type");
CREATE INDEX IF NOT EXISTS "IDX_transactions_status" ON "transactions" ("status");
CREATE INDEX IF NOT EXISTS "IDX_transactions_createdAt" ON "transactions" ("createdAt");

-- Add comment to transactions table
COMMENT ON TABLE "transactions" IS 'Tracks all financial transactions including escrow deposits, withdrawals, and distributions';


