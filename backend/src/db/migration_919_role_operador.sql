-- Migration 919: Rol Operador y actualización de matriz de roles
-- Idempotent script to add 'Operador' role and ensure constraints support it

INSERT INTO nl_roles (nombre, permisos, activo, es_admin)
SELECT 'Operador', '{"caja":true,"gastos":true,"cobranzas":true,"pedidos":true,"crm_visitas":true}', true, false
WHERE NOT EXISTS (
    SELECT 1 FROM nl_roles WHERE LOWER(nombre) = 'operador'
);

-- Actualizar comentario o verificar consistencia
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'nl_usuarios_tipo_check'
    ) THEN
        ALTER TABLE nl_usuarios DROP CONSTRAINT nl_usuarios_tipo_check;
        ALTER TABLE nl_usuarios ADD CONSTRAINT nl_usuarios_tipo_check
            CHECK (tipo IN ('admin', 'operador', 'tecnico', 'visitador', 'cliente'));
    END IF;
END $$;
