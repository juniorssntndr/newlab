-- =========================================================================
-- SCRIPT DE LIMPIEZA DE DATOS DE PRUEBA EN PRODUCCIÓN
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================
-- Este script ELIMINA únicamente datos transaccionales de prueba (pedidos,
-- pagos, gastos, transferencias y sesiones de caja ficticias) y reinicia
-- los saldos a cero.
--
-- CONSERVA INTACTOS:
-- 1. Usuarios y Roles (nl_usuarios, nl_roles)
-- 2. Cuentas bancarias configuradas (nl_fin_cuentas)
-- 3. Socios y configuración de tesorería (nl_socios)
-- 4. Catálogo oficial de productos y precios (nl_productos)
-- 5. Almacén, materiales y stock maestro (nl_materiales, etc.)
-- 6. Clínicas y Doctores maestros (nl_clinicas, nl_doctores)
-- 7. Configuración legal de la empresa (nl_empresas)
-- =========================================================================

BEGIN;

-- 1. Limpieza de Tesorería, Caja y Finanzas
TRUNCATE TABLE nl_fin_transferencias CASCADE;
TRUNCATE TABLE nl_fin_movimientos CASCADE;
TRUNCATE TABLE nl_pagos CASCADE;
TRUNCATE TABLE nl_gastos CASCADE;
TRUNCATE TABLE nl_fin_sesiones_caja CASCADE;

-- Reiniciar saldo de cuentas bancarias y caja a S/. 0.00
UPDATE nl_fin_cuentas SET saldo_actual = 0.00;

-- 2. Limpieza de Comprobantes de Pago y Facturación
TRUNCATE TABLE nl_comprobante_pedidos CASCADE;
TRUNCATE TABLE nl_comprobantes CASCADE;

-- 3. Limpieza de Pedidos, Archivos y Trazabilidad
TRUNCATE TABLE nl_pedido_aprobaciones CASCADE;
TRUNCATE TABLE nl_pedido_archivos CASCADE;
TRUNCATE TABLE nl_pedido_items CASCADE;
TRUNCATE TABLE nl_pedido_timeline CASCADE;
TRUNCATE TABLE nl_pedidos CASCADE;

-- 4. Limpieza de Notificaciones y Saldos a Favor de prueba
TRUNCATE TABLE nl_notificaciones CASCADE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nl_saldos_favor') THEN
        TRUNCATE TABLE nl_saldos_favor CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nl_cobros_mostrador') THEN
        TRUNCATE TABLE nl_cobros_mostrador CASCADE;
    END IF;
END $$;

COMMIT;

-- Verificación final
SELECT 'Cuentas' as entidad, count(*), sum(saldo_actual) as total_saldo FROM nl_fin_cuentas
UNION ALL
SELECT 'Pedidos' as entidad, count(*), 0 FROM nl_pedidos
UNION ALL
SELECT 'Transferencias' as entidad, count(*), 0 FROM nl_fin_transferencias
UNION ALL
SELECT 'Comprobantes' as entidad, count(*), 0 FROM nl_comprobantes;
