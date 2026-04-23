-- ============================================================
-- Miksir Database Schema
-- Run in Supabase SQL editor (or any PostgreSQL client)
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────
-- Extends Supabase Auth (auth.users); stores app-specific profile.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY,          -- matches auth.users.id
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  preferences JSONB NOT NULL DEFAULT '{
    "code_standard":        "EN_206",
    "default_exposure_class": "XC3",
    "unit_preference":      "metric"
  }'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── Chats ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New Concrete Design',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chats_user_id_idx       ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS chats_user_active_idx   ON public.chats(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── Messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_chat_id_idx    ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_chat_time_idx  ON public.messages(chat_id, created_at ASC)
  WHERE deleted_at IS NULL;

-- ─── Mix Designs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.designs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_id       UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  mix_design    JSONB NOT NULL,
  compliance    JSONB NOT NULL,
  justification JSONB NOT NULL,
  qa_notes      TEXT,
  field_tips    JSONB,
  input_params  JSONB,   -- full input snapshot for reproducibility
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS designs_user_id_idx  ON public.designs(user_id);
CREATE INDEX IF NOT EXISTS designs_chat_id_idx  ON public.designs(chat_id);
CREATE INDEX IF NOT EXISTS designs_user_time_idx ON public.designs(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── Code Standards (reference data) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.standards (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  region     TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Exposure Classes (reference data) ───────────────────────
CREATE TABLE IF NOT EXISTS public.exposure_classes (
  id          SERIAL PRIMARY KEY,
  standard_id TEXT NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (standard_id, code)
);

CREATE INDEX IF NOT EXISTS exposure_classes_std_idx ON public.exposure_classes(standard_id);

-- ─── Code Limits (w/c, min cement, min strength) ─────────────
CREATE TABLE IF NOT EXISTS public.code_limits (
  id              SERIAL PRIMARY KEY,
  standard_id     TEXT NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  exposure_class  TEXT NOT NULL,
  max_wc_ratio    FLOAT NOT NULL,
  min_cement      INT NOT NULL,
  min_strength    INT NOT NULL,         -- MPa characteristic
  reference       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (standard_id, exposure_class)
);

CREATE INDEX IF NOT EXISTS code_limits_lookup_idx ON public.code_limits(standard_id, exposure_class);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designs  ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own rows
CREATE POLICY users_own    ON public.users    USING (id = auth.uid());
CREATE POLICY chats_own    ON public.chats    USING (user_id = auth.uid());
CREATE POLICY messages_own ON public.messages USING (
  chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
);
CREATE POLICY designs_own  ON public.designs  USING (user_id = auth.uid());

-- Reference tables are public read
ALTER TABLE public.standards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exposure_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_limits    ENABLE ROW LEVEL SECURITY;

CREATE POLICY standards_read        ON public.standards        FOR SELECT USING (true);
CREATE POLICY exposure_classes_read ON public.exposure_classes FOR SELECT USING (true);
CREATE POLICY code_limits_read      ON public.code_limits      FOR SELECT USING (true);
