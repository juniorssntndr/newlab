-- =========================================================================
-- MIGRATION 931: MÓDULO DE MARKETING, CUPONES Y RULETA DE EVENTOS
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- 1. Tabla Principal de Descuentos y Cupones Promocionales
CREATE TABLE IF NOT EXISTS nl_descuentos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,                       -- Ej: 'AFINIX10', 'BIENVENIDO50', 'EXPO-AREQUIPA'
    descripcion TEXT,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')), -- 'porcentaje' o 'monto_fijo'
    valor NUMERIC(10, 2) NOT NULL,                            -- Porcentaje (ej: 10.00) o Monto en Soles (ej: 50.00)
    tope_descuento_maximo NUMERIC(10, 2) NULL,                -- Tope opcional en soles para descuentos porcentuales
    monto_minimo_pedido NUMERIC(10, 2) NULL DEFAULT 0.00,     -- Consumo mínimo requerido
    limite_usos_total INT NULL DEFAULT 1,                     -- NULL = ilimitado
    usos_actuales INT NOT NULL DEFAULT 0,
    limite_usos_por_doctor INT NOT NULL DEFAULT 1,            -- Usos permitidos por clínica/doctor
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ NULL,                               -- NULL = sin vencimiento
    clinica_id INT NULL REFERENCES nl_clinicas(id) ON DELETE SET NULL, -- Asignado a clínica específica o libre
    creado_por INT NULL REFERENCES nl_usuarios(id) ON DELETE SET NULL,
    origen VARCHAR(50) NOT NULL DEFAULT 'manual',             -- 'manual', 'ruleta_evento', 'aniversario', 'cumpleanos', 'visita'
    evento_nombre VARCHAR(150) NULL,                          -- Ej: 'Congreso Odontológico Sur', 'Visita Comercial'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Registro Histórico de Usos de Cupones (Trazabilidad estricta)
CREATE TABLE IF NOT EXISTS nl_descuentos_usos (
    id SERIAL PRIMARY KEY,
    descuento_id INT NOT NULL REFERENCES nl_descuentos(id) ON DELETE RESTRICT,
    pedido_id INT NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    clinica_id INT NOT NULL REFERENCES nl_clinicas(id) ON DELETE RESTRICT,
    usuario_id INT NULL REFERENCES nl_usuarios(id) ON DELETE SET NULL, -- Quién ingresó el pedido
    monto_descontado NUMERIC(10, 2) NOT NULL,                          -- Descuento efectivo en Soles
    monto_pedido_original NUMERIC(10, 2) NOT NULL,                      -- Subtotal/Total antes de cupón
    monto_pedido_final NUMERIC(10, 2) NOT NULL,                         -- Monto final facturable
    fecha_uso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ampliar `nl_pedidos` para almacenar referencia directa del cupón
ALTER TABLE nl_pedidos ADD COLUMN IF NOT EXISTS descuento_id INT REFERENCES nl_descuentos(id) ON DELETE SET NULL;
ALTER TABLE nl_pedidos ADD COLUMN IF NOT EXISTS descuento_codigo VARCHAR(50) NULL;
ALTER TABLE nl_pedidos ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- 4. Premios de la Ruleta de Eventos (Herramienta Comercial de Visitas)
CREATE TABLE IF NOT EXISTS nl_ruleta_premios (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(120) NOT NULL,                             -- '10% OFF en tu Próximo Pedido'
    tipo_premio VARCHAR(30) NOT NULL CHECK (tipo_premio IN ('porcentaje', 'monto_fijo', 'merch', 'sin_premio')),
    valor NUMERIC(10, 2) NULL DEFAULT 0.00,                   -- 10 (para 10%) o 50 (para S/. 50)
    descripcion TEXT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#0284c7',         -- Color de la tajada en el canvas
    texto_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
    probabilidad_peso INT NOT NULL DEFAULT 10,                -- Peso relativo para cálculo de azar
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Historial de Giros de Ruleta en Eventos / Visitas
CREATE TABLE IF NOT EXISTS nl_ruleta_giros (
    id SERIAL PRIMARY KEY,
    premio_id INT NOT NULL REFERENCES nl_ruleta_premios(id) ON DELETE RESTRICT,
    asesor_usuario_id INT NULL REFERENCES nl_usuarios(id) ON DELETE SET NULL, -- Miembro de Afinix que opera la ruleta
    clinica_id INT NULL REFERENCES nl_clinicas(id) ON DELETE SET NULL,
    doctor_nombre VARCHAR(180) NOT NULL,                       -- Nombre del doctor participante
    doctor_telefono VARCHAR(50) NULL,
    evento_nombre VARCHAR(150) NOT NULL DEFAULT 'Visita a Clínica',
    codigo_descuento_generado VARCHAR(50) NULL,                -- Código de cupón generado si ganó descuento
    fecha_giro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Índices para búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_codigo ON nl_descuentos(codigo);
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_activo ON nl_descuentos(activo);
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_clinica ON nl_descuentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_usos_descuento ON nl_descuentos_usos(descuento_id);
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_usos_clinica ON nl_descuentos_usos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_nl_descuentos_usos_pedido ON nl_descuentos_usos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nl_ruleta_premios_activo ON nl_ruleta_premios(activo);
CREATE INDEX IF NOT EXISTS idx_nl_ruleta_giros_asesor ON nl_ruleta_giros(asesor_usuario_id);

-- 7. Trigger de updated_at para descuentos y premios
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nl_descuentos_updated_at'
    ) THEN
        CREATE TRIGGER trg_nl_descuentos_updated_at
        BEFORE UPDATE ON nl_descuentos
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_nl_ruleta_premios_updated_at'
    ) THEN
        CREATE TRIGGER trg_nl_ruleta_premios_updated_at
        BEFORE UPDATE ON nl_ruleta_premios
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    END IF;
END $$;

-- 8. Premios iniciales para la Ruleta de Eventos AFINIX DENTAL LAB
INSERT INTO nl_ruleta_premios (titulo, tipo_premio, valor, descripcion, color_hex, texto_color, probabilidad_peso, activo)
SELECT '10% DCTO', 'porcentaje', 10.00, '10% de descuento en tu próximo trabajo protésico', '#0284c7', '#ffffff', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = '10% DCTO');

