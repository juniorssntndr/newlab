-- migration_916_identity_local_overrides.sql
-- Registro local de DNI/RUC cuando RENIEC/SUNAT no los encuentra (o se cargan a mano).

CREATE TABLE IF NOT EXISTS nl_identity_overrides (
    document_type   VARCHAR(2)  NOT NULL,  -- '1' DNI, '6' RUC
    document_number VARCHAR(20) NOT NULL,
    full_name       VARCHAR(220) NOT NULL,
    nombres         VARCHAR(120),
    apellido_paterno VARCHAR(80),
    apellido_materno VARCHAR(80),
    direccion       TEXT,
    ubigeo          VARCHAR(10),
    source          VARCHAR(20) NOT NULL DEFAULT 'manual',
    not_in_reniec   BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_type, document_number)
);

CREATE INDEX IF NOT EXISTS idx_nl_identity_overrides_number
    ON nl_identity_overrides (document_number);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'nl_set_updated_at') THEN
    EXECUTE $t$
      CREATE TRIGGER nl_identity_overrides_updated_at
        BEFORE UPDATE ON nl_identity_overrides
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    $t$;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
