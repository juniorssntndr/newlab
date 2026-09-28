-- =========================================================================
-- MIGRATION 934: RULETA EVENTOS - STOCK DE MERCH, TICKETS Y NOTIFICACIONES
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- 1. Ampliar nl_ruleta_premios para control de stock de merchandising y orden
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS stock_disponible INT NULL DEFAULT NULL; -- NULL = ilimitado
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS stock_entregado INT NOT NULL DEFAULT 0;
ALTER TABLE nl_ruleta_premios ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 0;

-- 2. Ampliar nl_descuentos con bandera de producto único y días de vencimiento
ALTER TABLE nl_descuentos ADD COLUMN IF NOT EXISTS para_un_solo_producto BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Ampliar nl_notificaciones con campo JSONB para tickets y regalos
ALTER TABLE nl_notificaciones ADD COLUMN IF NOT EXISTS data JSONB NULL;

-- 4. Ampliar nl_ruleta_giros con ticket_impreso y entrega física de merch
ALTER TABLE nl_ruleta_giros ADD COLUMN IF NOT EXISTS merch_entregado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nl_ruleta_giros ADD COLUMN IF NOT EXISTS fecha_vencimiento_ticket TIMESTAMPTZ NULL;

-- 5. Semillas actualizadas para premios con stock de muestra
UPDATE nl_ruleta_premios 
SET stock_disponible = 10, descripcion = 'Agenda ejecutiva 2026 oficial de AFINIX DENTAL LAB'
WHERE titulo = 'Merch Afinix' AND stock_disponible IS NULL;
