-- Create payments table for financial tracking
CREATE TABLE IF NOT EXISTS nl_pagos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    monto NUMERIC(10, 2) NOT NULL,
    metodo VARCHAR(50) DEFAULT 'transferencia',
    referencia VARCHAR(120),
    fecha_pago DATE DEFAULT CURRENT_DATE,
    notas TEXT,
    creado_por INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nl_pagos_pedido_id ON nl_pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nl_pagos_fecha_pago ON nl_pagos(fecha_pago);
