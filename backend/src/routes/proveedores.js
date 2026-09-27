import { Router } from 'express';
import { authenticateToken, forbidRole, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);
router.use(forbidRole('visitador'));

const toNullableString = (value) => {
    if (value === undefined || value === null) return null;
    const v = String(value).trim();
    return v ? v : null;
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return fallback;
};

// GET /api/proveedores - List all providers with material counts
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { search, tipo, estado, rubro } = req.query;
        const params = [];
        let query = `
            SELECT 
                p.*,
                COUNT(pm.id)::int AS total_materiales,
                MAX(pm.fecha_ultimo_precio) AS ultima_cotizacion
            FROM nl_proveedores p
            LEFT JOIN nl_proveedor_materiales pm ON pm.proveedor_id = p.id
            WHERE 1=1
        `;

        const normalizedEstado = String(estado || 'activos').trim().toLowerCase();
        if (normalizedEstado === 'inactivos') {
            query += ' AND p.activo = false';
        } else if (normalizedEstado !== 'todos') {
            query += ' AND p.activo = true';
        }

        if (tipo && tipo !== 'todos') {
            params.push(tipo);
            query += ` AND p.tipo_proveedor = $${params.length}`;
        }

        if (rubro && rubro !== 'todos') {
            params.push(rubro);
            query += ` AND $${params.length} = ANY(p.rubros)`;
        }

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (
                LOWER(p.razon_social) LIKE $${params.length} OR 
                LOWER(COALESCE(p.nombre_comercial, '')) LIKE $${params.length} OR 
                LOWER(COALESCE(p.numero_documento, '')) LIKE $${params.length} OR 
                LOWER(COALESCE(p.contacto_nombre, '')) LIKE $${params.length}
            )`;
        }

        query += `
            GROUP BY p.id
            ORDER BY p.razon_social ASC
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/proveedores/:id - Single provider with detailed material list
router.get('/:id', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const provResult = await pool.query('SELECT * FROM nl_proveedores WHERE id = $1', [id]);
        if (provResult.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const provider = provResult.rows[0];

        const matResult = await pool.query(`
            SELECT 
                pm.*,
                m.nombre AS material_nombre,
                m.flujo AS material_flujo,
                m.categoria AS material_categoria,
                m.unidad AS material_unidad,
                m.stock_actual AS material_stock_actual,
                m.stock_minimo AS material_stock_minimo
            FROM nl_proveedor_materiales pm
            LEFT JOIN nl_materiales m ON m.id = pm.material_id
            WHERE pm.proveedor_id = $1
            ORDER BY pm.es_proveedor_habitual DESC, pm.id ASC
        `, [id]);

        provider.materiales = matResult.rows;
        res.json(provider);
    } catch (err) { next(err); }
});

