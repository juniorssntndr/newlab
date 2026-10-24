import { Router } from 'express';
import { authenticateToken, forbidRole, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import { uploadProductImage } from '../services/storage.js';
import { writeAuditEvent, computeDiff } from '../services/audit.js';


const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('Solo se permiten imágenes en formato JPG, PNG o WebP'));
        }
        cb(null, true);
    }
});

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

const toNullableInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const toNullableNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value).replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
};

const toNullableBoolean = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// GET /api/productos
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { categoria_id, search, activo, visible, admite_puente } = req.query;
        let query = `SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo, m.nombre as material_nombre
                 FROM nl_productos p 
                 LEFT JOIN nl_categorias_trabajo c ON p.categoria_id = c.id 
                 LEFT JOIN nl_materiales m ON p.material_id = m.id
                 WHERE 1=1`;
        const params = [];

        // Aislamiento BOLA: clientes solo pueden consultar productos activos y visibles
        if (req.user?.tipo === 'cliente') {
            query += ' AND p.activo = true AND p.visible = true';
        } else {
            if (activo !== undefined) { params.push(activo === 'true'); query += ` AND p.activo = $${params.length}`; }
            if (visible !== undefined) { params.push(visible === 'true'); query += ` AND p.visible = $${params.length}`; }
        }

        if (categoria_id) { params.push(categoria_id); query += ` AND p.categoria_id = $${params.length}`; }
        if (search) { params.push(`%${search}%`); query += ` AND p.nombre ILIKE $${params.length}`; }
        if (admite_puente !== undefined) { params.push(admite_puente === 'true'); query += ` AND p.admite_puente = $${params.length}`; }

        query += ' ORDER BY c.orden, p.nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/productos
