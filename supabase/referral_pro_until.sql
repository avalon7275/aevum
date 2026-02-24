-- ============================================================
-- Referral System: Free Pro Month
--
-- When a new user signs up with a referral code and referred_by
-- gets set, both the new user and the referrer automatically
-- receive 30 days of Pro access. Days stack if they already
-- have active pro_until time.
--
-- Stripe subscriptions (tier = "pro") always take priority.
-- pro_until is only checked when tier != "pro".
--
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Add pro_until column (nullable timestamp)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_until timestamptz;

-- 2. Trigger function: grant 30 days to both users when referred_by is set
CREATE OR REPLACE FUNCTION handle_referral_grant()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when referred_by changes from NULL to a value
  IF (OLD.referred_by IS NULL AND NEW.referred_by IS NOT NULL) THEN
    -- Grant 30 days to the new user (this row)
    NEW.pro_until := GREATEST(COALESCE(NEW.pro_until, NOW()), NOW()) + INTERVAL '30 days';

    -- Grant 30 days to the referrer (stacks on existing time)
    UPDATE profiles
    SET pro_until = GREATEST(COALESCE(pro_until, NOW()), NOW()) + INTERVAL '30 days',
        referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. Create trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS on_referral_set ON profiles;

CREATE TRIGGER on_referral_set
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_referral_grant();
