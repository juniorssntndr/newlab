-- Migración de esquema para Facturación Electrónica (APIs Perú)

-- 1. Tabla de Empresas emisoras (Laboratorio)
CREATE TABLE IF NOT EXISTS nl_empresas (
    id SERIAL PRIMARY KEY,
    ruc VARCHAR(20) NOT NULL,
    razon_social VARCHAR(220) NOT NULL,
    nombre_comercial VARCHAR(220),
    direccion_fiscal TEXT NOT NULL,
    ubigeo VARCHAR(10),
    token_apisperu TEXT,
    entorno VARCHAR(20) DEFAULT 'beta',
    serie_factura VARCHAR(10) DEFAULT 'F001',
    serie_boleta VARCHAR(10) DEFAULT 'B001',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar actualización automática
DROP TRIGGER IF EXISTS trg_nl_empresas_updated_at ON nl_empresas;
CREATE TRIGGER trg_nl_empresas_updated_at BEFORE UPDATE ON nl_empresas
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

-- Insertar empresa por defecto si está vacía
INSERT INTO nl_empresas (ruc, razon_social, nombre_comercial, direccion_fiscal, entorno)
SELECT '20000000001', 'LABORATORIO DENTAL DEMO S.A.C.', 'DEMO DENTAL', 'Av. Demo 123, Lima', 'beta'
WHERE NOT EXISTS (SELECT 1 FROM nl_empresas LIMIT 1);


-- 2. Asegurar campos en Clínicas
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS ubigeo VARCHAR(10);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS tipo_doc VARCHAR(2) DEFAULT '6'; -- 6=RUC, 1=DNI


-- 3. Tabla para comprobantes electrónicos emitidos
CREATE TABLE IF NOT EXISTS nl_comprobantes (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    pago_id INTEGER REFERENCES nl_pagos(id), -- Asociado a un pago opcional (para cancelación final)
    tipo_comprobante VARCHAR(10) NOT NULL, -- '01' (Factura), '03' (Boleta)
    serie VARCHAR(10) NOT NULL,
    correlativo INTEGER NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    total_gravada NUMERIC(12, 2) DEFAULT 0,
    total_igv NUMERIC(12, 2) DEFAULT 0,
    total_venta NUMERIC(12, 2) NOT NULL,
    estado_sunat VARCHAR(50) DEFAULT 'generado', -- generado, aceptado, rechazado
    external_id VARCHAR(100), -- ID único de la API externa
    hash_cpe VARCHAR(255),
    xml_url TEXT,
    pdf_url TEXT,
    cdr_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT nl_comprobantes_unique_serie_corr UNIQUE (tipo_comprobante, serie, correlativo)
);

-- Asegurar actualización automática
DROP TRIGGER IF EXISTS trg_nl_comprobantes_updated_at ON nl_comprobantes;
CREATE TRIGGER trg_nl_comprobantes_updated_at BEFORE UPDATE ON nl_comprobantes
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nl_comprobantes_pedido_id ON nl_comprobantes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nl_comprobantes_estado ON nl_comprobantes(estado_sunat);

-- 4. Modificar la vista de comprobante en pagos (recibo simple vs electrónico)
ALTER TABLE nl_pagos ADD COLUMN IF NOT EXISTS es_anticipo BOOLEAN DEFAULT TRUE;
