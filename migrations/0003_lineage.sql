-- Fase 5: linhagem. parent_job_id já existe; aqui entra o tipo da relação
-- (refeito, editado, estendido, continuação, referência, genjutsu).
ALTER TABLE jobs ADD COLUMN parent_relation TEXT;
UPDATE jobs SET parent_relation = 'refeito' WHERE parent_job_id IS NOT NULL AND parent_relation IS NULL;
CREATE INDEX jobs_parent_idx ON jobs (parent_job_id);
