CREATE TABLE IF NOT EXISTS nl_pedido_archivos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL DEFAULT 'otro',
    url TEXT NOT NULL,
    nombre_original TEXT,
    mime_type VARCHAR(120),
    size_bytes INTEGER,
    uploaded_by INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_pedido_archivos_tipo_check CHECK (tipo IN ('color', 'caso', 'final', 'otro'))
);

CREATE INDEX IF NOT EXISTS idx_nl_pedido_archivos_pedido_created
    ON nl_pedido_archivos(pedido_id, created_at DESC);