router.post('/', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, visible, admite_puente, modo_odontograma, permite_express } = req.body;
        const image_url = req.file ? await uploadProductImage(req.file) : null;
        const categoriaId = toNullableInt(categoria_id);
        const materialId = toNullableInt(material_id);
        const precioBase = toNullableNumber(precio_base) ?? 0;
        const tiempoEstimadoDias = toNullableInt(tiempo_estimado_dias) ?? 5;
        const visibleValue = toNullableBoolean(visible);
        const admitePuenteValue = toNullableBoolean(admite_puente);
        const permiteExpressValue = toNullableBoolean(permite_express) ?? false;
        const modoOdontogramaValue = modo_odontograma || (admitePuenteValue ? 'puente' : 'unitario');

        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Nombre es requerido' });
        if (precioBase < 0) return res.status(400).json({ error: 'El precio base no puede ser negativo' });
        if (tiempoEstimadoDias <= 0) return res.status(400).json({ error: 'El tiempo estimado debe ser mayor a 0' });

        const result = await pool.query(
            `INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, image_url, visible, admite_puente, modo_odontograma, permite_express)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [nombre, descripcion, categoriaId, precioBase, materialId, tiempoEstimadoDias, image_url, visibleValue ?? true, admitePuenteValue ?? false, modoOdontogramaValue, permiteExpressValue]
        );
        const created = result.rows[0];
        await writeAuditEvent(req, {
            entidad: 'producto',
            entidadId: created.id,
            accion: 'producto_created',
            descripcion: `Producto "${created.nombre}" creado con precio base S/ ${created.precio_base}`,
            metadata: {
                nombre: created.nombre,
                precio_base: created.precio_base,
                categoria_id: created.categoria_id,
                tiempo_estimado_dias: created.tiempo_estimado_dias
            }
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
});


// PUT /api/productos/:id
router.put('/:id', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, activo, visible, admite_puente } = req.body;
        const image_url = req.file ? await uploadProductImage(req.file) : undefined;
        const updates = [];
        const params = [];

        if (hasOwn(req.body, 'nombre')) {
            const nombreValue = String(nombre || '').trim();
            if (!nombreValue) return res.status(400).json({ error: 'Nombre es requerido' });
            params.push(nombreValue);
            updates.push(`nombre=$${params.length}`);
        }

        if (hasOwn(req.body, 'descripcion')) {
            params.push(descripcion ?? null);
            updates.push(`descripcion=$${params.length}`);
        }

        if (hasOwn(req.body, 'categoria_id')) {
            params.push(toNullableInt(categoria_id));
            updates.push(`categoria_id=$${params.length}`);
        }

        if (hasOwn(req.body, 'precio_base')) {
            const precioBase = toNullableNumber(precio_base);
            if (precioBase !== null && precioBase < 0) {
                return res.status(400).json({ error: 'El precio base no puede ser negativo' });
            }
            params.push(precioBase ?? 0);
            updates.push(`precio_base=$${params.length}`);
        }

        if (hasOwn(req.body, 'material_id')) {
            params.push(toNullableInt(material_id));
            updates.push(`material_id=$${params.length}`);
        }

        if (hasOwn(req.body, 'tiempo_estimado_dias')) {
            const tiempoEstimadoDias = toNullableInt(tiempo_estimado_dias);
            if (tiempoEstimadoDias !== null && tiempoEstimadoDias <= 0) {
                return res.status(400).json({ error: 'El tiempo estimado debe ser mayor a 0' });
            }
            params.push(tiempoEstimadoDias ?? 5);
            updates.push(`tiempo_estimado_dias=$${params.length}`);
        }

        if (hasOwn(req.body, 'activo')) {
            params.push(toNullableBoolean(activo));
            updates.push(`activo=$${params.length}`);
        }

        if (hasOwn(req.body, 'visible')) {
            params.push(toNullableBoolean(visible));
            updates.push(`visible=$${params.length}`);
        }

        if (hasOwn(req.body, 'admite_puente')) {
            params.push(toNullableBoolean(admite_puente) ?? false);
            updates.push(`admite_puente=$${params.length}`);
        }

        if (hasOwn(req.body, 'modo_odontograma')) {
            const modoValue = String(req.body.modo_odontograma || 'unitario').trim();
            params.push(modoValue);
            updates.push(`modo_odontograma=$${params.length}`);
            if (!hasOwn(req.body, 'admite_puente')) {
                params.push(modoValue === 'puente');
                updates.push(`admite_puente=$${params.length}`);
            }
        }

        if (image_url !== undefined) {
            params.push(image_url);
            updates.push(`image_url=$${params.length}`);
        }

        if (hasOwn(req.body, 'nombre_comercial')) {
            params.push(req.body.nombre_comercial ? String(req.body.nombre_comercial).trim() : null);
            updates.push(`nombre_comercial=$${params.length}`);
        }

        if (hasOwn(req.body, 'descripcion_landing')) {
            params.push(req.body.descripcion_landing ? String(req.body.descripcion_landing).trim() : null);
            updates.push(`descripcion_landing=$${params.length}`);
        }

        if (hasOwn(req.body, 'material_comercial')) {
            params.push(req.body.material_comercial ? String(req.body.material_comercial).trim() : null);
            updates.push(`material_comercial=$${params.length}`);
        }

        if (hasOwn(req.body, 'destacado_landing')) {
            params.push(toNullableBoolean(req.body.destacado_landing));
            updates.push(`destacado_landing=$${params.length}`);
        }

        if (hasOwn(req.body, 'orden_landing')) {
            params.push(toNullableInt(req.body.orden_landing) ?? 0);
            updates.push(`orden_landing=$${params.length}`);
        }

        if (hasOwn(req.body, 'permite_express')) {
            params.push(toNullableBoolean(req.body.permite_express) ?? false);
            updates.push(`permite_express=$${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay cambios para actualizar' });
        }

        params.push(req.params.id);

        const beforeQuery = await pool.query('SELECT * FROM nl_productos WHERE id = $1', [req.params.id]);
        if (beforeQuery.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        const before = beforeQuery.rows[0];

        const updateQuery = `UPDATE nl_productos SET ${updates.join(', ')} WHERE id=$${params.length} RETURNING *`;

        const result = await pool.query(updateQuery, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        const updated = result.rows[0];

        const diff = computeDiff(before, updated, ['nombre', 'precio_base', 'categoria_id', 'tiempo_estimado_dias', 'activo', 'visible', 'admite_puente', 'modo_odontograma', 'destacado_landing']);
        if (Object.keys(diff).length > 0) {
            await writeAuditEvent(req, {
                entidad: 'producto',
                entidadId: updated.id,
                accion: 'producto_updated',
                descripcion: `Producto "${updated.nombre}" actualizado`,
                metadata: { diff }
            });
        }

        res.json(updated);
    } catch (err) { next(err); }
});

// DELETE /api/productos/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `UPDATE nl_productos
             SET activo = false, visible = false
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        const deleted = result.rows[0];

        await writeAuditEvent(req, {
            entidad: 'producto',
            entidadId: deleted.id,
            accion: 'producto_deleted',
            descripcion: `Producto "${deleted.nombre}" desactivado/dado de baja`,
            metadata: {
                nombre: deleted.nombre,
                precio_base: deleted.precio_base
            }
        });

        res.json({ success: true, producto: deleted });
    } catch (err) { next(err); }
});


export default router;
