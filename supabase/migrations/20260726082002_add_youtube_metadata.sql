ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS youtube_title text,
  ADD COLUMN IF NOT EXISTS youtube_description text,
  ADD COLUMN IF NOT EXISTS youtube_tags text[],
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_style text DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
