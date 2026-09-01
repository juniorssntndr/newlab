-- Migration 922: Caja diaria, sesiones de caja y arqueo
-- Estructura para apertura, control de flujo en vivo, arqueo y cierre diario

CREATE TABLE IF NOT EXISTS nl_fin_sesiones_caja (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno VARCHAR(50) NOT NULL DEFAULT 'general',
    monto_apertura NUMERIC(10, 2) NOT NULL DEFAULT 0,
    monto_esperado_efectivo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    monto_real_efectivo NUMERIC(10, 2),
    diferencia_efectivo NUMERIC(10, 2),
    total_ingresos_efectivo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_egresos_efectivo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_ingresos_banco NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_egresos_banco NUMERIC(10, 2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    observaciones_cierre TEXT,
    abierto_por INTEGER REFERENCES nl_usuarios(id),
    abierto_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_por INTEGER REFERENCES nl_usuarios(id),
    cerrado_at TIMESTAMPTZ,
    reabierto_por INTEGER REFERENCES nl_usuarios(id),
    reabierto_at TIMESTAMPTZ,
    reabierto_motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'nl_fin_sesiones_caja_estado_check'
    ) THEN
        ALTER TABLE nl_fin_sesiones_caja
            ADD CONSTRAINT nl_fin_sesiones_caja_estado_check
            CHECK (estado IN ('abierta', 'cerrada'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nl_fin_sesiones_caja_fecha ON nl_fin_sesiones_caja(fecha, estado);

ALTER TABLE nl_fin_movimientos
    ADD COLUMN IF NOT EXISTS sesion_caja_id INTEGER REFERENCES nl_fin_sesiones_caja(id) ON DELETE SET NULL;

ALTER TABLE nl_pagos
    ADD COLUMN IF NOT EXISTS sesion_caja_id INTEGER REFERENCES nl_fin_sesiones_caja(id) ON DELETE SET NULL;
