-- migracion para recuperar la tabla de flujos de aprobación de diseño 3D

CREATE TABLE IF NOT EXISTS nl_pedido_aprobaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    link_exocad TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, aprobado, ajuste_solicitado
    comentario_cliente TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    respondido_at TIMESTAMPTZ
);

-- Indices para busqueda rápida
CREATE INDEX IF NOT EXISTS idx_pedido_aprobacion_pedido ON nl_pedido_aprobaciones(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_aprobacion_estado ON nl_pedido_aprobaciones(estado);
