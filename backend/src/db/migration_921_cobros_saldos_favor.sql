-- Migration 921: Cobros y Saldos a Favor de Clínicas
-- Permite cobros a cuenta de clínica (sin pedido inicial) y aplicaciones posteriores

ALTER TABLE nl_pagos
    ALTER COLUMN pedido_id DROP NOT NULL;

ALTER TABLE nl_pagos
    ADD COLUMN IF NOT EXISTS clinica_id INTEGER REFERENCES nl_clinicas(id),
    ADD COLUMN IF NOT EXISTS es_saldo_favor BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS saldo_disponible NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Backfill clinica_id en pagos existentes a partir de su pedido
UPDATE nl_pagos p
SET clinica_id = ped.clinica_id
FROM nl_pedidos ped
WHERE p.pedido_id = ped.id AND p.clinica_id IS NULL;

-- Tabla para el historial de aplicaciones de saldo a favor a pedidos
CREATE TABLE IF NOT EXISTS nl_saldo_favor_aplicaciones (
    id SERIAL PRIMARY KEY,
    pago_origen_id INTEGER NOT NULL REFERENCES nl_pagos(id) ON DELETE RESTRICT,
    pedido_destino_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE RESTRICT,
    clinica_id INTEGER NOT NULL REFERENCES nl_clinicas(id),
    monto_aplicado NUMERIC(10, 2) NOT NULL CHECK (monto_aplicado > 0),
    fecha_aplicacion DATE NOT NULL DEFAULT CURRENT_DATE,
    notas TEXT,
    creado_por INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nl_saldo_favor_origen ON nl_saldo_favor_aplicaciones(pago_origen_id);
CREATE INDEX IF NOT EXISTS idx_nl_saldo_favor_pedido ON nl_saldo_favor_aplicaciones(pedido_destino_id);
CREATE INDEX IF NOT EXISTS idx_nl_saldo_favor_clinica ON nl_saldo_favor_aplicaciones(clinica_id);
CREATE INDEX IF NOT EXISTS idx_nl_pagos_saldo_favor ON nl_pagos(clinica_id, es_saldo_favor) WHERE es_saldo_favor = TRUE;
