-- Notas de crédito, comunicaciones de baja y resúmenes diarios.

ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS cod_motivo VARCHAR(2) DEFAULT '01';
ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS hash_cpe TEXT;
ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS cdr_code TEXT;
ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS cdr_description TEXT;
ALTER TABLE nl_notas_credito ADD COLUMN IF NOT EXISTS provider_error JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_notas_credito_idempotency
ON nl_notas_credito (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS nl_comunicaciones_baja (
    id SERIAL PRIMARY KEY,
    comprobante_id INTEGER NOT NULL REFERENCES nl_comprobantes(id) ON DELETE RESTRICT,
    correlativo INTEGER NOT NULL,
    fecha_generacion DATE NOT NULL,
    fecha_comunicacion DATE NOT NULL,
    motivo TEXT NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'generado',
    provider_ticket TEXT,
    hash_cpe TEXT,
    cdr_code TEXT,
    cdr_description TEXT,
    provider_error JSONB,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_nl_comunicaciones_baja_idempotency UNIQUE (idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_baja_activa_por_comprobante
ON nl_comunicaciones_baja (comprobante_id)
WHERE estado IN ('generado', 'pendiente', 'aceptado');

CREATE TABLE IF NOT EXISTS nl_resumenes_diarios (
    id SERIAL PRIMARY KEY,
    fecha_resumen DATE NOT NULL,
    correlativo INTEGER NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'generado',
    provider_ticket TEXT,
    hash_cpe TEXT,
    cdr_code TEXT,
    cdr_description TEXT,
    provider_error JSONB,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_nl_resumenes_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_nl_resumen_fecha_correlativo UNIQUE (fecha_resumen, correlativo)
);

CREATE TABLE IF NOT EXISTS nl_resumen_diario_items (
    id SERIAL PRIMARY KEY,
    resumen_id INTEGER NOT NULL REFERENCES nl_resumenes_diarios(id) ON DELETE RESTRICT,
    comprobante_id INTEGER NOT NULL REFERENCES nl_comprobantes(id) ON DELETE RESTRICT,
    estado_envio VARCHAR(1) NOT NULL DEFAULT '1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_nl_resumen_item UNIQUE (resumen_id, comprobante_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_bajas_ticket ON nl_comunicaciones_baja(provider_ticket);
CREATE INDEX IF NOT EXISTS idx_nl_resumenes_ticket ON nl_resumenes_diarios(provider_ticket);
