-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS property_owners (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  phone2        TEXT,
  email         TEXT,
  company       TEXT,
  address       TEXT,
  locality      TEXT,
  "cardImageUrl" TEXT,
  notes         TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add ownerId to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "ownerId" TEXT REFERENCES property_owners(id);
