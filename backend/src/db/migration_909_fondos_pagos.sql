ALTER TABLE nl_pagos
    ADD COLUMN IF NOT EXISTS tipo_fondo VARCHAR(10),
    ADD COLUMN IF NOT EXISTS cuenta_id INTEGER REFERENCES nl_fin_cuentas(id);

ALTER TABLE nl_fin_movimientos
    ADD COLUMN IF NOT EXISTS tipo_fondo VARCHAR(10);

UPDATE nl_pagos
SET tipo_fondo = CASE
    WHEN LOWER(COALESCE(metodo, '')) = 'efectivo' THEN 'caja'
    ELSE 'banco'
END
WHERE tipo_fondo IS NULL;

UPDATE nl_fin_movimientos m
SET tipo_fondo = c.tipo_cuenta
FROM nl_fin_cuentas c
WHERE m.cuenta_id = c.id
  AND m.tipo_fondo IS NULL;

UPDATE nl_fin_movimientos
SET tipo_fondo = 'banco'
WHERE tipo_fondo IS NULL;

UPDATE nl_pagos p
SET cuenta_id = (
    SELECT id
    FROM nl_fin_cuentas
    WHERE activo = TRUE
      AND tipo_cuenta = p.tipo_fondo
    ORDER BY id ASC
    LIMIT 1
)
WHERE p.cuenta_id IS NULL;

UPDATE nl_fin_movimientos m
SET cuenta_id = (
    SELECT id
    FROM nl_fin_cuentas
    WHERE activo = TRUE
      AND tipo_cuenta = m.tipo_fondo
    ORDER BY id ASC
    LIMIT 1
)
WHERE m.cuenta_id IS NULL;

ALTER TABLE nl_pagos ALTER COLUMN tipo_fondo SET DEFAULT 'banco';
ALTER TABLE nl_fin_movimientos ALTER COLUMN tipo_fondo SET DEFAULT 'banco';

ALTER TABLE nl_pagos ALTER COLUMN tipo_fondo SET NOT NULL;
ALTER TABLE nl_fin_movimientos ALTER COLUMN tipo_fondo SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'nl_pagos_tipo_fondo_check'
    ) THEN
        ALTER TABLE nl_pagos
            ADD CONSTRAINT nl_pagos_tipo_fondo_check CHECK (tipo_fondo IN ('caja', 'banco'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'nl_fin_movimientos_tipo_fondo_check'
    ) THEN
        ALTER TABLE nl_fin_movimientos
            ADD CONSTRAINT nl_fin_movimientos_tipo_fondo_check CHECK (tipo_fondo IN ('caja', 'banco'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nl_pagos_tipo_fondo_fecha ON nl_pagos(tipo_fondo, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_nl_pagos_cuenta ON nl_pagos(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_nl_movimientos_tipo_fondo_fecha ON nl_fin_movimientos(tipo_fondo, fecha_movimiento DESC);
