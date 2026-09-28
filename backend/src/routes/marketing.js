import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken, requireRole, forbidRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// Helper to get db pool
const getPool = (req) => req.app.locals.pool;

// Helper to generate unique coupon codes
const generateCouponCode = (prefix = 'RUL') => {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${randomHex}`;
};

// =========================================================================
// 1. MÉTRICAS GENERALES DE MARKETING
// =========================================================================
router.get('/metricas', async (req, res) => {
    const pool = getPool(req);
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM nl_descuentos WHERE activo = TRUE) AS cupones_activos,
                (SELECT COALESCE(SUM(usos_actuales), 0)::int FROM nl_descuentos) AS total_canjes,
                (SELECT COALESCE(SUM(monto_descontado), 0)::numeric(12,2) FROM nl_descuentos_usos) AS total_ahorrado_soles,
                (SELECT COUNT(*)::int FROM nl_ruleta_giros) AS total_giros_ruleta
        `);
        res.json({ ok: true, data: stats.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener métricas de marketing', details: err.message });
    }
});

// =========================================================================
// 2. CUPONES DE DESCUENTO (CRUD)
// =========================================================================
router.get('/cupones', async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT 
                d.*,
                c.nombre AS clinica_nombre,
                u.nombre AS creador_nombre
            FROM nl_descuentos d
            LEFT JOIN nl_clinicas c ON d.clinica_id = c.id
            LEFT JOIN nl_usuarios u ON d.creado_por = u.id
            ORDER BY d.created_at DESC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al listar cupones', details: err.message });
    }
});

router.post('/cupones', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const {
        codigo,
        descripcion,
        tipo,
        valor,
        tope_descuento_maximo,
        monto_minimo_pedido,
        limite_usos_total,
        limite_usos_por_doctor,
        fecha_inicio,
        fecha_fin,
        clinica_id,
        origen,
        evento_nombre
    } = req.body;

    if (!codigo || !tipo || valor === undefined || valor === null) {
        return res.status(400).json({ error: 'Código, tipo y valor son requeridos' });
    }

    if (!['porcentaje', 'monto_fijo'].includes(tipo)) {
        return res.status(400).json({ error: 'El tipo debe ser porcentaje o monto_fijo' });
    }

    const cleanCode = String(codigo).trim().toUpperCase();

    try {
        const insertRes = await pool.query(`
            INSERT INTO nl_descuentos (
                codigo, descripcion, tipo, valor, tope_descuento_maximo,
                monto_minimo_pedido, limite_usos_total, limite_usos_por_doctor,
                fecha_inicio, fecha_fin, clinica_id, creado_por, origen, evento_nombre
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                COALESCE($9, NOW()), $10, $11, $12, COALESCE($13, 'manual'), $14
            ) RETURNING *
        `, [
            cleanCode,
            descripcion || null,
            tipo,
            Number(valor),
            tope_descuento_maximo ? Number(tope_descuento_maximo) : null,
            monto_minimo_pedido ? Number(monto_minimo_pedido) : 0.00,
            limite_usos_total ? Number.parseInt(limite_usos_total, 10) : 1,
            limite_usos_por_doctor ? Number.parseInt(limite_usos_por_doctor, 10) : 1,
            fecha_inicio || null,
            fecha_fin || null,
            clinica_id ? Number.parseInt(clinica_id, 10) : null,
            req.user?.id || null,
            origen,
            evento_nombre || null
        ]);

        res.status(201).json({ ok: true, data: insertRes.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un cupón con ese código' });
        }
        res.status(500).json({ error: 'Error al crear cupón', details: err.message });
    }
});

router.patch('/cupones/:id/toggle', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { id } = req.params;
    try {
        const result = await pool.query(`
            UPDATE nl_descuentos 
            SET activo = NOT activo, updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
        `, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
        res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al cambiar estado del cupón', details: err.message });
    }
});

