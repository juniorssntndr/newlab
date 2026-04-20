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
    producto_id: z.coerce.number().int().positive().optional().nullable(),
    clinica_id: z.coerce.number().int().positive().optional().nullable(),
    descripcion: z.string().trim().max(1000).optional().nullable(),
    referencia: z.string().trim().max(120).optional().nullable()
}).superRefine((value, ctx) => {
    if (value.tipo === 'egreso' && !value.categoria_gasto) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'La categoria de gasto es obligatoria para egresos.',
            path: ['categoria_gasto']
        });
    }
    if (value.tipo === 'egreso' && !value.grupo_gasto) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El grupo de gasto es obligatorio para egresos.',
            path: ['grupo_gasto']
        });
    }
});

export const updateMovimientoFinancieroSchema = createMovimientoFinancieroSchema;
