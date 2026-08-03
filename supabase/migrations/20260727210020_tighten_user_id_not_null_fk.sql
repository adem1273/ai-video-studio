DELETE FROM video_projects WHERE user_id IS NULL;

ALTER TABLE video_projects ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE video_projects DROP CONSTRAINT IF EXISTS fk_video_projects_user;
ALTER TABLE video_projects ADD CONSTRAINT fk_video_projects_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
