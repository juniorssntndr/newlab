-- =========================================================================
-- MIGRATION 929: MÓDULO DE GESTIÓN DE PROVEEDORES E INSUMOS
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- 1. Tabla de Proveedores (Entidad Maestra)
CREATE TABLE IF NOT EXISTS nl_proveedores (
    id SERIAL PRIMARY KEY,
    razon_social VARCHAR(200) NOT NULL,
    nombre_comercial VARCHAR(200),
    tipo_documento VARCHAR(20) DEFAULT 'RUC',
    numero_documento VARCHAR(20),
    contacto_nombre VARCHAR(150),
    telefono VARCHAR(50),
    email VARCHAR(150),
    direccion TEXT,
    ciudad VARCHAR(100) DEFAULT 'Arequipa',
    tipo_proveedor VARCHAR(30) NOT NULL DEFAULT 'materiales', -- 'materiales', 'servicios', 'mixto'
    condicion_pago VARCHAR(50) DEFAULT 'contado', -- 'contado', 'credito_15', 'credito_30', 'otro'
    notas TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla Relacional de Insumos Suministrados por Proveedor
CREATE TABLE IF NOT EXISTS nl_proveedor_materiales (
    id SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL REFERENCES nl_proveedores(id) ON DELETE CASCADE,
    material_id INT REFERENCES nl_materiales(id) ON DELETE SET NULL,
    descripcion_item VARCHAR(200),
    codigo_catalogo VARCHAR(100),
    ultimo_precio NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(5) NOT NULL DEFAULT 'PEN', -- 'PEN', 'USD'
    fecha_ultimo_precio DATE DEFAULT CURRENT_DATE,
    tiempo_entrega_dias INT DEFAULT 1,
    es_proveedor_habitual BOOLEAN DEFAULT FALSE,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_nl_proveedores_activo ON nl_proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_nl_proveedores_tipo ON nl_proveedores(tipo_proveedor);
CREATE INDEX IF NOT EXISTS idx_nl_proveedor_materiales_prov ON nl_proveedor_materiales(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_nl_proveedor_materiales_mat ON nl_proveedor_materiales(material_id);

-- 4. Triggers de actualización
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nl_proveedores_updated_at'
    ) THEN
        CREATE TRIGGER trg_nl_proveedores_updated_at
        BEFORE UPDATE ON nl_proveedores
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nl_proveedor_materiales_updated_at'
    ) THEN
        CREATE TRIGGER trg_nl_proveedor_materiales_updated_at
        BEFORE UPDATE ON nl_proveedor_materiales
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    END IF;
END $$;

-- 5. Semillas iniciales realistas para AFINIX Dental Lab en Arequipa
INSERT INTO nl_proveedores (razon_social, nombre_comercial, tipo_documento, numero_documento, contacto_nombre, telefono, email, direccion, ciudad, tipo_proveedor, condicion_pago, notas, activo)
SELECT 'Dental Arequipa Distribuidora S.A.C.', 'Dental Arequipa', 'RUC', '20501234567', 'Ing. Roberto Salas', '958123456', 'ventas@dentalarequipa.pe', 'Calle Mercaderes 320, Cercado', 'Arequipa', 'materiales', 'credito_15', 'Distribuidor autorizado de zirconia y fresas CAD/CAM.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_proveedores WHERE razon_social = 'Dental Arequipa Distribuidora S.A.C.');

INSERT INTO nl_proveedores (razon_social, nombre_comercial, tipo_documento, numero_documento, contacto_nombre, telefono, email, direccion, ciudad, tipo_proveedor, condicion_pago, notas, activo)
SELECT 'Prodent Dental Perú E.I.R.L.', 'Prodent Perú', 'RUC', '20489123891', 'Lic. Patricia Ramos', '959987654', 'atencion@prodentperu.com', 'Av. Cayma 405, Cayma', 'Arequipa', 'materiales', 'contado', 'Proveedor principal de resinas 3D, films FEP e isopropanol.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_proveedores WHERE razon_social = 'Prodent Dental Perú E.I.R.L.');

INSERT INTO nl_proveedores (razon_social, nombre_comercial, tipo_documento, numero_documento, contacto_nombre, telefono, email, direccion, ciudad, tipo_proveedor, condicion_pago, notas, activo)
SELECT 'Servicio Técnico Especializado Dental Sur', 'Servitech Dental', 'RUC', '10452389121', 'Carlos Begazo', '954321098', 'carlos.begazo@servitechsur.pe', 'Urb. La Victoria B-12, J.L. Bustamante y Rivero', 'Arequipa', 'servicios', 'contado', 'Mantenimiento preventivo de hornos de sinterizado y calibración de fresadoras.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_proveedores WHERE razon_social = 'Servicio Técnico Especializado Dental Sur');

-- Vincular materiales iniciales con precios de referencia
INSERT INTO nl_proveedor_materiales (proveedor_id, material_id, descripcion_item, codigo_catalogo, ultimo_precio, moneda, fecha_ultimo_precio, tiempo_entrega_dias, es_proveedor_habitual)
SELECT 
    p.id,
    m.id,
    'Disco Zirconia Multicapa 98mm 16mm',
    'ZIRC-ML-9816',
    95.00,
    'USD',
    CURRENT_DATE - INTERVAL '10 day',
    2,
    TRUE
FROM nl_proveedores p
JOIN nl_materiales m ON m.nombre ILIKE '%Disco Zirconia Multicapa%'
WHERE p.razon_social = 'Dental Arequipa Distribuidora S.A.C.'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO nl_proveedor_materiales (proveedor_id, material_id, descripcion_item, codigo_catalogo, ultimo_precio, moneda, fecha_ultimo_precio, tiempo_entrega_dias, es_proveedor_habitual)
SELECT 
    p.id,
    m.id,
    'Resina 3D Modelos Beige 1000g',
    'RES-MOD-BEI',
    340.00,
    'PEN',
    CURRENT_DATE - INTERVAL '5 day',
    1,
    TRUE
FROM nl_proveedores p
JOIN nl_materiales m ON m.nombre ILIKE '%Resina Modelos 3D%'
WHERE p.razon_social = 'Prodent Dental Perú E.I.R.L.'
LIMIT 1
ON CONFLICT DO NOTHING;
