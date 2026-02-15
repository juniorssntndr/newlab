import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const router = Router();
router.use(authenticateToken);

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
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

        const result = await pool.query(
            `INSERT INTO nl_productos (nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, image_url, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [nombre, descripcion, categoria_id, precio_base || 0, material_id || null, tiempo_estimado_dias || 5, image_url, visible === 'true' || visible === true]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/productos/:id
router.put('/:id', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, activo, visible } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

        let updateQuery = `UPDATE nl_productos SET 
            nombre=COALESCE($1, nombre), 
            descripcion=COALESCE($2, descripcion), 
            categoria_id=COALESCE($3, categoria_id), 
            precio_base=COALESCE($4, precio_base),
            material_id=COALESCE($5, material_id), 
            tiempo_estimado_dias=COALESCE($6, tiempo_estimado_dias), 
            activo=COALESCE($7, activo),
            visible=COALESCE($8, visible)`;

        const params = [nombre, descripcion, categoria_id, precio_base, material_id, tiempo_estimado_dias, activo, visible];

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
