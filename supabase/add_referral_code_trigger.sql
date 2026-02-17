-- ============================================================
-- Referral Code Auto-Generation
--
-- Problem: The referral_code column on profiles exists but
-- nothing ever populates it. This adds:
--   1. A trigger function that generates an 8-char code on INSERT
--   2. Backfills all existing profiles that have NULL referral_code
--
-- Safe to run multiple times (uses IF NOT EXISTS / idempotent).
-- Does NOT modify any existing columns, RLS policies, or data
-- that is already set.
-- ============================================================

-- 1. Create the trigger function
--    Generates a unique 8-character lowercase hex code from uuid.
--    Only sets referral_code if it's NULL (won't overwrite existing).
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger (drop first to make this idempotent)
DROP TRIGGER IF EXISTS on_profile_insert_referral_code ON profiles;

CREATE TRIGGER on_profile_insert_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- 3. Backfill existing profiles that have NULL referral_code
UPDATE profiles
SET referral_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE referral_code IS NULL;
