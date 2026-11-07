-- Migration 943: Enlaces cortos para seguimiento de casos y aprobaciones
-- AFINIX DENTAL LAB S.A.C.

CREATE TABLE IF NOT EXISTS nl_enlaces_cortos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(24) NOT NULL UNIQUE,
    tipo VARCHAR(40) NOT NULL DEFAULT 'tracking',
    pedido_id INTEGER REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    clinica_id INTEGER REFERENCES nl_clinicas(id) ON DELETE CASCADE,
    url_destino TEXT,
    visitas INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enlaces_cortos_codigo ON nl_enlaces_cortos (codigo);
CREATE INDEX IF NOT EXISTS idx_enlaces_cortos_pedido ON nl_enlaces_cortos (pedido_id);
