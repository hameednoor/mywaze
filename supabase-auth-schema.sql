-- Create allowed_users table
CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Allow all operations (app manages access via API + owner check)
CREATE POLICY "Allow all access to allowed_users"
  ON allowed_users FOR ALL
  USING (true)
  WITH CHECK (true);
