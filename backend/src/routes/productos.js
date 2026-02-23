import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import { uploadProductImage } from '../services/storage.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten imagenes'));
        }
        cb(null, true);
    }
});

const router = Router();
router.use(authenticateToken);

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

// GET /api/productos
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { categoria_id, search, activo, visible } = req.query;
        let query = `SELECT p.*, c.nombre as categoria_nombre, c.tipo as categoria_tipo, m.nombre as material_nombre
                 FROM nl_productos p 
                 LEFT JOIN nl_categorias_trabajo c ON p.categoria_id = c.id 
                 LEFT JOIN nl_materiales m ON p.material_id = m.id
                 WHERE 1=1`;
        const params = [];

        if (categoria_id) { params.push(categoria_id); query += ` AND p.categoria_id = $${params.length}`; }
        if (search) { params.push(`%${search}%`); query += ` AND p.nombre ILIKE $${params.length}`; }
        if (activo !== undefined) { params.push(activo === 'true'); query += ` AND p.activo = $${params.length}`; }
        // Note: 'visible' column is separate from 'activo'. 
        // We might want to filter by visibility for normal users but show all for admins?
        // optimizing: 'visible' logic is handled by 'activo' toggle requested by user: "interruptor de visibilidad" -> usually maps to active/inactive.
        // But plan said: "visible (BOOLEAN, default true)". Let's support it.
        if (visible !== undefined) { params.push(visible === 'true'); query += ` AND p.visible = $${params.length}`; }

        query += ' ORDER BY c.orden, p.nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/productos
router.post('/', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, visible } = req.body;
        const image_url = req.file ? await uploadProductImage(req.file) : null;
        const categoriaId = toNullableInt(categoria_id);
        const materialId = toNullableInt(material_id);
        const precioBase = toNullableNumber(precio_base) ?? 0;
        const tiempoEstimadoDias = toNullableInt(tiempo_estimado_dias) ?? 5;
        const visibleValue = toNullableBoolean(visible);

        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, image_url, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [nombre, descripcion, categoriaId, precioBase, materialId, tiempoEstimadoDias, image_url, visibleValue ?? true]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/productos/:id
router.put('/:id', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, activo, visible } = req.body;
        const image_url = req.file ? await uploadProductImage(req.file) : undefined;
        const categoriaId = toNullableInt(categoria_id);
        const precioBase = toNullableNumber(precio_base);
        const materialId = toNullableInt(material_id);
        const tiempoEstimadoDias = toNullableInt(tiempo_estimado_dias);
        const activoValue = toNullableBoolean(activo);
        const visibleValue = toNullableBoolean(visible);

        let updateQuery = `UPDATE nl_productos SET 
            nombre=COALESCE($1, nombre), 
            descripcion=COALESCE($2, descripcion), 
            categoria_id=COALESCE($3, categoria_id), 
            precio_base=COALESCE($4, precio_base),
            material_id=COALESCE($5, material_id), 
            tiempo_estimado_dias=COALESCE($6, tiempo_estimado_dias), 
            activo=COALESCE($7, activo),
            visible=COALESCE($8, visible)`;

        const params = [nombre, descripcion, categoriaId, precioBase, materialId, tiempoEstimadoDias, activoValue, visibleValue];

        if (image_url) {
            updateQuery += `, image_url=$${params.length + 1}`;
            params.push(image_url);
        }

        updateQuery += ` WHERE id=$${params.length + 1} RETURNING *`;
        params.push(req.params.id);

        const result = await pool.query(updateQuery, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

export default router;
