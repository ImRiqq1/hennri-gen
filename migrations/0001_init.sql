-- HENNRI /GEN — esquema inicial (ver BRIEFING.md, "Modelo de dados").
-- Datas em epoch ms (INTEGER). JSON guardado como TEXT.

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE presets (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  project_id       TEXT REFERENCES projects(id),
  model_id         TEXT NOT NULL,
  mode             TEXT NOT NULL,
  params_json      TEXT NOT NULL DEFAULT '{}',
  prompt_template  TEXT,
  created_at       INTEGER NOT NULL
);

-- O id do job também é a Idempotency-Key enviada à Higgsfield.
CREATE TABLE jobs (
  id                  TEXT PRIMARY KEY,
  batch_id            TEXT,
  parent_job_id       TEXT REFERENCES jobs(id),
  project_id          TEXT NOT NULL DEFAULT 'sem-projeto' REFERENCES projects(id),
  preset_id           TEXT REFERENCES presets(id),
  model_id            TEXT NOT NULL,
  mode                TEXT NOT NULL,
  prompt              TEXT,
  params_json         TEXT NOT NULL DEFAULT '{}',
  refs_json           TEXT NOT NULL DEFAULT '[]',
  -- waiting_slot → submitting → queued | in_progress | completed | failed | nsfw | canceled → saving → saved
  status              TEXT NOT NULL DEFAULT 'waiting_slot',
  hf_request_id       TEXT UNIQUE,
  hf_status_url       TEXT,
  hf_cancel_url       TEXT,
  hf_correlation_id   TEXT,
  estimated_cost_usd  REAL,
  error               TEXT,
  output_source_url   TEXT,
  output_r2_key       TEXT,
  thumb_r2_key        TEXT,
  favorite            INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  submitted_at        INTEGER,
  completed_at        INTEGER
);

CREATE INDEX jobs_status_idx     ON jobs (status);
CREATE INDEX jobs_created_idx    ON jobs (created_at DESC);
CREATE INDEX jobs_completed_idx  ON jobs (completed_at);
CREATE INDEX jobs_project_idx    ON jobs (project_id);
CREATE INDEX jobs_batch_idx      ON jobs (batch_id);

CREATE TABLE assets (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'frame')),
  r2_key         TEXT,
  hf_public_url  TEXT,
  mime           TEXT NOT NULL,
  bytes          INTEGER,
  width          INTEGER,
  height         INTEGER,
  duration_s     REAL,
  source_job_id  TEXT REFERENCES jobs(id),
  created_at     INTEGER NOT NULL
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Padrões econômicos do briefing.
INSERT INTO projects (id, name, color, archived, created_at)
VALUES ('sem-projeto', 'Sem projeto', NULL, 0, 0);

INSERT INTO settings (key, value) VALUES
  ('limite_diario_usd',     '20'),
  ('limite_mensal_usd',     '200'),
  ('confirmacao_acima_usd', '5'),
  ('concorrencia_max',      '4'),
  ('cotacao_brl',           '5.40'),
  ('padrao_resolucao',      '"720p"'),
  ('padrao_proporcao',      '"16:9"'),
  ('padrao_duracao',        '5'),
  ('padrao_audio',          'false');