router.delete('/cupones/:id', requireRole('admin'), async (req, res) => {
    const pool = getPool(req);
    const { id } = req.params;
    try {
        const check = await pool.query('SELECT usos_actuales FROM nl_descuentos WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
        if (check.rows[0].usos_actuales > 0) {
            // Desactivar en lugar de borrar si ya tiene usos históricos
            await pool.query('UPDATE nl_descuentos SET activo = FALSE, updated_at = NOW() WHERE id = $1', [id]);
            return res.json({ ok: true, message: 'Cupón desactivado (conserva historial de auditoría)' });
        }
        await pool.query('DELETE FROM nl_descuentos WHERE id = $1', [id]);
        res.json({ ok: true, message: 'Cupón eliminado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar cupón', details: err.message });
    }
});

// =========================================================================
// 3. VALIDACIÓN DE CUPÓN EN CHECKOUT (PASO 3 DE PEDIDOS)
// =========================================================================
router.post('/cupones/validar', async (req, res) => {
    const pool = getPool(req);
    const { codigo, clinica_id, subtotal } = req.body;

    if (!codigo || !String(codigo).trim()) {
        return res.status(400).json({ valido: false, error: 'Debe ingresar un código de cupón' });
    }

    const cleanCode = String(codigo).trim().toUpperCase();
    const orderTotal = Number(subtotal) || 0;
    const clinicId = clinica_id || req.user?.clinica_id || null;

    try {
        const query = await pool.query(`
            SELECT * FROM nl_descuentos 
            WHERE UPPER(codigo) = $1
        `, [cleanCode]);

        if (query.rows.length === 0) {
            return res.json({ valido: false, error: 'El cupón ingresado no existe.' });
        }

        const coupon = query.rows[0];

        if (!coupon.activo) {
            return res.json({ valido: false, error: 'Este cupón está desactivado.' });
        }

        const now = new Date();
        if (coupon.fecha_inicio && new Date(coupon.fecha_inicio) > now) {
            return res.json({ valido: false, error: 'Este cupón aún no está vigente.' });
        }

        if (coupon.fecha_fin && new Date(coupon.fecha_fin) < now) {
            return res.json({ valido: false, error: 'Este cupón ha vencido.' });
        }

        if (coupon.limite_usos_total !== null && coupon.usos_actuales >= coupon.limite_usos_total) {
            return res.json({ valido: false, error: 'Este cupón ya alcanzó el límite máximo de usos.' });
        }

        if (coupon.clinica_id && clinicId && Number(coupon.clinica_id) !== Number(clinicId)) {
            return res.json({ valido: false, error: 'Este cupón es exclusivo para otra clínica o doctor.' });
        }

        if (coupon.monto_minimo_pedido && orderTotal < Number(coupon.monto_minimo_pedido)) {
            return res.json({ 
                valido: false, 
                error: `Este cupón requiere un pedido mínimo de S/. ${Number(coupon.monto_minimo_pedido).toFixed(2)}.` 
            });
        }

        // Si hay límite por clínica, validar cuántas veces lo ha usado esta clínica
        if (clinicId && coupon.limite_usos_por_doctor) {
            const usageCountRes = await pool.query(`
                SELECT COUNT(*)::int AS count 
                FROM nl_descuentos_usos 
                WHERE descuento_id = $1 AND clinica_id = $2
            `, [coupon.id, clinicId]);
            if (usageCountRes.rows[0]?.count >= coupon.limite_usos_por_doctor) {
                return res.json({ valido: false, error: 'Ya has alcanzado el límite de uso de este cupón para tu cuenta.' });
            }
        }

        // Cálculo de descuento estimado
        let montoDescuento = 0;
        if (coupon.tipo === 'porcentaje') {
            montoDescuento = (orderTotal * Number(coupon.valor)) / 100;
            if (coupon.tope_descuento_maximo && montoDescuento > Number(coupon.tope_descuento_maximo)) {
                montoDescuento = Number(coupon.tope_descuento_maximo);
            }
        } else {
            montoDescuento = Number(coupon.valor);
        }
        montoDescuento = Math.min(montoDescuento, orderTotal);
        montoDescuento = Number(montoDescuento.toFixed(2));

        const totalFinal = Math.max(0, Number((orderTotal - montoDescuento).toFixed(2)));

        res.json({
            valido: true,
            descuento: {
                id: coupon.id,
                codigo: coupon.codigo,
                tipo: coupon.tipo,
                valor: Number(coupon.valor),
                descripcion: coupon.descripcion,
                monto_descuento: montoDescuento,
                total_original: orderTotal,
                total_final: totalFinal
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al validar cupón', details: err.message });
    }
});

// =========================================================================
// 4. RULETA DE LA SUERTE (HERRAMIENTA DE EVENTOS / VISITAS)
// =========================================================================
router.get('/ruleta/premios', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT * FROM nl_ruleta_premios 
            ORDER BY id ASC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar premios de la ruleta', details: err.message });
    }
});

router.post('/ruleta/girar', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { doctor_nombre, clinica_id, doctor_telefono, evento_nombre } = req.body;

    if (!doctor_nombre || !String(doctor_nombre).trim()) {
        return res.status(400).json({ error: 'El nombre del doctor es requerido para registrar el giro.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener premios activos con sus ponderaciones
        const premiosRes = await client.query(`
            SELECT * FROM nl_ruleta_premios 
            WHERE activo = TRUE 
            ORDER BY id ASC
        `);

        if (premiosRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay premios activos configurados en la ruleta.' });
        }

        const premios = premiosRes.rows;

        // 2. Selección probabilística ponderada
        const totalPeso = premios.reduce((acc, p) => acc + (Number(p.probabilidad_peso) || 1), 0);
        let randomNum = Math.random() * totalPeso;
        let selectedPrize = premios[0];

        for (const premio of premios) {
            const peso = Number(premio.probabilidad_peso) || 1;
            if (randomNum < peso) {
                selectedPrize = premio;
                break;
            }
            randomNum -= peso;
        }

        let couponCodeGenerated = null;

        // 3. Si el premio es descuento (porcentaje o monto_fijo), generar cupón real
        if (['porcentaje', 'monto_fijo'].includes(selectedPrize.tipo_premio) && Number(selectedPrize.valor) > 0) {
            couponCodeGenerated = generateCouponCode('RUL');
            const fechaFin = new Date();
            fechaFin.setDate(fechaFin.getDate() + 30); // 30 días de vigencia por defecto

            await client.query(`
                INSERT INTO nl_descuentos (
                    codigo, descripcion, tipo, valor, limite_usos_total, limite_usos_por_doctor,
                    fecha_fin, clinica_id, creado_por, origen, evento_nombre
                ) VALUES (
                    $1, $2, $3, $4, 1, 1,
                    $5, $6, $7, 'ruleta_evento', $8
                )
            `, [
                couponCodeGenerated,
                `Premio Ruleta: ${selectedPrize.titulo} (Evento: ${evento_nombre || 'Visita Asesor'})`,
                selectedPrize.tipo_premio,
                Number(selectedPrize.valor),
                fechaFin,
                clinica_id ? Number(clinica_id) : null,
                req.user?.id || null,
                evento_nombre || 'Visita a Clínica'
            ]);
        }

        // 4. Registrar giro en la auditoría
        const giroRes = await client.query(`
            INSERT INTO nl_ruleta_giros (
                premio_id, asesor_usuario_id, clinica_id, doctor_nombre, doctor_telefono,
                evento_nombre, codigo_descuento_generado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            selectedPrize.id,
            req.user?.id || null,
            clinica_id ? Number(clinica_id) : null,
            String(doctor_nombre).trim(),
            doctor_telefono ? String(doctor_telefono).trim() : null,
            evento_nombre ? String(evento_nombre).trim() : 'Visita a Clínica',
            couponCodeGenerated
        ]);

        await client.query('COMMIT');

        res.json({
            ok: true,
            premio: selectedPrize,
            giro: giroRes.rows[0],
            codigo_descuento: couponCodeGenerated
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al procesar el giro de la ruleta', details: err.message });
    } finally {
        client.release();
    }
});

router.get('/ruleta/historial', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT 
                g.*,
                p.titulo AS premio_titulo,
                p.tipo_premio,
                p.valor AS premio_valor,
                p.color_hex,
                u.nombre AS asesor_nombre,
                c.nombre AS clinica_nombre
            FROM nl_ruleta_giros g
            JOIN nl_ruleta_premios p ON g.premio_id = p.id
            LEFT JOIN nl_usuarios u ON g.asesor_usuario_id = u.id
            LEFT JOIN nl_clinicas c ON g.clinica_id = c.id
            ORDER BY g.fecha_giro DESC
            LIMIT 100
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar historial de giros', details: err.message });
    }
});

export default router;
