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
    referencia: z.string().trim().max(120).optional().nullable(),
    fecha_pago: z.string().max(30).optional().nullable(),
    notas: z.string().trim().max(1000).optional().nullable()
});
