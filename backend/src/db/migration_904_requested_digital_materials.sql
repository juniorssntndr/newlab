-- User-requested digital dental lab materials

INSERT INTO nl_materiales (nombre, flujo, categoria, color, stock_actual, stock_minimo, unidad, alerta_bajo_stock, activo)
SELECT v.nombre, v.flujo, v.categoria, v.color, v.stock_actual, v.stock_minimo, v.unidad, TRUE, TRUE
FROM (
    VALUES
        ('Discos de zirconia multicapa (HT/ST/UT)', 'digital', 'disco', 'A2', 20, 5, 'disco'),
        ('Discos de zirconia monolitica', 'digital', 'disco', 'A1', 18, 5, 'disco'),
        ('Bloques de disilicato CAD/CAM', 'digital', 'bloque', 'A1', 14, 4, 'bloque'),
        ('Bloques de PMMA provisional CAD/CAM', 'digital', 'bloque', 'A2', 24, 8, 'bloque'),
        ('Bloques de cera CAD/CAM', 'digital', 'bloque', 'amarillo', 20, 8, 'bloque'),
        ('Resina para modelos 3D', 'digital', 'resina', 'beige', 16, 5, 'litro'),
        ('Resina para guia quirurgica', 'digital', 'resina', 'transparente', 12, 4, 'litro'),
        ('Resina provisional (coronas/puentes)', 'digital', 'resina', 'A2', 12, 4, 'litro'),
        ('Resina gingival (mascara rosa)', 'digital', 'resina', 'rosa', 10, 3, 'litro'),
        ('Resina castable (colado)', 'digital', 'resina', 'violeta', 8, 3, 'litro'),
        ('Spray escaner (anti-reflejo)', 'digital', 'consumible', 'blanco', 20, 6, 'unidad'),
        ('Fresas de desbaste para zirconia', 'digital', 'fresa', NULL, 48, 15, 'unidad'),
        ('Fresas de acabado fino', 'digital', 'fresa', NULL, 56, 20, 'unidad'),
        ('Fresas para PMMA/cera', 'digital', 'fresa', NULL, 52, 20, 'unidad'),
        ('Film FEP para impresora resina', 'digital', 'consumible', 'transparente', 10, 3, 'unidad'),
        ('IPA (alcohol isopropilico) para lavado', 'digital', 'liquido', 'transparente', 24, 8, 'litro'),
        ('Liquido de limpieza de cubeta/tanque', 'digital', 'liquido', 'transparente', 8, 3, 'litro'),
        ('Adhesivo plataforma de impresion', 'digital', 'consumible', NULL, 10, 4, 'unidad'),
        ('Papel/filtro UV postcurado (consumible)', 'digital', 'consumible', NULL, 32, 10, 'unidad'),
        ('Guantes y panos sin pelusa (control limpio)', 'digital', 'consumible', NULL, 120, 25, 'unidad')
) AS v(nombre, flujo, categoria, color, stock_actual, stock_minimo, unidad)
WHERE NOT EXISTS (
    SELECT 1
    FROM nl_materiales m
    WHERE m.nombre = v.nombre
);
