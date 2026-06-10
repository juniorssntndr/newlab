ALTER TABLE nl_pedido_aprobaciones
    ADD COLUMN IF NOT EXISTS meet_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS meet_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS meet_requested_by INTEGER,
    ADD COLUMN IF NOT EXISTS meet_note TEXT,
    ADD COLUMN IF NOT EXISTS meet_url TEXT,
    ADD COLUMN IF NOT EXISTS meet_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS meet_created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS meet_created_by INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'nl_pedido_aprobaciones_meet_status_check'
    ) THEN
        ALTER TABLE nl_pedido_aprobaciones
            ADD CONSTRAINT nl_pedido_aprobaciones_meet_status_check
            CHECK (meet_status IS NULL OR meet_status IN ('requested', 'scheduled'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nl_aprobaciones_meet_status
    ON nl_pedido_aprobaciones(meet_status);
