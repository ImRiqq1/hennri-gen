-- Desconto da conta por família de modelo, pra modelos cuja estimativa da Higgsfield vem
-- só como tabela cheia ("before any applicable customer discount"). Kling/Wan/MiniMax já vêm
-- com desconto no valor da API e não usam isto. Valores do console em 13/10/2026.
INSERT INTO settings (key, value) VALUES ('desconto_pct', '{"seedance":30,"genjutsu":50,"cinema":0}')
ON CONFLICT(key) DO NOTHING;
