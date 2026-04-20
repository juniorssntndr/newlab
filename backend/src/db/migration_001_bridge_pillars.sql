ALTER TABLE nl_pedido_items
ADD COLUMN IF NOT EXISTS pilares_dentales TEXT[] NOT NULL DEFAULT '{}';
