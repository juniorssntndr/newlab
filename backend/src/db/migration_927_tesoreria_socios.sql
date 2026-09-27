-- =========================================================================
-- MIGRATION 927: TESORERÍA MULTI-BANCOS, TRANSFERENCIAS Y RETIRO DE UTILIDADES
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- 1. Depuración de pagos huérfanos históricos en nl_pagos
DELETE FROM nl_pagos WHERE pedido_id NOT IN (SELECT id FROM nl_pedidos);

-- 2. Extensión de Cuentas Financieras (Multi-Bancos)
ALTER TABLE nl_fin_cuentas
    ADD COLUMN IF NOT EXISTS banco VARCHAR(100),
    ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(60),
    ADD COLUMN IF NOT EXISTS cci VARCHAR(60),
    ADD COLUMN IF NOT EXISTS color VARCHAR(25) DEFAULT '#0284c7',
    ADD COLUMN IF NOT EXISTS descripcion TEXT,
    ADD COLUMN IF NOT EXISTS saldo_actual NUMERIC(14, 2) DEFAULT 0.00;

-- Actualizar cuentas predeterminadas existentes
UPDATE nl_fin_cuentas
SET nombre = 'Caja Principal (Efectivo)',
    tipo_cuenta = 'caja',
    banco = 'Efectivo',
    color = '#10b981',
    descripcion = 'Efectivo físico de operaciones en mostrador'
WHERE id = 1;

UPDATE nl_fin_cuentas
SET nombre = 'BCP Operativo (Principal)',
    tipo_cuenta = 'banco',
    banco = 'BCP',
    color = '#0284c7',
    descripcion = 'Cuenta corriente bancaria principal'
WHERE id = 2;

-- 3. Tabla de Transferencias entre Cuentas (Movimientos Neutros de Tesorería)
CREATE TABLE IF NOT EXISTS nl_fin_transferencias (
    id SERIAL PRIMARY KEY,
    cuenta_origen_id INTEGER NOT NULL REFERENCES nl_fin_cuentas(id),
    cuenta_destino_id INTEGER NOT NULL REFERENCES nl_fin_cuentas(id),
    monto NUMERIC(14, 2) NOT NULL CHECK (monto > 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    referencia VARCHAR(100),
    motivo TEXT,
    creado_por INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_transferencia_distintas_cuentas CHECK (cuenta_origen_id <> cuenta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_fin_transferencias_fecha ON nl_fin_transferencias(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_nl_fin_transferencias_origen ON nl_fin_transferencias(cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_nl_fin_transferencias_destino ON nl_fin_transferencias(cuenta_destino_id);

-- 4. Tabla de Socios / Accionistas
CREATE TABLE IF NOT EXISTS nl_fin_socios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    documento_tipo VARCHAR(20) DEFAULT 'DNI',
    documento_numero VARCHAR(20),
    porcentaje_participacion NUMERIC(5, 2) DEFAULT 0.00,
    telefono VARCHAR(50),
    email VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sembrar socios fundadores representativos si no existen
INSERT INTO nl_fin_socios (nombre, documento_tipo, documento_numero, porcentaje_participacion, activo)
SELECT 'Brandon Santander', 'DNI', '70000001', 50.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_fin_socios WHERE documento_numero = '70000001' OR nombre ILIKE '%Santander%');

INSERT INTO nl_fin_socios (nombre, documento_tipo, documento_numero, porcentaje_participacion, activo)
SELECT 'Socio Co-Fundador', 'DNI', '70000002', 50.00, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_fin_socios WHERE id = 2 OR documento_numero = '70000002');

-- 5. Extensión de Movimientos Financieros para Retiros de Socios
ALTER TABLE nl_fin_movimientos
    ADD COLUMN IF NOT EXISTS socio_id INTEGER REFERENCES nl_fin_socios(id),
    ADD COLUMN IF NOT EXISTS transferencia_id INTEGER REFERENCES nl_fin_transferencias(id);

-- Actualizar Constraints en nl_fin_movimientos
DO $$
BEGIN
    -- Permitir tipo 'retiro_socio'
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'nl_fin_movimientos_tipo_check' 
          AND conrelid = 'nl_fin_movimientos'::regclass
    ) THEN
        ALTER TABLE nl_fin_movimientos DROP CONSTRAINT nl_fin_movimientos_tipo_check;
    END IF;
    ALTER TABLE nl_fin_movimientos 
        ADD CONSTRAINT nl_fin_movimientos_tipo_check CHECK (tipo IN ('ingreso', 'egreso', 'retiro_socio'));

    -- Permitir grupo_gasto 'patrimonio_socio'
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'nl_fin_movimientos_grupo_check' 
          AND conrelid = 'nl_fin_movimientos'::regclass
    ) THEN
        ALTER TABLE nl_fin_movimientos DROP CONSTRAINT nl_fin_movimientos_grupo_check;
    END IF;
    ALTER TABLE nl_fin_movimientos 
        ADD CONSTRAINT nl_fin_movimientos_grupo_check CHECK (
            grupo_gasto IS NULL OR grupo_gasto IN ('operativo', 'costo_directo', 'patrimonio_socio', 'otro')
        );
END $$;

CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_socio ON nl_fin_movimientos(socio_id);
CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_transferencia ON nl_fin_movimientos(transferencia_id);
