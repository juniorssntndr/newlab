-- =========================================================================
-- MIGRATION 940: PERSONALIZACIÓN VISUAL FLEXIBLE DE SECTORES DE RULETA
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS subtitulo_badge VARCHAR(60) NULL;
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS modo_visual VARCHAR(30) NOT NULL DEFAULT 'texto_icono';
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS grafico_tipo VARCHAR(30) NOT NULL DEFAULT 'auto';

-- Actualizar sectores existentes para coincidir 100% con la ruleta actual
UPDATE nl_ruleta_premios 
SET 
    modo_visual = 'solo_icono',
    grafico_tipo = 'pina',
    subtitulo_badge = NULL
WHERE tipo_premio = 'sin_premio' OR UPPER(titulo) LIKE '%PIÑA%';

UPDATE nl_ruleta_premios 
SET 
    modo_visual = 'texto_icono',
    grafico_tipo = 'auto',
    subtitulo_badge = 'DESCUENTO'
WHERE (tipo_premio IN ('porcentaje', 'monto_fijo') OR UPPER(titulo) LIKE '%DCTO%' OR UPPER(titulo) LIKE '%DESCUENTO%')
  AND subtitulo_badge IS NULL
  AND modo_visual = 'texto_icono';
