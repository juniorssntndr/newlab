-- Migration 926: Permitir tipos 'stl' y 'doc' en nl_pedido_archivos
ALTER TABLE nl_pedido_archivos DROP CONSTRAINT IF EXISTS nl_pedido_archivos_tipo_check;

ALTER TABLE nl_pedido_archivos 
ADD CONSTRAINT nl_pedido_archivos_tipo_check 
CHECK (tipo IN ('color', 'caso', 'final', 'otro', 'stl', 'doc'));
