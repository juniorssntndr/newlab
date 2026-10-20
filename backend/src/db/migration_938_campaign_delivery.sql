-- AFINIX: campaign-specific coupons, frozen recipients and bounded dispatch receipts.
-- Apply explicitly during deployment. The application never applies this migration.
BEGIN;
ALTER TABLE nl_campanas_marketing ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMPTZ;
ALTER TABLE nl_campanas_marketing ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_coupon ON nl_campanas_marketing(cupon_id) WHERE cupon_id IS NOT NULL AND fecha_inicio IS NOT NULL;

CREATE TABLE IF NOT EXISTS nl_campana_destinatarios (
    campana_id INTEGER NOT NULL REFERENCES nl_campanas_marketing(id),
    usuario_id INTEGER NOT NULL REFERENCES nl_usuarios(id),
    clinica_id INTEGER NOT NULL REFERENCES nl_clinicas(id),
    PRIMARY KEY (campana_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipient_clinic ON nl_campana_destinatarios(campana_id, clinica_id);
CREATE TABLE IF NOT EXISTS nl_campana_envios (
    id UUID PRIMARY KEY,
    request_id VARCHAR(80) NOT NULL,
    creado_por INTEGER NOT NULL REFERENCES nl_usuarios(id),
    payload_hash CHAR(64) NOT NULL,
    es_prueba BOOLEAN NOT NULL,
    campana_id INTEGER REFERENCES nl_campanas_marketing(id),
    estado TEXT NOT NULL CHECK (estado IN ('dispatching', 'completed', 'partial')),
    metricas JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (creado_por, request_id)
);
CREATE TABLE IF NOT EXISTS nl_campana_push_envios (
    envio_id UUID NOT NULL REFERENCES nl_campana_envios(id),
    subscription_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('pending', 'sending', 'accepted', 'failed', 'skipped')),
    PRIMARY KEY (envio_id, subscription_id)
);

-- Only campaign coupons are guarded. Existing ordinary coupons keep their behavior.
-- The existing order transaction already locks the coupon; this lock also protects
-- any other writer. A failed quota check rolls back the order and its discount totals.
CREATE OR REPLACE FUNCTION nl_guard_campaign_coupon_usage() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE coupon nl_descuentos%ROWTYPE; campaign nl_campanas_marketing%ROWTYPE; used_count INTEGER;
BEGIN
    SELECT * INTO campaign FROM nl_campanas_marketing WHERE cupon_id = NEW.descuento_id AND fecha_inicio IS NOT NULL;
    IF NOT FOUND THEN RETURN NEW; END IF;
    SELECT * INTO coupon FROM nl_descuentos WHERE id = NEW.descuento_id FOR UPDATE;
    IF NOT coupon.activo OR NOT campaign.activo OR NOW() < coupon.fecha_inicio OR NOW() > coupon.fecha_fin THEN
        RAISE EXCEPTION 'El cupón de campaña no está vigente.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM nl_campana_destinatarios WHERE campana_id = campaign.id AND clinica_id = NEW.clinica_id) THEN
        RAISE EXCEPTION 'La clínica no pertenece a esta campaña.' USING ERRCODE = '23514';
    END IF;
    SELECT COUNT(*) INTO used_count FROM nl_descuentos_usos WHERE descuento_id = NEW.descuento_id AND clinica_id = NEW.clinica_id;
    IF used_count >= coupon.limite_usos_por_doctor THEN
        RAISE EXCEPTION 'La clínica ya utilizó el beneficio de esta campaña.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_campaign_coupon_usage ON nl_descuentos_usos;
CREATE TRIGGER trg_campaign_coupon_usage BEFORE INSERT ON nl_descuentos_usos FOR EACH ROW EXECUTE FUNCTION nl_guard_campaign_coupon_usage();
COMMIT;
