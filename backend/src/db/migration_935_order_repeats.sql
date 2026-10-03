BEGIN;
ALTER TABLE nl_pedidos
    ADD COLUMN IF NOT EXISTS repeat_source_id INTEGER REFERENCES nl_pedidos(id),
    ADD COLUMN IF NOT EXISTS repeat_kind VARCHAR(10) CHECK (repeat_kind IN ('warranty', 'paid')),
    ADD COLUMN IF NOT EXISTS repeat_reason TEXT,
    ADD COLUMN IF NOT EXISTS repeat_reference_total NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS repeat_request_key UUID UNIQUE,
    ADD COLUMN IF NOT EXISTS repeat_request_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_nl_pedidos_repeat_source ON nl_pedidos(repeat_source_id) WHERE repeat_source_id IS NOT NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='nl_pedidos_repeat_integrity') THEN
        ALTER TABLE nl_pedidos ADD CONSTRAINT nl_pedidos_repeat_integrity CHECK (
            repeat_source_id IS NULL OR (repeat_source_id <> id AND repeat_kind IS NOT NULL
                AND repeat_reason IS NOT NULL AND repeat_request_key IS NOT NULL
                AND repeat_request_hash IS NOT NULL AND repeat_reference_total IS NOT NULL AND repeat_reference_total >= 0
                AND (repeat_kind <> 'warranty' OR (total=0 AND subtotal=0 AND igv=0)))
        );
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS nl_pedido_repeat_photos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES nl_pedidos(id) ON DELETE CASCADE,
    mime_type VARCHAR(20) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
    data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nl_repeat_photos_pedido ON nl_pedido_repeat_photos(pedido_id);
-- No browser/PostgREST role can read clinical evidence directly.
ALTER TABLE nl_pedido_repeat_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nl_pedido_repeat_photos FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
        REVOKE ALL ON nl_pedido_repeat_photos FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
        REVOKE ALL ON nl_pedido_repeat_photos FROM authenticated;
    END IF;
END $$;
-- Guard every writer (including approval endpoints) against reopening a shipped order.
CREATE OR REPLACE FUNCTION nl_preserve_sent_order() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado = 'enviado' AND NEW.estado <> 'enviado' THEN
        RAISE EXCEPTION 'Un pedido enviado no puede retroceder; cree una repetición vinculada';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_nl_preserve_sent_order ON nl_pedidos;
CREATE TRIGGER trg_nl_preserve_sent_order BEFORE UPDATE OF estado ON nl_pedidos
FOR EACH ROW EXECUTE FUNCTION nl_preserve_sent_order();
COMMIT;
