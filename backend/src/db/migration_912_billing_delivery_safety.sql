-- Seguridad de entrega para comprobantes enviados a APISPERU/SUNAT.

CREATE TABLE IF NOT EXISTS nl_correlativos (
    tipo_comprobante VARCHAR(10) NOT NULL,
    serie VARCHAR(10) NOT NULL,
    ultimo_correlativo INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tipo_comprobante, serie)
);

INSERT INTO nl_correlativos (tipo_comprobante, serie, ultimo_correlativo)
SELECT tipo_comprobante, serie, MAX(correlativo)
FROM nl_comprobantes
GROUP BY tipo_comprobante, serie
ON CONFLICT (tipo_comprobante, serie) DO UPDATE
SET ultimo_correlativo = GREATEST(
    nl_correlativos.ultimo_correlativo,
    EXCLUDED.ultimo_correlativo
),
updated_at = NOW();

ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS provider_ticket TEXT;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS provider_error JSONB;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS cdr_code TEXT;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS cdr_description TEXT;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_comprobantes_idempotency
ON nl_comprobantes (idempotency_key)
WHERE idempotency_key IS NOT NULL;