INSERT INTO nl_ruleta_premios (titulo, tipo_premio, valor, descripcion, color_hex, texto_color, probabilidad_peso, activo)
SELECT 'S/. 30 DCTO', 'monto_fijo', 30.00, 'Cupón de S/. 30.00 para tu próximo pedido', '#10b981', '#ffffff', 25, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = 'S/. 30 DCTO');

INSERT INTO nl_ruleta_premios (titulo, tipo_premio, valor, descripcion, color_hex, texto_color, probabilidad_peso, activo)
SELECT 'S/. 50 DCTO', 'monto_fijo', 50.00, 'Cupón especial de S/. 50.00 para tu orden', '#8b5cf6', '#ffffff', 15, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = 'S/. 50 DCTO');

INSERT INTO nl_ruleta_premios (titulo, tipo_premio, valor, descripcion, color_hex, texto_color, probabilidad_peso, activo)
SELECT 'Merch Afinix', 'merch', 0.00, 'Merchandising oficial de AFINIX DENTAL LAB (Taza/Lapicero)', '#f59e0b', '#ffffff', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = 'Merch Afinix');

INSERT INTO nl_ruleta_premios (titulo, tipo_premio, valor, descripcion, color_hex, texto_color, probabilidad_peso, activo)
SELECT 'Casi lo logras', 'sin_premio', 0.00, '¡Sigue participando en el próximo evento!', '#64748b', '#ffffff', 20, TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = 'Casi lo logras');

-- 9. Cupones de bienvenida de muestra
INSERT INTO nl_descuentos (codigo, descripcion, tipo, valor, monto_minimo_pedido, limite_usos_total, limite_usos_por_doctor, origen, activo)
SELECT 'AFINIXBIENVENIDA', 'Cupón de bienvenida 10% de descuento en el primer trabajo', 'porcentaje', 10.00, 100.00, 50, 1, 'manual', TRUE
WHERE NOT EXISTS (SELECT 1 FROM nl_descuentos WHERE codigo = 'AFINIXBIENVENIDA');
