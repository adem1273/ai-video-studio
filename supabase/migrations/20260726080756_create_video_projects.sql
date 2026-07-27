CREATE TABLE IF NOT EXISTS video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  script jsonb,
  settings jsonb,
  video_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_video_projects" ON video_projects;
CREATE POLICY "anon_select_video_projects" ON video_projects FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_video_projects" ON video_projects;
CREATE POLICY "anon_insert_video_projects" ON video_projects FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_video_projects" ON video_projects;
CREATE POLICY "anon_update_video_projects" ON video_projects FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_video_projects" ON video_projects;
CREATE POLICY "anon_delete_video_projects" ON video_projects FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_projects_updated_at ON video_projects;
CREATE TRIGGER trg_video_projects_updated_at
BEFORE UPDATE ON video_projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
