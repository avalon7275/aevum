-- Add is_lifetime flag to profiles.
-- Lifetime users keep tier = "pro" and cannot be downgraded by subscription webhooks.
-- Safe to run multiple times (idempotent).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_lifetime boolean DEFAULT false;
