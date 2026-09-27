-- =========================================================================
-- MIGRATION 930: LIMPIEZA DE CUENTAS FINANCIERAS DUPLICADAS (POST MIGRATION 908/927)
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

DO $$
DECLARE
    v_caja_oficial_id INTEGER;
    v_banco_oficial_id INTEGER;
BEGIN
    -- Identificar cuenta oficial de Caja
    SELECT id INTO v_caja_oficial_id 
    FROM nl_fin_cuentas 
    WHERE nombre = 'Caja Principal (Efectivo)' 
    ORDER BY id ASC 
    LIMIT 1;

    -- Identificar cuenta oficial de Banco BCP
    SELECT id INTO v_banco_oficial_id 
    FROM nl_fin_cuentas 
    WHERE nombre = 'BCP Operativo (Principal)' 
    ORDER BY id ASC 
    LIMIT 1;

    -- Fallback de seguridad si no existen por nombre exacto
    IF v_caja_oficial_id IS NULL THEN
        SELECT id INTO v_caja_oficial_id FROM nl_fin_cuentas WHERE tipo_cuenta = 'caja' ORDER BY id ASC LIMIT 1;
    END IF;

    IF v_banco_oficial_id IS NULL THEN
        SELECT id INTO v_banco_oficial_id FROM nl_fin_cuentas WHERE tipo_cuenta = 'banco' ORDER BY id ASC LIMIT 1;
    END IF;

    -- Reasignar cualquier movimiento accidental de las cuentas duplicadas a las oficiales
    IF v_caja_oficial_id IS NOT NULL THEN
        UPDATE nl_fin_movimientos
        SET cuenta_id = v_caja_oficial_id
        WHERE cuenta_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Caja Principal' AND id <> v_caja_oficial_id
        );

        UPDATE nl_pagos
        SET cuenta_id = v_caja_oficial_id
        WHERE cuenta_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Caja Principal' AND id <> v_caja_oficial_id
        );

        UPDATE nl_fin_transferencias
        SET cuenta_origen_id = v_caja_oficial_id
        WHERE cuenta_origen_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Caja Principal' AND id <> v_caja_oficial_id
        );

        UPDATE nl_fin_transferencias
        SET cuenta_destino_id = v_caja_oficial_id
        WHERE cuenta_destino_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Caja Principal' AND id <> v_caja_oficial_id
        );

        -- Eliminar la cuenta duplicada de Caja
        DELETE FROM nl_fin_cuentas 
        WHERE nombre = 'Caja Principal' AND id <> v_caja_oficial_id;
    END IF;

    IF v_banco_oficial_id IS NOT NULL THEN
        UPDATE nl_fin_movimientos
        SET cuenta_id = v_banco_oficial_id
        WHERE cuenta_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Banco Principal' AND id <> v_banco_oficial_id
        );

        UPDATE nl_pagos
        SET cuenta_id = v_banco_oficial_id
        WHERE cuenta_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Banco Principal' AND id <> v_banco_oficial_id
        );

        UPDATE nl_fin_transferencias
        SET cuenta_origen_id = v_banco_oficial_id
        WHERE cuenta_origen_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Banco Principal' AND id <> v_banco_oficial_id
        );

        UPDATE nl_fin_transferencias
        SET cuenta_destino_id = v_banco_oficial_id
        WHERE cuenta_destino_id IN (
            SELECT id FROM nl_fin_cuentas 
            WHERE nombre = 'Banco Principal' AND id <> v_banco_oficial_id
        );

        -- Eliminar la cuenta duplicada de Banco
        DELETE FROM nl_fin_cuentas 
        WHERE nombre = 'Banco Principal' AND id <> v_banco_oficial_id;
    END IF;

END $$;
