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

// GET /api/inventory - List all materials
router.get('/', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { flujo, categoria, estado } = req.query;
        const params = [];
        let query = 'SELECT * FROM nl_materiales WHERE 1=1';

        const normalizedEstado = String(estado || 'activos').trim().toLowerCase();
        if (normalizedEstado === 'inactivos') {
            query += ' AND activo = false';
        } else if (normalizedEstado !== 'todos') {
            query += ' AND activo = true';
        }

        if (flujo) {
            params.push(flujo);
            query += ` AND flujo = $${params.length}`;
        }
        if (categoria) {
            params.push(categoria);
            query += ` AND categoria = $${params.length}`;
        }

        query += ' ORDER BY nombre';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/inventory/movimientos - Global movements history with filters
router.get('/movimientos', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { tipo, search, limit = 100, offset = 0 } = req.query;
        const params = [];
        let query = `
            SELECT 
                m.*,
                mat.nombre AS material_nombre,
                mat.color AS material_color,
                mat.unidad AS material_unidad,
                mat.categoria AS material_categoria,
                u.nombre AS usuario_nombre,
                p.razon_social AS proveedor_nombre,
                p.nombre_comercial AS proveedor_nombre_comercial
            FROM nl_material_movimientos m
            JOIN nl_materiales mat ON mat.id = m.material_id
            LEFT JOIN nl_usuarios u ON u.id = m.usuario_id
            LEFT JOIN nl_proveedores p ON p.id = m.proveedor_id
            WHERE 1=1
        `;

        if (tipo === 'ingresos') {
            query += ` AND m.tipo = 'ingreso'`;
        } else if (tipo === 'egresos') {
            query += ` AND m.tipo IN ('apertura_taller', 'consumo_unitario', 'agotado_taller', 'merma_taller')`;
        } else if (tipo && tipo !== 'todos') {
            params.push(tipo);
            query += ` AND m.tipo = $${params.length}`;
        }

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (
                LOWER(mat.nombre) LIKE $${params.length} OR 
                LOWER(COALESCE(p.razon_social, '')) LIKE $${params.length} OR 
                LOWER(COALESCE(m.referencia, '')) LIKE $${params.length} OR 
                LOWER(COALESCE(m.notas, '')) LIKE $${params.length}
            )`;
        }

        query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { next(err); }
});

// GET /api/inventory/:id/kardex - List movements for a specific material
router.get('/:id/kardex', async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const materialId = parseInt(req.params.id, 10);
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT 
                m.*,
                u.nombre AS usuario_nombre,
                p.razon_social AS proveedor_nombre
            FROM nl_material_movimientos m
            LEFT JOIN nl_usuarios u ON u.id = m.usuario_id
            LEFT JOIN nl_proveedores p ON p.id = m.proveedor_id
            WHERE m.material_id = $1
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $2 OFFSET $3
        `, [materialId, parseInt(limit, 10), parseInt(offset, 10)]);

        res.json(result.rows);
    } catch (err) { next(err); }
});

