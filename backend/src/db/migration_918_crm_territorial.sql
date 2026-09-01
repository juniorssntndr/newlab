-- Migration 918: territorial CRM, visits, complaints and import staging.
-- This file is intentionally idempotent because run_migration.js replays every migration.

UPDATE nl_doctores SET dni = NULL WHERE dni IS NOT NULL AND BTRIM(dni) = '';
ALTER TABLE nl_doctores ALTER COLUMN dni DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'nl_doctores'::regclass
      AND conname = 'nl_doctores_dni_key'
  ) THEN
    ALTER TABLE nl_doctores DROP CONSTRAINT nl_doctores_dni_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_doctores_dni_present
  ON nl_doctores (dni)
  WHERE dni IS NOT NULL AND LENGTH(BTRIM(dni)) > 0;

ALTER TABLE nl_doctores ADD COLUMN IF NOT EXISTS especialidad VARCHAR(160);
ALTER TABLE nl_doctores ADD COLUMN IF NOT EXISTS direccion TEXT;
UPDATE nl_doctores
SET especialidad = 'No especificada'
WHERE especialidad IS NULL OR BTRIM(especialidad) = '';
ALTER TABLE nl_doctores ALTER COLUMN especialidad SET NOT NULL;

ALTER TABLE nl_usuarios DROP CONSTRAINT IF EXISTS nl_usuarios_tipo_check;
ALTER TABLE nl_usuarios
  ADD CONSTRAINT nl_usuarios_tipo_check
  CHECK (tipo IN ('admin', 'tecnico', 'cliente', 'visitador'));

INSERT INTO nl_roles (nombre, permisos, activo, es_admin)
VALUES ('Visitador', '{"crm": true, "visitas_propias": true}'::jsonb, TRUE, FALSE)
ON CONFLICT (nombre) DO UPDATE SET
  permisos = EXCLUDED.permisos,
  activo = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS nl_crm_establecimientos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(220) NOT NULL,
  nombre_normalizado VARCHAR(220) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'clinica',
  telefono VARCHAR(40),
  telefono_normalizado VARCHAR(40),
  email VARCHAR(180),
  direccion TEXT,
  latitud NUMERIC(9, 6),
  longitud NUMERIC(9, 6),
  origen VARCHAR(40) NOT NULL DEFAULT 'manual',
  origen_id VARCHAR(180),
  responsable_id INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
  etapa VARCHAR(30) NOT NULL DEFAULT 'nuevo',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nl_crm_establecimientos_tipo_check
    CHECK (tipo IN ('clinica', 'consultorio', 'odontologo', 'otro')),
  CONSTRAINT nl_crm_establecimientos_etapa_check
    CHECK (etapa IN ('nuevo', 'contactado', 'visita_programada', 'visitado', 'convertido', 'descartado')),
  CONSTRAINT nl_crm_establecimientos_latitud_check
    CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CONSTRAINT nl_crm_establecimientos_longitud_check
    CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180)
);

ALTER TABLE nl_clinicas
  ADD COLUMN IF NOT EXISTS establecimiento_id INTEGER REFERENCES nl_crm_establecimientos(id) ON DELETE SET NULL;
ALTER TABLE nl_clinicas
  ADD COLUMN IF NOT EXISTS doctor_contacto_principal_id INTEGER REFERENCES nl_doctores(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_clinicas_establecimiento
  ON nl_clinicas (establecimiento_id)
  WHERE establecimiento_id IS NOT NULL;

INSERT INTO nl_crm_establecimientos (
  nombre, nombre_normalizado, tipo, telefono, telefono_normalizado,
  email, direccion, origen, origen_id, etapa, activo, created_at, updated_at
)
SELECT
  c.nombre,
  LOWER(REGEXP_REPLACE(BTRIM(c.nombre), '\s+', ' ', 'g')),
  'clinica',
  NULLIF(BTRIM(c.telefono), ''),
  NULLIF(REGEXP_REPLACE(COALESCE(c.telefono, ''), '\D', '', 'g'), ''),
  NULLIF(BTRIM(c.email), ''),
  NULLIF(BTRIM(c.direccion), ''),
  'migracion',
  'clinica:' || c.id::text,
  'convertido',
  c.estado = 'activo',
  c.created_at,
  c.updated_at
FROM nl_clinicas c
WHERE c.establecimiento_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM nl_crm_establecimientos e
    WHERE e.origen = 'migracion' AND e.origen_id = 'clinica:' || c.id::text
  );

UPDATE nl_clinicas c
SET establecimiento_id = e.id
FROM nl_crm_establecimientos e
WHERE c.establecimiento_id IS NULL
  AND e.origen = 'migracion'
  AND e.origen_id = 'clinica:' || c.id::text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_crm_establecimientos_origen_id
  ON nl_crm_establecimientos (origen, origen_id)
  WHERE origen_id IS NOT NULL AND LENGTH(BTRIM(origen_id)) > 0;
CREATE INDEX IF NOT EXISTS idx_nl_crm_establecimientos_etapa_responsable
  ON nl_crm_establecimientos (etapa, responsable_id) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_nl_crm_establecimientos_coords
  ON nl_crm_establecimientos (latitud, longitud)
  WHERE latitud IS NOT NULL AND longitud IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nl_crm_establecimientos_nombre_telefono
  ON nl_crm_establecimientos (nombre_normalizado, telefono_normalizado);

