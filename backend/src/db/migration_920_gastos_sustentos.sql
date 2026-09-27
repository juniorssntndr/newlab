-- Migration 920: Gastos y sustentos (Fiscal, Simple, Ninguno)
-- Extiende nl_fin_movimientos con metadatos de sustento y beneficiario

ALTER TABLE nl_fin_movimientos
    ADD COLUMN IF NOT EXISTS beneficiario VARCHAR(200),
    ADD COLUMN IF NOT EXISTS sustento_tipo VARCHAR(20) NOT NULL DEFAULT 'ninguno',
    ADD COLUMN IF NOT EXISTS sustento_comprobante_tipo VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sustento_emisor_doc VARCHAR(20),
    ADD COLUMN IF NOT EXISTS sustento_emisor_razon_social VARCHAR(200),
    ADD COLUMN IF NOT EXISTS sustento_serie VARCHAR(20),
    ADD COLUMN IF NOT EXISTS sustento_numero VARCHAR(30),
    ADD COLUMN IF NOT EXISTS sustento_fecha_emision DATE,
    ADD COLUMN IF NOT EXISTS sustento_archivo_url TEXT,
    ADD COLUMN IF NOT EXISTS sustento_nota TEXT,
    ADD COLUMN IF NOT EXISTS sustento_observacion TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'nl_fin_movimientos_sustento_tipo_check'
    ) THEN
        ALTER TABLE nl_fin_movimientos
            ADD CONSTRAINT nl_fin_movimientos_sustento_tipo_check
            CHECK (sustento_tipo IN ('fiscal', 'simple', 'ninguno'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_sustento ON nl_fin_movimientos(sustento_tipo);
