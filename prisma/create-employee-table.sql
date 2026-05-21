-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS employee_profiles (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  dob         TIMESTAMP NOT NULL,
  position    TEXT NOT NULL,
  "avatarUrl" TEXT,
  role        TEXT NOT NULL DEFAULT 'BROKER',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