// POST /api/proveedores - Create new provider
router.post('/', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const {
            razon_social,
            nombre_comercial,
            tipo_documento,
            numero_documento,
            contacto_nombre,
            telefono,
            email,
            direccion,
            ciudad,
            tipo_proveedor,
            condicion_pago,
            notas,
            rubros
        } = req.body;

        const razonSocialVal = toNullableString(razon_social);
        if (!razonSocialVal) {
            return res.status(400).json({ error: 'Razón social es requerida' });
        }

        const rubrosVal = Array.isArray(rubros) ? rubros.map(r => String(r).trim()).filter(Boolean) : [];

        const result = await pool.query(`
            INSERT INTO nl_proveedores (
                razon_social,
                nombre_comercial,
                tipo_documento,
                numero_documento,
                contacto_nombre,
                telefono,
                email,
                direccion,
                ciudad,
                tipo_proveedor,
                condicion_pago,
                notas,
                rubros,
                activo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
            RETURNING *
        `, [
            razonSocialVal,
            toNullableString(nombre_comercial),
            toNullableString(tipo_documento) || 'RUC',
            toNullableString(numero_documento),
            toNullableString(contacto_nombre),
            toNullableString(telefono),
            toNullableString(email),
            toNullableString(direccion),
            toNullableString(ciudad) || 'Arequipa',
            toNullableString(tipo_proveedor) || 'materiales',
            toNullableString(condicion_pago) || 'contado',
            toNullableString(notas),
            rubrosVal
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/proveedores/:id - Update provider
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const {
            razon_social,
            nombre_comercial,
            tipo_documento,
            numero_documento,
            contacto_nombre,
            telefono,
            email,
            direccion,
            ciudad,
            tipo_proveedor,
            condicion_pago,
            notas,
            rubros,
            activo
        } = req.body;

        const rubrosVal = Array.isArray(rubros) ? rubros.map(r => String(r).trim()).filter(Boolean) : null;

        const result = await pool.query(`
            UPDATE nl_proveedores SET
                razon_social = COALESCE($1, razon_social),
                nombre_comercial = CASE WHEN $2 = '' THEN NULL ELSE COALESCE($2, nombre_comercial) END,
                tipo_documento = COALESCE($3, tipo_documento),
                numero_documento = CASE WHEN $4 = '' THEN NULL ELSE COALESCE($4, numero_documento) END,
                contacto_nombre = CASE WHEN $5 = '' THEN NULL ELSE COALESCE($5, contacto_nombre) END,
                telefono = CASE WHEN $6 = '' THEN NULL ELSE COALESCE($6, telefono) END,
                email = CASE WHEN $7 = '' THEN NULL ELSE COALESCE($7, email) END,
                direccion = CASE WHEN $8 = '' THEN NULL ELSE COALESCE($8, direccion) END,
                ciudad = COALESCE($9, ciudad),
                tipo_proveedor = COALESCE($10, tipo_proveedor),
                condicion_pago = COALESCE($11, condicion_pago),
                notas = CASE WHEN $12 = '' THEN NULL ELSE COALESCE($12, notas) END,
                activo = COALESCE($13, activo),
                rubros = COALESCE($14, rubros)
            WHERE id = $15
            RETURNING *
        `, [
            toNullableString(razon_social),
            nombre_comercial !== undefined ? toNullableString(nombre_comercial) : null,
            toNullableString(tipo_documento),
            numero_documento !== undefined ? toNullableString(numero_documento) : null,
            contacto_nombre !== undefined ? toNullableString(contacto_nombre) : null,
            telefono !== undefined ? toNullableString(telefono) : null,
            email !== undefined ? toNullableString(email) : null,
            direccion !== undefined ? toNullableString(direccion) : null,
            toNullableString(ciudad),
            toNullableString(tipo_proveedor),
            toNullableString(condicion_pago),
            notas !== undefined ? toNullableString(notas) : null,
            activo !== undefined ? toBoolean(activo) : null,
            rubrosVal,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE /api/proveedores/:id - Soft delete / deactivate provider
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const result = await pool.query(
            'UPDATE nl_proveedores SET activo = false WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json({ message: 'Proveedor desactivado correctamente', proveedor: result.rows[0] });
    } catch (err) { next(err); }
});

// PATCH /api/proveedores/:id/reactivar - Reactivate provider
router.patch('/:id/reactivar', requireRole('admin'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;

        const result = await pool.query(
            'UPDATE nl_proveedores SET activo = true WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json({ message: 'Proveedor reactivado correctamente', proveedor: result.rows[0] });
    } catch (err) { next(err); }
});

// --- ITEMS / MATERIALES DEL PROVEEDOR ---

// POST /api/proveedores/:id/materiales - Link material with price
router.post('/:id/materiales', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id } = req.params;
        const {
            material_id,
            descripcion_item,
            codigo_catalogo,
            ultimo_precio,
            moneda,
            fecha_ultimo_precio,
            tiempo_entrega_dias,
            es_proveedor_habitual,
            notas
        } = req.body;

        const result = await pool.query(`
            INSERT INTO nl_proveedor_materiales (
                proveedor_id,
                material_id,
                descripcion_item,
                codigo_catalogo,
                ultimo_precio,
                moneda,
                fecha_ultimo_precio,
                tiempo_entrega_dias,
                es_proveedor_habitual,
                notas
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            id,
            material_id ? Number(material_id) : null,
            toNullableString(descripcion_item),
            toNullableString(codigo_catalogo),
            toNumber(ultimo_precio, 0),
            (toNullableString(moneda) || 'PEN').toUpperCase(),
            toNullableString(fecha_ultimo_precio) || new Date().toISOString().slice(0, 10),
            toNumber(tiempo_entrega_dias, 1),
            toBoolean(es_proveedor_habitual, false),
            toNullableString(notas)
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/proveedores/:id/materiales/:item_id - Update linked item
router.put('/:id/materiales/:item_id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id, item_id } = req.params;
        const {
            material_id,
            descripcion_item,
            codigo_catalogo,
            ultimo_precio,
            moneda,
            fecha_ultimo_precio,
            tiempo_entrega_dias,
            es_proveedor_habitual,
            notas
        } = req.body;

        const result = await pool.query(`
            UPDATE nl_proveedor_materiales SET
                material_id = COALESCE($1, material_id),
                descripcion_item = CASE WHEN $2 = '' THEN NULL ELSE COALESCE($2, descripcion_item) END,
                codigo_catalogo = CASE WHEN $3 = '' THEN NULL ELSE COALESCE($3, codigo_catalogo) END,
                ultimo_precio = COALESCE($4, ultimo_precio),
                moneda = COALESCE($5, moneda),
                fecha_ultimo_precio = COALESCE($6, fecha_ultimo_precio),
                tiempo_entrega_dias = COALESCE($7, tiempo_entrega_dias),
                es_proveedor_habitual = COALESCE($8, es_proveedor_habitual),
                notas = CASE WHEN $9 = '' THEN NULL ELSE COALESCE($9, notas) END
            WHERE id = $10 AND proveedor_id = $11
            RETURNING *
        `, [
            material_id ? Number(material_id) : null,
            descripcion_item !== undefined ? toNullableString(descripcion_item) : null,
            codigo_catalogo !== undefined ? toNullableString(codigo_catalogo) : null,
            ultimo_precio !== undefined ? toNumber(ultimo_precio) : null,
            moneda ? moneda.toUpperCase() : null,
            fecha_ultimo_precio ? toNullableString(fecha_ultimo_precio) : null,
            tiempo_entrega_dias !== undefined ? toNumber(tiempo_entrega_dias) : null,
            es_proveedor_habitual !== undefined ? toBoolean(es_proveedor_habitual) : null,
            notas !== undefined ? toNullableString(notas) : null,
            item_id,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ítem no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE /api/proveedores/:id/materiales/:item_id - Remove linked material
router.delete('/:id/materiales/:item_id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { id, item_id } = req.params;

        const result = await pool.query(
            'DELETE FROM nl_proveedor_materiales WHERE id = $1 AND proveedor_id = $2 RETURNING *',
            [item_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ítem no encontrado' });
        }

        res.json({ message: 'Ítem desvinculado con éxito' });
    } catch (err) { next(err); }
});

export default router;
