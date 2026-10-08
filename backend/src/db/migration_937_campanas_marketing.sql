-- Migration 937: Campañas de Marketing Visuales, Push y Toast In-App
CREATE TABLE IF NOT EXISTS nl_campanas_marketing (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    imagen_url TEXT,
    tipo_audiencia VARCHAR(50) DEFAULT 'todos', -- 'todos' | 'inactivos' | 'clinicas_especificas'
    segmento_ids JSONB DEFAULT '[]'::jsonb,
    beneficio_tipo VARCHAR(50) DEFAULT 'cupon', -- 'cupon' | 'capacitacion' | 'comunicado'
    cupon_id INTEGER REFERENCES nl_descuentos(id) ON DELETE SET NULL,
    codigo_descuento VARCHAR(50),
    link_destino TEXT,
    mostrar_toast_in_app BOOLEAN DEFAULT TRUE,
    enviar_push_web BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    total_enviados INTEGER DEFAULT 0,
    total_clics INTEGER DEFAULT 0,
    creado_por INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanas_marketing_activo ON nl_campanas_marketing(activo);
CREATE INDEX IF NOT EXISTS idx_campanas_marketing_created ON nl_campanas_marketing(created_at DESC);
