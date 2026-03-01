-- Migration 906: Facturación — Notas de Crédito y mejoras de Anulación
-- Run this against your Supabase/PostgreSQL database

-- 1. Columna motivo_anulacion en nl_comprobantes
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

-- 2. Tabla nl_notas_credito
CREATE TABLE IF NOT EXISTS nl_notas_credito (
    id                  SERIAL PRIMARY KEY,
    comprobante_id      INTEGER NOT NULL REFERENCES nl_comprobantes(id) ON DELETE CASCADE,
    serie               VARCHAR(10) NOT NULL,
    correlativo         INTEGER NOT NULL,
    tipo_doc_ref        VARCHAR(5) NOT NULL,  -- '01' o '03'
    motivo              TEXT NOT NULL,
    monto               NUMERIC(12, 2) NOT NULL,
    igv                 NUMERIC(12, 2) DEFAULT 0,
    base_imponible      NUMERIC(12, 2) DEFAULT 0,
    estado_sunat        VARCHAR(50) DEFAULT 'generado',
    xml_url             TEXT,
    pdf_url             TEXT,
    cdr_url             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT nl_notas_credito_unique UNIQUE (serie, correlativo)
);

-- 3. Trigger updated_at para nl_notas_credito
DROP TRIGGER IF EXISTS trg_nl_notas_credito_updated_at ON nl_notas_credito;
CREATE TRIGGER trg_nl_notas_credito_updated_at
    BEFORE UPDATE ON nl_notas_credito
    FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

-- 4. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_nl_notas_credito_comprobante ON nl_notas_credito(comprobante_id);
CREATE INDEX IF NOT EXISTS idx_nl_comprobantes_fecha ON nl_comprobantes(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_nl_comprobantes_tipo ON nl_comprobantes(tipo_comprobante);
