
-- Seed CAD/CAM materials
INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Zirconia', 10, 2, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Zirconia');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Disilicato', 10, 2, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Disilicato');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'PMMA', 10, 2, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'PMMA');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Titanio', 5, 1, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Titanio');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Resina', 20, 5, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Resina');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Metal (Cr-Co)', 10, 2, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Metal (Cr-Co)');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'PEEK', 5, 1, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'PEEK');

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT 'Cera', 15, 3, 'unid', true
WHERE NOT EXISTS (SELECT 1 FROM nl_materiales WHERE nombre = 'Cera');
