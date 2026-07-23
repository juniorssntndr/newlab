-- Migration 914: Identity masters — clinicas fiscal enrichment + nl_doctores + associations
-- Run after migration 912/913

-- nl_clinicas fiscal enrichment columns
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(220);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS estado_ruc VARCHAR(50);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS condicion_ruc VARCHAR(80);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS departamento VARCHAR(80);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS provincia VARCHAR(80);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS distrito VARCHAR(80);
ALTER TABLE nl_clinicas ADD COLUMN IF NOT EXISTS validado_externo_at TIMESTAMPTZ;

-- Unique RUC when present (partial index — allows NULL and empty)
CREATE UNIQUE INDEX IF NOT EXISTS uq_nl_clinicas_ruc
  ON nl_clinicas (ruc) WHERE ruc IS NOT NULL AND length(trim(ruc)) > 0;

-- Doctors master table
CREATE TABLE IF NOT EXISTS nl_doctores (
  id                  SERIAL PRIMARY KEY,
  dni                 VARCHAR(8)   NOT NULL UNIQUE,
  nombres             VARCHAR(120) NOT NULL,
  apellido_paterno    VARCHAR(80),
  apellido_materno    VARCHAR(80),
  nombre_completo     VARCHAR(220) NOT NULL,
  cop                 VARCHAR(40),
  email               VARCHAR(160),
  telefono            VARCHAR(40),
  estado              VARCHAR(20)  DEFAULT 'activo',
  validado_externo_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'nl_set_updated_at'
  ) THEN
    EXECUTE $t$
      CREATE TRIGGER nl_doctores_updated_at
        BEFORE UPDATE ON nl_doctores
        FOR EACH ROW EXECUTE FUNCTION nl_set_updated_at();
    $t$;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Clinica ↔ Doctor many-to-many association
CREATE TABLE IF NOT EXISTS nl_clinica_doctores (
  clinica_id  INTEGER NOT NULL REFERENCES nl_clinicas(id) ON DELETE CASCADE,
  doctor_id   INTEGER NOT NULL REFERENCES nl_doctores(id) ON DELETE CASCADE,
  es_principal BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (clinica_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_clinica_doctores_doctor
  ON nl_clinica_doctores(doctor_id);
