-- Migration 928: RBAC granular con permisos_modulos y auto-registro de clientes
-- Idempotente para ejecutar con run_migration.js

-- 1. Agregar rol 'Socio' si no existe
INSERT INTO nl_roles (nombre, permisos, activo, es_admin)
SELECT 'Socio', '{"dashboard":true,"pedidos":true,"caja":true,"cobros":true,"calendario":true,"crm":true,"catalogo":true,"cuenta":true}'::jsonb, true, false
WHERE NOT EXISTS (
    SELECT 1 FROM nl_roles WHERE LOWER(nombre) = 'socio'
);

-- 2. Asegurar que los roles existentes tengan sus módulos por defecto bien definidos
UPDATE nl_roles
SET permisos = '{"dashboard":true,"pedidos":true,"caja":true,"cobros":true,"calendario":true,"crm":true,"catalogo":true,"almacen":true,"usuarios":true,"cuenta":true}'::jsonb
WHERE es_admin = true OR LOWER(nombre) = 'administrador';

UPDATE nl_roles
SET permisos = '{"dashboard":true,"pedidos":true,"caja":true,"cobros":true,"calendario":true,"crm":true,"catalogo":true,"cuenta":true}'::jsonb
WHERE LOWER(nombre) = 'socio';

UPDATE nl_roles
SET permisos = '{"pedidos":true,"catalogo":true,"almacen":true,"calendario":true,"cuenta":true}'::jsonb
WHERE LOWER(nombre) IN ('técnico', 'tecnico', 'protesista');

UPDATE nl_roles
SET permisos = '{"caja":true,"pedidos":true,"calendario":true,"crm":true,"catalogo":true,"cuenta":true}'::jsonb
WHERE LOWER(nombre) IN ('operador', 'recepcionista');

UPDATE nl_roles
SET permisos = '{"crm":true,"calendario":true,"cuenta":true}'::jsonb
WHERE LOWER(nombre) = 'visitador';

UPDATE nl_roles
SET permisos = '{"pedidos_cliente":true,"catalogo_cliente":true,"cuenta":true}'::jsonb
WHERE LOWER(nombre) = 'cliente';

-- 3. Agregar columna permisos_modulos en nl_usuarios para sobreescritura individual
ALTER TABLE nl_usuarios ADD COLUMN IF NOT EXISTS permisos_modulos JSONB DEFAULT NULL;

-- 4. Actualizar constraints de tipo en nl_usuarios
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nl_usuarios_tipo_check'
    ) THEN
        ALTER TABLE nl_usuarios DROP CONSTRAINT nl_usuarios_tipo_check;
    END IF;
    ALTER TABLE nl_usuarios ADD CONSTRAINT nl_usuarios_tipo_check
        CHECK (tipo IN ('admin', 'socio', 'operador', 'tecnico', 'visitador', 'cliente'));
END $$;

-- 5. Actualizar constraints de estado en nl_usuarios y nl_clinicas para admitir 'pendiente'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nl_usuarios_estado_check'
    ) THEN
        ALTER TABLE nl_usuarios DROP CONSTRAINT nl_usuarios_estado_check;
    END IF;
    ALTER TABLE nl_usuarios ADD CONSTRAINT nl_usuarios_estado_check
        CHECK (estado IN ('activo', 'inactivo', 'pendiente'));

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'nl_clinicas_estado_check'
    ) THEN
        ALTER TABLE nl_clinicas DROP CONSTRAINT nl_clinicas_estado_check;
    END IF;
    ALTER TABLE nl_clinicas ADD CONSTRAINT nl_clinicas_estado_check
        CHECK (estado IN ('activo', 'inactivo', 'pendiente'));
END $$;
