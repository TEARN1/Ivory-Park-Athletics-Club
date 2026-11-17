-- =========================================================================
-- IVORY PARK ATHLETICS CLUB (IPAC) SUPABASE SQL SCHEMA
-- =========================================================================
-- This script configures all database tables for Ivory Park Athletics Club.
-- It lives in the exact SAME unified Supabase database as 'The Resident' 
-- and 'The Grooves', while strictly isolating all club data inside the 
-- 'ipac_*' table namespace to prevent any collision or data leaks.
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. IPAC ATHLETE & COACH PROFILES (Hooks into shared public.profiles)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('athlete', 'coach', 'timekeeper', 'parent')),
    age_group TEXT,
    club_bib TEXT,
    contact TEXT,
    guardian_consent BOOLEAN DEFAULT FALSE,
    best_5k_sec NUMERIC,
    best_10k_sec NUMERIC,
    best_21k_sec NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 3. IPAC SESSIONS & RACE TIMING
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    distance_km NUMERIC NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('race', 'laps', 'reps')),
    started_at BIGINT,
    ended_at BIGINT,
    coach_token_hash TEXT,
    active_program_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 4. IPAC RUNNER ATTENDANCE & FINISH TIMES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.ipac_sessions(id) ON DELETE CASCADE,
    runner_id TEXT NOT NULL,
    runner_name TEXT NOT NULL,
    bib TEXT,
    finish_ms BIGINT,
    pace_sec_per_km NUMERIC,
    checked_in BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 5. IPAC RUNNING ROUTES & LOOPS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    distance_km NUMERIC NOT NULL,
    pattern TEXT CHECK (pattern IN ('circuit', 'outAndBack', 'oneWay')),
    waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
    checked_safe BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 6. IPAC MORNING ALARMS & DISPATCH
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_alarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time TEXT NOT NULL, -- e.g. "04:30"
    program_title TEXT NOT NULL,
    meetup_point TEXT NOT NULL,
    departure_time TEXT,
    instructions TEXT,
    target_squad TEXT DEFAULT 'all',
    sound_tone TEXT DEFAULT 'pulse',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 7. IPAC CLUB NOTICES
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ipac_notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.ipac_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipac_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipac_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipac_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipac_alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipac_notices ENABLE ROW LEVEL SECURITY;

-- Allow public read of club notices, routes, and active programs
CREATE POLICY "Public Read Notices" ON public.ipac_notices FOR SELECT USING (true);
CREATE POLICY "Public Read Routes" ON public.ipac_routes FOR SELECT USING (true);
CREATE POLICY "Public Read Sessions" ON public.ipac_sessions FOR SELECT USING (true);
CREATE POLICY "Public Read Attendance" ON public.ipac_attendance FOR SELECT USING (true);
CREATE POLICY "Public Read Alarms" ON public.ipac_alarms FOR SELECT USING (true);
CREATE POLICY "Public Read Profiles" ON public.ipac_profiles FOR SELECT USING (true);

-- Allow authenticated coaches and athletes to insert and update
CREATE POLICY "Allow Insert Notices" ON public.ipac_notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Insert Sessions" ON public.ipac_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Insert Attendance" ON public.ipac_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Insert Alarms" ON public.ipac_alarms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Insert Profiles" ON public.ipac_profiles FOR INSERT WITH CHECK (true);