CREATE TABLE IF NOT EXISTS nl_crm_reclamos (
  id SERIAL PRIMARY KEY,
  establecimiento_id INTEGER NOT NULL REFERENCES nl_crm_establecimientos(id) ON DELETE CASCADE,
  motivo VARCHAR(220) NOT NULL,
  detalle TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
  creado_por INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
  resuelto_por INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
  resuelto_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nl_crm_reclamos_estado_check CHECK (estado IN ('abierto', 'resuelto'))
);

CREATE INDEX IF NOT EXISTS idx_nl_crm_reclamos_abiertos
  ON nl_crm_reclamos (establecimiento_id, created_at DESC)
  WHERE estado = 'abierto';

CREATE TABLE IF NOT EXISTS nl_crm_visitas (
  id SERIAL PRIMARY KEY,
  establecimiento_id INTEGER NOT NULL REFERENCES nl_crm_establecimientos(id) ON DELETE CASCADE,
  responsable_id INTEGER NOT NULL REFERENCES nl_usuarios(id),
  estado VARCHAR(30) NOT NULL DEFAULT 'programada',
  proposito TEXT,
  resultado TEXT,
  notas TEXT,
  proxima_accion TEXT,
  programada_para TIMESTAMPTZ,
  iniciada_at TIMESTAMPTZ,
  completada_at TIMESTAMPTZ,
  proxima_visita_at TIMESTAMPTZ,
  checkin_latitud NUMERIC(9, 6),
  checkin_longitud NUMERIC(9, 6),
  creado_por INTEGER REFERENCES nl_usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nl_crm_visitas_estado_check
    CHECK (estado IN ('programada', 'en_curso', 'completada', 'sin_contacto', 'reprogramada', 'cancelada')),
  CONSTRAINT nl_crm_visitas_checkin_latitud_check
    CHECK (checkin_latitud IS NULL OR checkin_latitud BETWEEN -90 AND 90),
  CONSTRAINT nl_crm_visitas_checkin_longitud_check
    CHECK (checkin_longitud IS NULL OR checkin_longitud BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_nl_crm_visitas_responsable_programada
  ON nl_crm_visitas (responsable_id, programada_para)
  WHERE estado IN ('programada', 'reprogramada');
CREATE INDEX IF NOT EXISTS idx_nl_crm_visitas_establecimiento_reciente
  ON nl_crm_visitas (establecimiento_id, COALESCE(completada_at, programada_para, created_at) DESC);

CREATE TABLE IF NOT EXISTS nl_crm_importaciones (
  id SERIAL PRIMARY KEY,
  nombre_archivo VARCHAR(260) NOT NULL,
  formato VARCHAR(10) NOT NULL,
  mapeo JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado VARCHAR(20) NOT NULL DEFAULT 'previsualizada',
  total_filas INTEGER NOT NULL DEFAULT 0,
  filas_validas INTEGER NOT NULL DEFAULT 0,
  filas_error INTEGER NOT NULL DEFAULT 0,
  filas_duplicadas INTEGER NOT NULL DEFAULT 0,
  creado_por INTEGER NOT NULL REFERENCES nl_usuarios(id),
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nl_crm_importaciones_formato_check CHECK (formato IN ('csv', 'xlsx')),
  CONSTRAINT nl_crm_importaciones_estado_check CHECK (estado IN ('previsualizada', 'procesando', 'completada', 'fallida'))
);

CREATE TABLE IF NOT EXISTS nl_crm_importacion_filas (
  id SERIAL PRIMARY KEY,
  importacion_id INTEGER NOT NULL REFERENCES nl_crm_importaciones(id) ON DELETE CASCADE,
  numero_fila INTEGER NOT NULL,
  datos_originales JSONB NOT NULL,
  datos_normalizados JSONB,
  errores JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado VARCHAR(20) NOT NULL DEFAULT 'valida',
  duplicado_establecimiento_id INTEGER REFERENCES nl_crm_establecimientos(id) ON DELETE SET NULL,
  aprobada BOOLEAN NOT NULL DEFAULT TRUE,
  establecimiento_id INTEGER REFERENCES nl_crm_establecimientos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nl_crm_importacion_filas_estado_check
    CHECK (estado IN ('valida', 'duplicada', 'error', 'importada', 'omitida')),
  CONSTRAINT uq_nl_crm_importacion_fila UNIQUE (importacion_id, numero_fila)
);

CREATE INDEX IF NOT EXISTS idx_nl_crm_importacion_filas_lote_estado
  ON nl_crm_importacion_filas (importacion_id, estado, aprobada);

DROP TRIGGER IF EXISTS trg_nl_crm_establecimientos_updated_at ON nl_crm_establecimientos;
CREATE TRIGGER trg_nl_crm_establecimientos_updated_at
BEFORE UPDATE ON nl_crm_establecimientos
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_crm_reclamos_updated_at ON nl_crm_reclamos;
CREATE TRIGGER trg_nl_crm_reclamos_updated_at
BEFORE UPDATE ON nl_crm_reclamos
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();

DROP TRIGGER IF EXISTS trg_nl_crm_visitas_updated_at ON nl_crm_visitas;
CREATE TRIGGER trg_nl_crm_visitas_updated_at
BEFORE UPDATE ON nl_crm_visitas
FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
