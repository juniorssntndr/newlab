-- MVP fields for dental material management

ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS flujo VARCHAR(20) NOT NULL DEFAULT 'digital';
ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS categoria VARCHAR(40);
ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS color VARCHAR(40);
ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS alerta_bajo_stock BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE nl_materiales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_nl_materiales_updated_at'
    ) THEN
        CREATE TRIGGER trg_nl_materiales_updated_at
        BEFORE UPDATE ON nl_materiales
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    END IF;
END $$;

-- Normalize prior catalog rows
UPDATE nl_materiales
SET flujo = CASE WHEN LOWER(nombre) LIKE 'analogico -%' THEN 'analogico' ELSE 'digital' END,
    categoria = COALESCE(categoria,
        CASE
            WHEN LOWER(nombre) LIKE '%disco%' THEN 'disco'
            WHEN LOWER(nombre) LIKE '%bloque%' THEN 'bloque'
            WHEN LOWER(nombre) LIKE '%resina%' THEN 'resina'
            WHEN LOWER(nombre) LIKE '%fresa%' THEN 'fresa'
            WHEN LOWER(nombre) LIKE '%film fep%' OR LOWER(nombre) LIKE '%spray%' OR LOWER(nombre) LIKE '%adhesivo%' THEN 'consumible'
            WHEN LOWER(nombre) LIKE '%liquido%' OR LOWER(nombre) LIKE '%ipa%' OR LOWER(nombre) LIKE '%isopropanol%' THEN 'liquido'
            ELSE 'consumible'
        END
    ),
    color = COALESCE(color,
        CASE
            WHEN LOWER(nombre) LIKE '%gingiva%' THEN 'rosa'
            WHEN LOWER(nombre) LIKE '%guia%' THEN 'transparente'
            ELSE NULL
        END
    )
WHERE categoria IS NULL OR flujo IS NULL;

-- Core digital catalog with color and alert support
INSERT INTO nl_materiales (nombre, flujo, categoria, color, stock_actual, stock_minimo, unidad, alerta_bajo_stock, activo)
SELECT x.nombre, x.flujo, x.categoria, x.color, x.stock_actual, x.stock_minimo, x.unidad, TRUE, TRUE
FROM (
    VALUES
        ('Digital - Disco Zirconia Multicapa', 'digital', 'disco', 'A2', 25, 5, 'disco'),
        ('Digital - Disco Zirconia Monolítica', 'digital', 'disco', 'A1', 20, 5, 'disco'),
        ('Digital - Bloque Disilicato CAD/CAM', 'digital', 'bloque', 'A1', 18, 4, 'bloque'),
        ('Digital - Bloque PMMA Provisional CAD/CAM', 'digital', 'bloque', 'A2', 30, 8, 'bloque'),
        ('Digital - Bloque Cera CAD/CAM', 'digital', 'bloque', 'amarillo', 28, 8, 'bloque'),
        ('Digital - Resina Modelos 3D', 'digital', 'resina', 'beige', 20, 5, 'litro'),
        ('Digital - Resina Guía Quirúrgica', 'digital', 'resina', 'transparente', 15, 4, 'litro'),
        ('Digital - Resina Provisional', 'digital', 'resina', 'A2', 16, 4, 'litro'),
        ('Digital - Resina Gingival', 'digital', 'resina', 'rosa', 12, 3, 'litro'),
        ('Digital - Resina Castable', 'digital', 'resina', 'violeta', 10, 3, 'litro'),
        ('Digital - Spray Escáner', 'digital', 'consumible', 'blanco', 24, 6, 'unidad'),
        ('Digital - Fresa Desbaste Zirconia', 'digital', 'fresa', NULL, 60, 15, 'unidad'),
        ('Digital - Fresa Acabado Fino', 'digital', 'fresa', NULL, 80, 20, 'unidad'),
        ('Digital - Fresa PMMA/Cera', 'digital', 'fresa', NULL, 70, 20, 'unidad'),
        ('Digital - Film FEP Impresora', 'digital', 'consumible', 'transparente', 12, 3, 'unidad'),
        ('Digital - Isopropanol IPA', 'digital', 'liquido', 'transparente', 30, 8, 'litro'),
        ('Digital - Líquido Limpieza Cubeta', 'digital', 'liquido', 'transparente', 10, 3, 'litro'),
        ('Digital - Adhesivo Plataforma', 'digital', 'consumible', NULL, 14, 4, 'unidad'),
        ('Digital - Papel UV Postcurado', 'digital', 'consumible', NULL, 40, 10, 'unidad'),
        ('Digital - Paño sin pelusa', 'digital', 'consumible', NULL, 100, 20, 'unidad')
) AS x(nombre, flujo, categoria, color, stock_actual, stock_minimo, unidad)
WHERE NOT EXISTS (
    SELECT 1
    FROM nl_materiales m
    WHERE m.nombre = x.nombre
);

CREATE INDEX IF NOT EXISTS idx_nl_materiales_flujo ON nl_materiales(flujo);
CREATE INDEX IF NOT EXISTS idx_nl_materiales_categoria ON nl_materiales(categoria);
CREATE INDEX IF NOT EXISTS idx_nl_materiales_alerta ON nl_materiales(alerta_bajo_stock);
