CREATE TABLE IF NOT EXISTS nl_audit_eventos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
    entidad VARCHAR(80) NOT NULL,
    entidad_id VARCHAR(80),
    accion VARCHAR(120) NOT NULL,
    descripcion TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip VARCHAR(80),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nl_audit_usuario_created ON nl_audit_eventos(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_audit_entidad_created ON nl_audit_eventos(entidad, created_at DESC);

ALTER TABLE nl_pagos ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nl_pagos ADD COLUMN IF NOT EXISTS conciliado_at TIMESTAMPTZ;
ALTER TABLE nl_pagos ADD COLUMN IF NOT EXISTS conciliado_por INTEGER REFERENCES nl_usuarios(id);

CREATE INDEX IF NOT EXISTS idx_nl_pagos_conciliado ON nl_pagos(conciliado, fecha_pago DESC);
