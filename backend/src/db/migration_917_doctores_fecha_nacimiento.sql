-- Migration 917: fecha de nacimiento opcional en doctores (regalos / próximos cumpleaños)
-- Safe additive change: nullable column, no backfill required.

ALTER TABLE nl_doctores
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

COMMENT ON COLUMN nl_doctores.fecha_nacimiento IS
  'Fecha de nacimiento del doctor (opcional). Usada para recordatorios de cumpleaños.';
