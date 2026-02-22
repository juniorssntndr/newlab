-- Base schema for clean NewLab bootstrap

CREATE OR REPLACE FUNCTION nl_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS nl_roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    es_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nl_clinicas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    razon_social VARCHAR(220),
    ruc VARCHAR(20),
    dni VARCHAR(20),
    email VARCHAR(160),
    telefono VARCHAR(40),
    direccion TEXT,
    contacto_nombre VARCHAR(180),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    lista_precios_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_clinicas_estado_check CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE IF NOT EXISTS nl_usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    telefono VARCHAR(40),
    password_hash TEXT NOT NULL,
    rol_id INTEGER REFERENCES nl_roles(id),
    tipo VARCHAR(20) NOT NULL,
    clinica_id INTEGER REFERENCES nl_clinicas(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    ultimo_acceso TIMESTAMPTZ,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_usuarios_tipo_check CHECK (tipo IN ('admin', 'tecnico', 'cliente')),
    CONSTRAINT nl_usuarios_estado_check CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE IF NOT EXISTS nl_categorias_trabajo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(140) NOT NULL UNIQUE,
    tipo VARCHAR(40),
    descripcion TEXT,
    icono VARCHAR(80),
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nl_productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES nl_categorias_trabajo(id),
    precio_base NUMERIC(12, 2) NOT NULL DEFAULT 0,
    material_default VARCHAR(120),
    tiempo_estimado_dias INTEGER NOT NULL DEFAULT 5,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_productos_precio_check CHECK (precio_base >= 0),
    CONSTRAINT nl_productos_tiempo_check CHECK (tiempo_estimado_dias > 0)
);

CREATE TABLE IF NOT EXISTS nl_pedidos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    clinica_id INTEGER NOT NULL REFERENCES nl_clinicas(id),
    paciente_nombre VARCHAR(180) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_entrega DATE NOT NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    sub_estado VARCHAR(80),
    observaciones TEXT,
    archivos_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    igv NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsable_id INTEGER REFERENCES nl_usuarios(id),
    created_by INTEGER REFERENCES nl_usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_pedidos_estado_check CHECK (estado IN ('pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado')),
    CONSTRAINT nl_pedidos_subtotal_check CHECK (subtotal >= 0),
    CONSTRAINT nl_pedidos_igv_check CHECK (igv >= 0),
    CONSTRAINT nl_pedidos_total_check CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS nl_pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES nl_productos(id),
    piezas_dentales TEXT[] NOT NULL DEFAULT '{}',
    es_puente BOOLEAN NOT NULL DEFAULT FALSE,
    pieza_inicio VARCHAR(20),
    pieza_fin VARCHAR(20),
    material VARCHAR(120),
    color_vita VARCHAR(50),
    color_munon VARCHAR(50),
    textura VARCHAR(120),
    oclusion VARCHAR(120),
    notas TEXT,
    cantidad NUMERIC(10, 2) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_pedido_items_cantidad_check CHECK (cantidad > 0),
    CONSTRAINT nl_pedido_items_precio_check CHECK (precio_unitario >= 0),
    CONSTRAINT nl_pedido_items_subtotal_check CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS nl_pedido_timeline (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(40),
    estado_nuevo VARCHAR(40),
    usuario_id INTEGER REFERENCES nl_usuarios(id),
    accion VARCHAR(160),
    detalle TEXT,
    comentario TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nl_pedido_aprobaciones (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    link_exocad TEXT NOT NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    comentario_cliente TEXT,
    respondido_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_pedido_aprobaciones_estado_check CHECK (estado IN ('pendiente', 'aprobado', 'ajuste_solicitado'))
);

CREATE TABLE IF NOT EXISTS nl_notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES nl_usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'sistema',
    titulo VARCHAR(180) NOT NULL,
    mensaje TEXT,
    link TEXT,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nl_precios_producto (
    id SERIAL PRIMARY KEY,
    clinica_id INTEGER NOT NULL REFERENCES nl_clinicas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES nl_productos(id) ON DELETE CASCADE,
    precio NUMERIC(12, 2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nl_precios_producto_precio_check CHECK (precio >= 0),
    CONSTRAINT nl_precios_producto_unique UNIQUE (clinica_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_usuarios_tipo_estado ON nl_usuarios(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_nl_usuarios_clinica_tipo ON nl_usuarios(clinica_id, tipo);
CREATE INDEX IF NOT EXISTS idx_nl_clinicas_estado ON nl_clinicas(estado);
CREATE INDEX IF NOT EXISTS idx_nl_productos_categoria ON nl_productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_nl_productos_activo ON nl_productos(activo);
CREATE INDEX IF NOT EXISTS idx_nl_pedidos_created_at ON nl_pedidos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_pedidos_estado ON nl_pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_nl_pedidos_clinica ON nl_pedidos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_nl_pedido_items_pedido ON nl_pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nl_timeline_pedido_created ON nl_pedido_timeline(pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_aprobaciones_pedido_created ON nl_pedido_aprobaciones(pedido_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_notificaciones_user_created ON nl_notificaciones(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nl_notificaciones_user_unread ON nl_notificaciones(usuario_id) WHERE leida = FALSE;

DROP TRIGGER IF EXISTS trg_nl_roles_updated_at ON nl_roles;
CREATE TRIGGER trg_nl_roles_updated_at BEFORE UPDATE ON nl_roles
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_clinicas_updated_at ON nl_clinicas;
CREATE TRIGGER trg_nl_clinicas_updated_at BEFORE UPDATE ON nl_clinicas
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_usuarios_updated_at ON nl_usuarios;
CREATE TRIGGER trg_nl_usuarios_updated_at BEFORE UPDATE ON nl_usuarios
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_categorias_updated_at ON nl_categorias_trabajo;
CREATE TRIGGER trg_nl_categorias_updated_at BEFORE UPDATE ON nl_categorias_trabajo
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_productos_updated_at ON nl_productos;
CREATE TRIGGER trg_nl_productos_updated_at BEFORE UPDATE ON nl_productos
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_pedidos_updated_at ON nl_pedidos;
CREATE TRIGGER trg_nl_pedidos_updated_at BEFORE UPDATE ON nl_pedidos
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_pedido_items_updated_at ON nl_pedido_items;
CREATE TRIGGER trg_nl_pedido_items_updated_at BEFORE UPDATE ON nl_pedido_items
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_precios_producto_updated_at ON nl_precios_producto;
CREATE TRIGGER trg_nl_precios_producto_updated_at BEFORE UPDATE ON nl_precios_producto
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

-- Compatibility alters if DB was partially created before this migration
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS lista_precios_id INTEGER;

ALTER TABLE nl_usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE nl_usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

ALTER TABLE nl_pedidos ADD COLUMN IF NOT EXISTS fecha DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE nl_pedidos ADD COLUMN IF NOT EXISTS archivos_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE nl_pedido_timeline ADD COLUMN IF NOT EXISTS accion VARCHAR(160);
ALTER TABLE nl_pedido_timeline ADD COLUMN IF NOT EXISTS detalle TEXT;
