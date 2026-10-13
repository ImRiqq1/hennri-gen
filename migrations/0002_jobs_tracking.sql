-- Fase 2: acompanhamento dos jobs.
-- last_checked_at: última consulta ao status_url (evita martelar a Higgsfield no polling).
-- attempts: tentativas de envio (reenvio por timeout usa a mesma Idempotency-Key = id).
-- estimate_basis/estimate_source: como o custo estimado foi calculado (mostrado no card).
-- endpoint/request_body_json: exatamente o que foi enviado (reenvio idêntico exige o mesmo corpo).
-- output_mime: tipo do arquivo salvo no R2.
ALTER TABLE jobs ADD COLUMN last_checked_at INTEGER;
ALTER TABLE jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN estimate_basis TEXT;
ALTER TABLE jobs ADD COLUMN estimate_source TEXT;
ALTER TABLE jobs ADD COLUMN endpoint TEXT;
ALTER TABLE jobs ADD COLUMN request_body_json TEXT;
ALTER TABLE jobs ADD COLUMN output_mime TEXT;

CREATE INDEX jobs_active_idx ON jobs (status, created_at);
