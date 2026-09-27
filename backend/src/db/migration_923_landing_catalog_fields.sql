-- Migration 923: Agregar campos comerciales de landing y catálogo público
ALTER TABLE nl_productos 
ADD COLUMN IF NOT EXISTS nombre_comercial VARCHAR(150),
ADD COLUMN IF NOT EXISTS descripcion_landing TEXT,
ADD COLUMN IF NOT EXISTS material_comercial VARCHAR(100),
ADD COLUMN IF NOT EXISTS destacado_landing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS orden_landing INTEGER DEFAULT 0;

-- Actualizar campos comerciales para los 8 servicios destacados del carrusel landing
UPDATE nl_productos SET
    nombre_comercial = 'Guías Quirúrgicas 3D',
    descripcion_landing = 'Guías apilables con irrigación integrada. Planificación digital desde CBCT y escaneo intraoral para cirugías guiadas predecibles.',
    material_comercial = 'Resina biocompatible',
    destacado_landing = true,
    orden_landing = 1,
    image_url = '/images/afinix-landing/service-guide.jpg'
WHERE nombre ILIKE '%Guía%Quirúrgica%3D%' OR nombre ILIKE '%Guías Quirúrgicas%';

UPDATE nl_productos SET
    nombre_comercial = 'Coronas impresas en 3D',
    descripcion_landing = 'Resina de alta performance con carga cerámica. Ajuste marginal exacto y flujo digital ágil para restauraciones inmediatas.',
    material_comercial = 'Resina cerámica',
    destacado_landing = true,
    orden_landing = 2,
    image_url = '/images/afinix-landing/service-crown-resin-3d.jpg'
WHERE nombre ILIKE '%Corona%Resina%3D%' OR nombre = 'Coronas impresas en 3D';

UPDATE nl_productos SET
    nombre_comercial = 'Carillas impresas en 3D',
    descripcion_landing = 'Carillas ultrafinas para optimizar forma, color y proporción en el sector anterior con mínima preparación y máxima precisión.',
    material_comercial = 'Resina cerámica',
    destacado_landing = true,
    orden_landing = 3,
    image_url = '/images/afinix-landing/service-veneer-resin-3d.jpg'
WHERE nombre ILIKE '%Carilla%Resina%3D%' OR nombre = 'Carillas impresas en 3D';

-- Si no existe producto de Inlay 3D, actualizamos Inlay Disilicato o creamos la variante
UPDATE nl_productos SET
    nombre_comercial = 'Inlay-Onlay en 3D',
    descripcion_landing = 'Restauraciones parciales que conservan tejido dental sano y devuelven anatomía oclusal precisa mediante tecnología digital.',
    material_comercial = 'Resina composite / cerámica',
    destacado_landing = true,
    orden_landing = 4,
    image_url = '/images/afinix-landing/service-inlay-onlay-3d.jpg'
WHERE nombre ILIKE '%Inlay%';

UPDATE nl_productos SET
    nombre_comercial = 'Coronas en Zirconia',
    descripcion_landing = 'Alta resistencia biomecánica y estética funcional posterior. Fresado CAD/CAM para ajuste micrométrico y cero retoques en sillón.',
    material_comercial = 'Zirconia multicapa',
    destacado_landing = true,
    orden_landing = 5,
    image_url = '/images/afinix-landing/service-zirconia-crown.jpg'
WHERE nombre = 'Corona Zirconia';

UPDATE nl_productos SET
    nombre_comercial = 'Carillas en Disilicato',
    descripcion_landing = 'Disilicato de litio para máxima traslucidez y naturalidad anterior. Previsualización 3D y adhesión predecible.',
    material_comercial = 'Disilicato e.max',
    destacado_landing = true,
    orden_landing = 6,
    image_url = '/images/afinix-landing/service-veneer-disilicate.jpg'
WHERE nombre = 'Carilla Disilicato';

UPDATE nl_productos SET
    nombre_comercial = 'Puentes en Zirconia',
    descripcion_landing = 'Estructuras múltiples diseñadas digitalmente para máxima rigidez estructural, asentamiento pasivo y estética uniforme.',
    material_comercial = 'Zirconia multicapa',
    destacado_landing = true,
    orden_landing = 7,
    image_url = '/images/afinix-landing/service-zirconia-bridge.jpg'
WHERE nombre = 'Puente de Zirconia';

UPDATE nl_productos SET
    nombre_comercial = 'Provisionales en PMMA',
    descripcion_landing = 'Fresado de alta densidad para proteger preparaciones clínicas, condicionar tejidos y validar oclusión y estética previa.',
    material_comercial = 'PMMA multicapa',
    destacado_landing = true,
    orden_landing = 8,
    image_url = '/images/afinix-landing/service-provisional-pmma.jpg'
WHERE nombre ILIKE '%PMMA%';
