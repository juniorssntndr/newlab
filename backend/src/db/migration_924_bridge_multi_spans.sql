-- Migration 924: Soporte para puentes dentales múltiples tramos y guías de color
ALTER TABLE nl_productos 
ADD COLUMN IF NOT EXISTS admite_puente BOOLEAN DEFAULT false;

-- Inicializar admite_puente = true para productos de Zirconia, PMMA, Puentes e Implantes
UPDATE nl_productos 
SET admite_puente = true 
WHERE nombre ILIKE '%puente%' 
   OR nombre ILIKE '%zirconia%' 
   OR nombre ILIKE '%pmma%' 
   OR nombre ILIKE '%implante%';

ALTER TABLE nl_pedido_items
ADD COLUMN IF NOT EXISTS ponticos_dentales TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tramos_detalle JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS guia_color VARCHAR(30) DEFAULT 'vita';
