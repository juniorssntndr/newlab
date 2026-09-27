-- Migración 923: Tabla de vinculación multi-pedido para comprobantes consolidados
CREATE TABLE IF NOT EXISTS nl_comprobante_pedidos (
    comprobante_id INT NOT NULL REFERENCES nl_comprobantes(id) ON DELETE CASCADE,
    pedido_id INT NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (comprobante_id, pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_comprobante_pedidos_pedido_id ON nl_comprobante_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nl_comprobante_pedidos_comprobante_id ON nl_comprobante_pedidos(comprobante_id);

-- Sembrar registros iniciales para comprobantes ya existentes
INSERT INTO nl_comprobante_pedidos (comprobante_id, pedido_id)
SELECT id, pedido_id 
FROM nl_comprobantes 
WHERE pedido_id IS NOT NULL
ON CONFLICT DO NOTHING;
