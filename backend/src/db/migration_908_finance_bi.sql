CREATE TABLE IF NOT EXISTS nl_fin_cuentas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    tipo_cuenta VARCHAR(20) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
    saldo_inicial NUMERIC(12, 2) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_fin_cuentas_tipo_check CHECK (tipo_cuenta IN ('caja', 'banco')),
    CONSTRAINT nl_fin_cuentas_saldo_check CHECK (saldo_inicial >= 0)
);

CREATE TABLE IF NOT EXISTS nl_fin_movimientos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    cuenta_id INTEGER REFERENCES nl_fin_cuentas(id),
    fecha_movimiento DATE NOT NULL DEFAULT CURRENT_DATE,
    monto NUMERIC(12, 2) NOT NULL,
    grupo_gasto VARCHAR(30),
    categoria_gasto VARCHAR(80),
    unidad_negocio VARCHAR(120),
    producto_id INTEGER REFERENCES nl_productos(id),
    clinica_id INTEGER REFERENCES nl_clinicas(id),
    descripcion TEXT,
    referencia VARCHAR(120),
    creado_por INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_fin_movimientos_tipo_check CHECK (tipo IN ('ingreso', 'egreso')),
    CONSTRAINT nl_fin_movimientos_monto_check CHECK (monto > 0),
    CONSTRAINT nl_fin_movimientos_grupo_check CHECK (grupo_gasto IS NULL OR grupo_gasto IN ('operativo', 'costo_directo', 'otro')),
    CONSTRAINT nl_fin_movimientos_egreso_categoria_check CHECK (tipo <> 'egreso' OR categoria_gasto IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_fecha ON nl_fin_movimientos(fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_tipo_fecha ON nl_fin_movimientos(tipo, fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_clinica ON nl_fin_movimientos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_producto ON nl_fin_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_nl_fin_movimientos_unidad ON nl_fin_movimientos(unidad_negocio);

INSERT INTO nl_fin_cuentas (nombre, tipo_cuenta, saldo_inicial)
SELECT 'Caja Principal', 'caja', 0
WHERE NOT EXISTS (SELECT 1 FROM nl_fin_cuentas WHERE nombre = 'Caja Principal');

INSERT INTO nl_fin_cuentas (nombre, tipo_cuenta, saldo_inicial)
SELECT 'Banco Principal', 'banco', 0
WHERE NOT EXISTS (SELECT 1 FROM nl_fin_cuentas WHERE nombre = 'Banco Principal');
