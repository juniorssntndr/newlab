-- Material catalog for digital and analog dental lab workflows

INSERT INTO nl_materiales (nombre, stock_actual, stock_minimo, unidad, activo)
SELECT x.nombre, x.stock_actual, x.stock_minimo, x.unidad, true
FROM (
    VALUES
        ('Digital - Disco Zirconia Multicapa', 25, 5, 'disco'),
        ('Digital - Disco Zirconia Monocapa', 20, 5, 'disco'),
        ('Digital - Bloque PMMA CAD/CAM', 40, 10, 'bloque'),
        ('Digital - Bloque Cera CAD/CAM', 35, 8, 'bloque'),
        ('Digital - Bloque Disilicato CAD/CAM', 18, 4, 'bloque'),
        ('Digital - Resina Modelos 3D', 20, 5, 'litro'),
        ('Digital - Resina Guía Quirúrgica', 15, 4, 'litro'),
        ('Digital - Resina Provisional', 16, 4, 'litro'),
        ('Digital - Resina Gingiva', 12, 3, 'litro'),
        ('Digital - Resina Castable', 10, 3, 'litro'),
        ('Digital - Spray Escáner', 24, 6, 'unidad'),
        ('Digital - Fresa Carburo 2mm', 60, 15, 'unidad'),
        ('Digital - Fresa Diamante 1mm', 70, 20, 'unidad'),
        ('Digital - Fresa Acabado Fino', 80, 20, 'unidad'),
        ('Digital - Líquido Limpieza Cubeta', 10, 3, 'litro'),
        ('Digital - Film FEP Impresora', 12, 3, 'unidad'),
        ('Digital - Isopropanol IPA', 30, 8, 'litro'),
        ('Digital - Adhesivo Plataforma', 14, 4, 'unidad'),
        ('Analogico - Aleación Cr-Co', 30, 8, 'kg'),
        ('Analogico - Aleación Ni-Cr', 20, 6, 'kg'),
        ('Analogico - Yeso Tipo IV', 80, 20, 'kg'),
        ('Analogico - Yeso Tipo III', 70, 20, 'kg'),
        ('Analogico - Revestimiento Fosfático', 50, 12, 'kg'),
        ('Analogico - Cera Cervical', 45, 10, 'barra'),
        ('Analogico - Cera Incrustación', 40, 10, 'barra'),
        ('Analogico - Aislante de Yeso', 20, 5, 'litro'),
        ('Analogico - Líquido Monómero', 25, 6, 'litro'),
        ('Analogico - Acrílico Termocurable', 28, 7, 'kg'),
        ('Analogico - Acrílico Autocurable', 24, 6, 'kg'),
        ('Analogico - Cerámica Feldespática', 20, 5, 'kit'),
        ('Analogico - Opaco Metal-Cerámica', 18, 5, 'frasco'),
        ('Analogico - Glaseador Cerámico', 22, 6, 'frasco'),
        ('Analogico - Arenado Óxido Aluminio 50um', 65, 15, 'kg'),
        ('Analogico - Arenado Óxido Aluminio 110um', 65, 15, 'kg'),
        ('Analogico - Silicona Duplicado', 16, 4, 'kg'),
        ('Analogico - Alginato de Laboratorio', 26, 6, 'kg'),
        ('Analogico - Separador Acrílico', 18, 5, 'litro')
) AS x(nombre, stock_actual, stock_minimo, unidad)
WHERE NOT EXISTS (
    SELECT 1
    FROM nl_materiales m
    WHERE m.nombre = x.nombre
);
