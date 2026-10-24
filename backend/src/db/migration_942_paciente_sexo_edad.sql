-- Migration 942: Agregar paciente_sexo y paciente_edad a nl_pedidos
ALTER TABLE nl_pedidos
ADD COLUMN IF NOT EXISTS paciente_sexo VARCHAR(20),
ADD COLUMN IF NOT EXISTS paciente_edad INTEGER;
