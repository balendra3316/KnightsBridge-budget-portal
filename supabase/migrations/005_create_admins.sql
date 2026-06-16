-- Admin table for simple prototype auth
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admins (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password text not null,
  name text not null,
  created_at timestamp default now()
);

-- Seed a test admin account
INSERT INTO admins (email, password, name) VALUES
  ('admin@knightbridge.com', 'admin123', 'KB Admin');
