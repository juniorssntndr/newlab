-- Create materials table
CREATE TABLE IF NOT EXISTS nl_materiales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    stock_actual DECIMAL(10, 2) DEFAULT 0,
    stock_minimo DECIMAL(10, 2) DEFAULT 5,
    unidad VARCHAR(50) DEFAULT 'unid',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to products table
ALTER TABLE nl_productos ADD COLUMN IF NOT EXISTS material_id INTEGER REFERENCES nl_materiales(id);
ALTER TABLE nl_productos ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
ALTER TABLE nl_productos ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;
