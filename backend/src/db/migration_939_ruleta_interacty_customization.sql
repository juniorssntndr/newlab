-- =========================================================================
-- MIGRATION 939: CONFIGURACIÓN VISUAL DE RULETA ESTILO INTERACTY
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- 1. Ampliar nl_ruleta_premios con imagen de sector y textos de resultado
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS imagen_url TEXT NULL;
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS resultado_titulo TEXT NULL;
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS resultado_descripcion TEXT NULL;

-- 2. Tabla singleton para configuración visual general de la ruleta
CREATE TABLE IF NOT EXISTS nl_ruleta_config (
    id INT PRIMARY KEY DEFAULT 1,
    fondo_url TEXT NULL,
    pasador_url TEXT NULL,
    tiempo_animacion_segundos INT NOT NULL DEFAULT 4,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO nl_ruleta_config (id, tiempo_animacion_segundos) 
VALUES (1, 4) 
ON CONFLICT (id) DO NOTHING;
