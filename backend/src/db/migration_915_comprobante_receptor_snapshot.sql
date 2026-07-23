-- migration_915_comprobante_receptor_snapshot.sql
-- Persiste el receptor (cliente) en el comprobante al momento de emisión
-- para que NC/anulaciones/contexto fiscal no dependan del JOIN live a nl_clinicas.

ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_tipo_doc VARCHAR(2);
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_documento VARCHAR(20);
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_razon_social VARCHAR(220);
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_direccion TEXT;
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_ubigeo VARCHAR(10);
ALTER TABLE nl_comprobantes ADD COLUMN IF NOT EXISTS receptor_snapshot_at TIMESTAMPTZ;
