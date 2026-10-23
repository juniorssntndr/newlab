-- Migration 941: Agregar campo permite_express a nl_productos para habilitar o deshabilitar pedidos urgentes por producto
ALTER TABLE nl_productos 
ADD COLUMN IF NOT EXISTS permite_express BOOLEAN NOT NULL DEFAULT FALSE;

-- Por directiva de gestión, desactivar el modo express para todos los productos existentes
UPDATE nl_productos SET permite_express = FALSE;
