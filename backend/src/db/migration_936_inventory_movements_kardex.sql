-- Migration 936: Kardex y Flujo de Almacén vs Taller (Enfoque A)
-- Agrega soporte para stock en uso (en máquina / abierto) y tabla de auditoría/movimientos

ALTER TABLE nl_materiales 
    ADD COLUMN IF NOT EXISTS stock_en_uso NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tipo_control VARCHAR(20) NOT NULL DEFAULT 'unitario';

-- Normalizar tipo_control según categoría y nombre
UPDATE nl_materiales
SET tipo_control = CASE 
    WHEN LOWER(categoria) IN ('disco', 'resina', 'liquido') 
         OR LOWER(nombre) LIKE '%disco%' 
         OR LOWER(nombre) LIKE '%resina%' 
    THEN 'multiuso'
    ELSE 'unitario'
END
WHERE tipo_control = 'unitario';

-- Tabla de Movimientos / Kardex
CREATE TABLE IF NOT EXISTS nl_material_movimientos (
    id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES nl_materiales(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL, -- 'ingreso', 'apertura_taller', 'agotado_taller', 'consumo_unitario', 'merma_taller', 'ajuste'
    cantidad NUMERIC(10, 2) NOT NULL,
    stock_almacen_anterior NUMERIC(10, 2) NOT NULL,
    stock_almacen_nuevo NUMERIC(10, 2) NOT NULL,
    stock_en_uso_anterior NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_en_uso_nuevo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    motivo VARCHAR(100), -- 'compra_proveedor', 'montado_fresadora', 'apertura_frasco', 'agotado_nesting', 'merma_rotura', 'ajuste_inventario'
    referencia VARCHAR(120), -- Factura, Guía de Remisión, Pedido técnico
    proveedor_id INTEGER REFERENCES nl_proveedores(id) ON DELETE SET NULL,
    costo_unitario NUMERIC(10, 2),
    usuario_id INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nl_mat_mov_material ON nl_material_movimientos(material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_mat_mov_tipo ON nl_material_movimientos(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_mat_mov_created_at ON nl_material_movimientos(created_at DESC);