// POST /api/inventory/:id/movimiento - Register movement (Ingreso, Apertura Taller, Agotado, Consumo, Ajuste)
router.post('/:id/movimiento', requireRole('admin', 'tecnico'), async (req, res, next) => {
    const client = await req.app.locals.pool.connect();
    try {
        const materialId = parseInt(req.params.id, 10);
        const { tipo, cantidad, motivo, referencia, proveedor_id, costo_unitario, notas, origen } = req.body;
        const cantNum = Number(cantidad);

        const validTipos = ['ingreso', 'apertura_taller', 'consumo_unitario', 'agotado_taller', 'merma_taller', 'ajuste'];
        if (!validTipos.includes(tipo)) {
            return res.status(400).json({ error: `Tipo de movimiento no válido: ${tipo}` });
        }

        if (tipo !== 'ajuste' && (!cantNum || cantNum <= 0)) {
            return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0' });
        }

        await client.query('BEGIN');

        const matRes = await client.query('SELECT * FROM nl_materiales WHERE id = $1 FOR UPDATE', [materialId]);
        if (matRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Material no encontrado' });
        }

        const mat = matRes.rows[0];
        const stockActual = Number(mat.stock_actual);
        const stockEnUso = Number(mat.stock_en_uso || 0);

        let nuevoStockActual = stockActual;
        let nuevoStockEnUso = stockEnUso;

        switch (tipo) {
            case 'ingreso': // Compra o recepción de proveedor (+ almacén)
                nuevoStockActual = stockActual + cantNum;
                break;

            case 'apertura_taller': // Pase de almacén a taller/máquina (- almacén, + en uso)
                if (stockActual < cantNum) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Stock insuficiente en almacén (disponible: ${stockActual})` });
                }
                nuevoStockActual = stockActual - cantNum;
                nuevoStockEnUso = stockEnUso + cantNum;
                break;

            case 'consumo_unitario': // Salida directa de almacén (cubo, premilled, fresa)
                if (stockActual < cantNum) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Stock insuficiente en almacén (disponible: ${stockActual})` });
                }
                nuevoStockActual = stockActual - cantNum;
                break;

            case 'agotado_taller': // Material en uso que se terminó por completo (- en uso)
                if (stockEnUso < cantNum) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Stock en uso insuficiente para dar de baja (en uso: ${stockEnUso})` });
                }
                nuevoStockEnUso = stockEnUso - cantNum;
                break;

            case 'merma_taller': // Merma o rotura
                if (origen === 'almacen') {
                    if (stockActual < cantNum) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: `Stock insuficiente en almacén (disponible: ${stockActual})` });
                    }
                    nuevoStockActual = stockActual - cantNum;
                } else {
                    if (stockEnUso < cantNum) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: `Stock en uso insuficiente (en uso: ${stockEnUso})` });
                    }
                    nuevoStockEnUso = stockEnUso - cantNum;
                }
                break;

            case 'ajuste':
                if (req.body.nuevo_stock_almacen !== undefined) {
                    nuevoStockActual = Math.max(0, Number(req.body.nuevo_stock_almacen));
                }
                if (req.body.nuevo_stock_en_uso !== undefined) {
                    nuevoStockEnUso = Math.max(0, Number(req.body.nuevo_stock_en_uso));
                }
                break;
        }

        // Actualizar material
        const updateRes = await client.query(
            `UPDATE nl_materiales 
             SET stock_actual = $1, stock_en_uso = $2, updated_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [nuevoStockActual, nuevoStockEnUso, materialId]
        );

        // Registrar movimiento en el kardex
        const movRes = await client.query(
            `INSERT INTO nl_material_movimientos (
                material_id, tipo, cantidad, 
                stock_almacen_anterior, stock_almacen_nuevo, 
                stock_en_uso_anterior, stock_en_uso_nuevo, 
                motivo, referencia, proveedor_id, costo_unitario, usuario_id, notas
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                materialId,
                tipo,
                tipo === 'ajuste' ? Math.abs(nuevoStockActual - stockActual) : cantNum,
                stockActual,
                nuevoStockActual,
                stockEnUso,
                nuevoStockEnUso,
                toNullableString(motivo) || tipo,
                toNullableString(referencia),
                proveedor_id ? parseInt(proveedor_id, 10) : null,
                costo_unitario !== undefined && costo_unitario !== null ? Number(costo_unitario) : null,
                req.user?.id || null,
                toNullableString(notas)
            ]
        );

        await client.query('COMMIT');
        res.status(201).json({
            material: updateRes.rows[0],
            movimiento: movRes.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// POST /api/inventory - Create material
router.post('/', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, stock_en_uso, tipo_control, unidad, flujo, categoria, color, alerta_bajo_stock, notas } = req.body;

        const nombreValue = toNullableString(nombre);
        if (!nombreValue) return res.status(400).json({ error: 'Nombre es requerido' });

        const calculatedTipoControl = toNullableString(tipo_control) || (
            ['disco', 'resina', 'liquido'].includes(String(categoria).toLowerCase()) ||
            String(nombre).toLowerCase().includes('disco') ||
            String(nombre).toLowerCase().includes('resina')
                ? 'multiuso'
                : 'unitario'
        );

        const result = await pool.query(
            `INSERT INTO nl_materiales (
                nombre, stock_actual, stock_minimo, stock_en_uso, tipo_control, 
                unidad, flujo, categoria, color, alerta_bajo_stock, notas
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                nombreValue,
                toNumber(stock_actual, 0),
                toNumber(stock_minimo, 5),
                toNumber(stock_en_uso, 0),
                calculatedTipoControl,
                toNullableString(unidad) || 'unidad',
                toNullableString(flujo) || 'digital',
                toNullableString(categoria) || 'consumible',
                toNullableString(color),
                toBoolean(alerta_bajo_stock, true),
                toNullableString(notas)
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// PUT /api/inventory/:id - Update material
router.put('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { nombre, stock_actual, stock_minimo, stock_en_uso, tipo_control, unidad, activo, flujo, categoria, color, alerta_bajo_stock, notas } = req.body;
        const result = await pool.query(
            `UPDATE nl_materiales SET 
                nombre = COALESCE($1, nombre),
                stock_actual = COALESCE($2, stock_actual),
                stock_minimo = COALESCE($3, stock_minimo),
                unidad = COALESCE($4, unidad),
                activo = COALESCE($5, activo),
                flujo = COALESCE($6, flujo),
                categoria = COALESCE($7, categoria),
                color = CASE WHEN $8 = '' THEN NULL ELSE COALESCE($8, color) END,
                alerta_bajo_stock = COALESCE($9, alerta_bajo_stock),
                notas = CASE WHEN $10 = '' THEN NULL ELSE COALESCE($10, notas) END,
                stock_en_uso = COALESCE($11, stock_en_uso),
                tipo_control = COALESCE($12, tipo_control)
             WHERE id = $13 RETURNING *`,
            [
                toNullableString(nombre),
                stock_actual !== undefined ? toNumber(stock_actual, 0) : null,
                stock_minimo !== undefined ? toNumber(stock_minimo, 5) : null,
                toNullableString(unidad),
                activo !== undefined ? toBoolean(activo, true) : null,
                toNullableString(flujo),
                toNullableString(categoria),
                color,
                alerta_bajo_stock !== undefined ? toBoolean(alerta_bajo_stock, true) : null,
                notas,
                stock_en_uso !== undefined ? toNumber(stock_en_uso, 0) : null,
                toNullableString(tipo_control),
                req.params.id
            ]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// DELETE /api/inventory/:id - Delete material (soft delete or permanent hard delete)
router.delete('/:id', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const { hard } = req.query;

        if (hard === 'true' || hard === '1') {
            // Verificar si el material tiene productos asociados
            const prodCheck = await pool.query(
                'SELECT COUNT(*) FROM nl_productos WHERE material_id = $1',
                [req.params.id]
            );
            if (parseInt(prodCheck.rows[0].count, 10) > 0) {
                return res.status(400).json({
                    error: `No se puede eliminar definitivamente: este material está vinculado a ${prodCheck.rows[0].count} producto(s) del catálogo. Desvincúlalo primero o desactívalo.`
                });
            }

            // Verificar si tiene movimientos registrados en el kardex
            const movCheck = await pool.query(
                'SELECT COUNT(*) FROM nl_material_movimientos WHERE material_id = $1',
                [req.params.id]
            );
            if (parseInt(movCheck.rows[0].count, 10) > 0) {
                return res.status(400).json({
                    error: `No se puede eliminar definitivamente: este material registra ${movCheck.rows[0].count} movimiento(s) de trazabilidad en el kárdex. Para conservar la contabilidad, desactívalo en su lugar.`
                });
            }

            // Limpiar relaciones de proveedores antes de borrar el material
            await pool.query('DELETE FROM nl_proveedor_materiales WHERE material_id = $1', [req.params.id]);

            const deleteRes = await pool.query(
                'DELETE FROM nl_materiales WHERE id = $1 RETURNING *',
                [req.params.id]
            );

            if (deleteRes.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado' });
            return res.json({ success: true, deleted: true, material: deleteRes.rows[0] });
        }

        // Soft delete ordinario (desactivación)
        const result = await pool.query(
            `UPDATE nl_materiales
             SET activo = false
             WHERE id = $1 AND activo = true
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado o ya inactivo' });
        res.json({ success: true, material: result.rows[0] });
    } catch (err) { next(err); }
});

// PATCH /api/inventory/:id/restore - Restore soft deleted material
router.patch('/:id/restore', requireRole('admin', 'tecnico'), async (req, res, next) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            `UPDATE nl_materiales
             SET activo = true
             WHERE id = $1 AND activo = false
             RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Material no encontrado o ya activo' });
        res.json({ success: true, material: result.rows[0] });
    } catch (err) { next(err); }
});

export default router;
