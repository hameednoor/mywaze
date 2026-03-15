-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Radars table
CREATE TABLE radars (
  id TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  road_name TEXT DEFAULT '',
  emirate TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'FRONT_FACING',
  speed_limit INTEGER NOT NULL DEFAULT 120,
  radar_type TEXT NOT NULL DEFAULT 'FIXED',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  heading_degrees DOUBLE PRECISION DEFAULT 0,
  last_verified TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom places table
CREATE TABLE custom_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security but allow all access (public app, no auth)
ALTER TABLE radars ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to radars" ON radars FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to custom_places" ON custom_places FOR ALL USING (true) WITH CHECK (true);
