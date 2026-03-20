-- Adiciona a coluna objective_category para cache de inferência no momento da ingestão
-- Essa coluna evita o processamento de Regex pesados durante a leitura do Dashboard
ALTER TABLE meta_campaign_insights ADD COLUMN IF NOT EXISTS objective_category text;

COMMENT ON COLUMN meta_campaign_insights.objective_category IS 'Categoria canônica inferida (TRAFFIC, ENGAGEMENT, RECOGNITION, CONVERSIONS)';
