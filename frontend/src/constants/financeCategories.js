export const CATEGORIA_GASTO_LABELS = {
    materiales: 'Materiales e Insumos',
    logistica: 'Logística y Envíos',
    servicios: 'Servicios Básicos',
    alquiler: 'Alquiler de Local',
    sueldos: 'Personal y Planilla',
    personal: 'Personal y Planilla',
    mantenimiento: 'Mantenimiento y Equipos',
    gastos_generales: 'Gastos Generales y Oficina',
    administracion: 'Gastos Generales y Oficina',
    administracion_limpieza: 'Gastos Generales y Oficina',
    marketing: 'Marketing y Publicidad',
    otros: 'Otros Gastos',
    // Compatibilidad histórica para registros existentes
    combustible: 'Logística (Combustible)',
    movilidad: 'Logística (Movilidad)'
};

export const formatCategoriaGasto = (value = '') => {
    if (!value) return 'Sin categoría';
    const key = String(value).toLowerCase().trim();
    if (CATEGORIA_GASTO_LABELS[key]) return CATEGORIA_GASTO_LABELS[key];
    return value
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
};
