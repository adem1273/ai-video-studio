ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_video_projects_user_id ON video_projects (user_id);

DROP POLICY IF EXISTS "anon_select_video_projects" ON video_projects;
DROP POLICY IF EXISTS "anon_insert_video_projects" ON video_projects;
DROP POLICY IF EXISTS "anon_update_video_projects" ON video_projects;
DROP POLICY IF EXISTS "anon_delete_video_projects" ON video_projects;

CREATE POLICY "select_own_video_projects" ON video_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_video_projects" ON video_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_video_projects" ON video_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_video_projects" ON video_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
