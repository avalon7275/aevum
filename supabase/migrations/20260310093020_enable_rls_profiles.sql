-- ============================================================
-- Enable Row Level Security on profiles table
--
-- Policies:
--   1. Users can read their own profile
--   2. Users can update their own profile (referred_by only from client)
--   3. Referral code lookups go through an RPC function
--
-- Edge Functions use service_role key and bypass RLS automatically.
-- Triggers use SECURITY DEFINER and bypass RLS automatically.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Enable RLS (no-op if already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. SELECT: users can only read their own row
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 3. UPDATE: users can only update their own row
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. RPC function for referral code lookups
--    Returns the user ID for a given referral code, or NULL if not found.
--    Runs as SECURITY DEFINER so it bypasses RLS (safe because it only
--    exposes the id, never other profile data).
CREATE OR REPLACE FUNCTION lookup_referral_code(code text)
RETURNS uuid AS $$
  SELECT id FROM public.profiles
  WHERE referral_code = lower(code)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';
