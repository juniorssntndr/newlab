-- Migration 930: Estandarización de Modo de Odontograma en Catálogo
ALTER TABLE nl_productos 
ADD COLUMN IF NOT EXISTS modo_odontograma VARCHAR(30) DEFAULT 'unitario';

-- Sincronizar datos iniciales basados en naturaleza clínica
UPDATE nl_productos 
SET modo_odontograma = 'puente'
WHERE nombre ILIKE '%puente%';

UPDATE nl_productos 
SET modo_odontograma = 'carilla'
WHERE nombre ILIKE '%carilla%';

UPDATE nl_productos 
SET modo_odontograma = 'arcada'
WHERE nombre ILIKE '%férula%' 
   OR nombre ILIKE '%ferula%' 
   OR nombre ILIKE '%prótesis total%' 
   OR nombre ILIKE '%protesis total%'
   OR nombre ILIKE '%total%'
   OR nombre ILIKE '%alineador%';

UPDATE nl_productos 
SET modo_odontograma = 'guia_quirurgica'
WHERE nombre ILIKE '%guía quirúrgica%' 
   OR nombre ILIKE '%guia quirurgica%' 
   OR nombre ILIKE '%quirúrgic%' 
   OR nombre ILIKE '%quirurgic%';
