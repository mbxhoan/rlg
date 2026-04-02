-- Copy and try this SQL script in your Supabase SQL Editor if you haven't created the table yet.

CREATE TABLE facebook_posts (
  post_id TEXT PRIMARY KEY,
  date TEXT,
  content TEXT,
  post_url TEXT,
  images TEXT[],            -- Array for image names/URLs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional) but allows anonymous scrapes if configured
-- ALTER TABLE facebook_posts ENABLE ROW LEVEL SECURITY;
