import { z } from 'zod';

const cantidadSchema = z.coerce.number({ message: 'Debe ser numerico' }).finite().min(0.01).max(9999);
const precioUnitarioSchema = z.coerce.number({ message: 'Debe ser numerico' }).finite().min(0).max(100000);
const montoSchema = z.coerce.number({ message: 'Debe ser numerico' }).finite().min(0.01).max(10000000);

export const loginSchema = z.object({
    email: z.string().trim().email({ message: 'Email invalido' }).max(180),
    password: z.string().min(1).max(120)
});

export const createPedidoSchema = z.object({
    clinica_id: z.coerce.number().int().positive(),
    paciente_nombre: z.string().trim().min(2).max(180),
    fecha_entrega: z.string().min(8).max(30),
    observaciones: z.string().trim().max(5000).optional().nullable(),
    archivos_urls: z.array(z.string().trim().max(2000)).optional().default([]),
    items: z.array(z.object({
        producto_id: z.coerce.number().int().positive().optional().nullable(),
        piezas_dentales: z.array(z.string()).optional().default([]),
        pilares_dentales: z.array(z.string()).optional().default([]),
        es_puente: z.boolean().optional().default(false),
        pieza_inicio: z.string().trim().max(20).optional().nullable(),
        pieza_fin: z.string().trim().max(20).optional().nullable(),
        material: z.string().trim().max(120).optional().nullable(),
        color_vita: z.string().trim().max(50).optional().nullable(),
        color_munon: z.string().trim().max(50).optional().nullable(),
        textura: z.string().trim().max(120).optional().nullable(),
        oclusion: z.string().trim().max(120).optional().nullable(),
        notas: z.string().trim().max(3000).optional().nullable(),
        cantidad: cantidadSchema.optional().default(1),
        precio_unitario: precioUnitarioSchema.optional().default(0)
    })).max(200).optional().default([])
});

export const createPagoSchema = z.object({
    monto: montoSchema,
    metodo: z.string().trim().max(50).optional().nullable(),
    tipo_fondo: z.enum(['caja', 'banco']).optional().nullable(),
    cuenta_id: z.coerce.number().int().positive().optional().nullable(),
    referencia: z.string().trim().max(120).optional().nullable(),
    fecha_pago: z.string().max(30).optional().nullable(),
    notas: z.string().trim().max(1000).optional().nullable()
});

export const createMovimientoFinancieroSchema = z.object({
    tipo: z.enum(['ingreso', 'egreso']).default('egreso'),
    tipo_fondo: z.enum(['caja', 'banco']).optional().nullable(),
    cuenta_id: z.coerce.number().int().positive().optional().nullable(),
    fecha_movimiento: z.string().max(30).optional().nullable(),
    monto: montoSchema,
    grupo_gasto: z.enum(['operativo', 'costo_directo', 'otro']).optional().nullable(),
    categoria_gasto: z.string().trim().max(80).optional().nullable(),
    beneficiario: z.string().trim().max(200).optional().nullable(),
    producto_id: z.coerce.number().int().positive().optional().nullable(),
    clinica_id: z.coerce.number().int().positive().optional().nullable(),
    descripcion: z.string().trim().max(1000).optional().nullable(),
    referencia: z.string().trim().max(120).optional().nullable(),

    // Campos de sustento (Fiscal, Simple, Ninguno)
    sustento_tipo: z.enum(['fiscal', 'simple', 'ninguno']).default('ninguno'),
    sustento_comprobante_tipo: z.string().trim().max(50).optional().nullable(),
    sustento_emisor_doc: z.string().trim().max(20).optional().nullable(),
    sustento_emisor_razon_social: z.string().trim().max(200).optional().nullable(),
    sustento_serie: z.string().trim().max(20).optional().nullable(),
    sustento_numero: z.string().trim().max(30).optional().nullable(),
    sustento_fecha_emision: z.string().max(30).optional().nullable(),
    sustento_archivo_url: z.string().trim().max(2000).optional().nullable(),
    sustento_nota: z.string().trim().max(1000).optional().nullable(),
    sustento_observacion: z.string().trim().max(1000).optional().nullable()
}).superRefine((value, ctx) => {
    if (value.tipo === 'egreso') {
        if (!value.categoria_gasto) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La categoría de gasto es obligatoria para egresos.',
                path: ['categoria_gasto']
            });
        }
        if (!value.grupo_gasto) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'El grupo de gasto es obligatorio para egresos.',
                path: ['grupo_gasto']
            });
        }
        if (value.sustento_tipo === 'ninguno' && (!value.sustento_observacion || !value.sustento_observacion.trim())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Para gastos sin sustento fiscal o simple, la observación explicativa es obligatoria.',
                path: ['sustento_observacion']
            });
        }
    }
});

export const updateMovimientoFinancieroSchema = createMovimientoFinancieroSchema;
