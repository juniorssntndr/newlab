import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken, requireRole, forbidRole } from '../middleware/auth.js';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { uploadMarketingImage } from '../services/storage.js';
import { campaignError, validateCampaignImage } from './marketingCampaignPolicy.js';
import { campaignReadiness, campaignDispatchStatus, createCampaignDispatch, previewCampaignAudience } from './marketingCampaignService.js';
import { buildMarketingAudience, campaignMatchesClient } from './marketingAudience.js';

const router = Router();
router.use(authenticateToken);

// Helper to get db pool
const getPool = (req) => req.app.locals.pool;

// Generador de códigos limpios de exactamente 6 caracteres (alfanumérico sin caracteres confusos)
const generate6DigitCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// =========================================================================
// 1. MÉTRICAS GENERALES DE MARKETING
// =========================================================================
router.get('/metricas', forbidRole('cliente'), async (req, res) => {
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
router.get('/cupones', forbidRole('cliente'), async (req, res) => {
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
    const discountValue = Number(valor);
    if (!cleanCode || !['number', 'string'].includes(typeof valor) || !Number.isFinite(discountValue) || discountValue <= 0 || (tipo === 'porcentaje' && discountValue > 100)) {
        return res.status(400).json({ error: 'El descuento debe ser mayor a 0 y el porcentaje no puede superar 100' });
    }
    for (const limit of [limite_usos_total, limite_usos_por_doctor]) {
        if (limit != null && limit !== '' && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
            return res.status(400).json({ error: 'Los límites de uso deben ser enteros mayores a 0' });
        }
    }

    const normalizedFechaFin = fecha_fin && typeof fecha_fin === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_fin.trim())
        ? `${fecha_fin.trim()}T23:59:59.999-05:00`
        : (fecha_fin || null);

    try {
        const insertRes = await pool.query(`
            INSERT INTO nl_descuentos (
                codigo, descripcion, tipo, valor, tope_descuento_maximo,
                monto_minimo_pedido, limite_usos_total, limite_usos_por_doctor,
                fecha_inicio, fecha_fin, clinica_id, creado_por, origen, evento_nombre,
                para_un_solo_producto
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                COALESCE($9, NOW()), $10, $11, $12, COALESCE($13, 'manual'), $14,
                TRUE
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
            normalizedFechaFin,
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

        if (coupon.origen === 'campana') {
            if (!clinicId) return res.json({ valido: false, error: 'Selecciona la clínica para validar este beneficio.' });
            if (!(await campaignReadiness(pool)).ready) return res.status(503).json({ valido: false, error: 'La validación de campañas no está habilitada.' });
            const eligible = await pool.query(`SELECT c.id FROM nl_campanas_marketing c
                WHERE c.cupon_id = $1 AND c.activo = TRUE AND EXISTS
                (SELECT 1 FROM nl_campana_destinatarios r WHERE r.campana_id = c.id AND r.clinica_id = $2)`, [coupon.id, clinicId]);
            if (!eligible.rows.length) return res.json({ valido: false, error: 'Este beneficio no está disponible para esta clínica.' });
        }

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
                total_final: totalFinal,
                para_un_solo_producto: coupon.para_un_solo_producto
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al validar cupón', details: err.message });
    }
});

// =========================================================================
// 4. GESTIÓN Y PERSONALIZACIÓN DE SECTORES / PREMIOS (RULETA)
// =========================================================================

// Listar todos los premios/sectores para administración (incluyendo inactivos y stock)
router.get('/ruleta/premios/admin', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                CASE 
                    WHEN p.stock_disponible IS NOT NULL AND p.stock_entregado >= p.stock_disponible THEN TRUE 
                    ELSE FALSE 
                END AS agotado
            FROM nl_ruleta_premios p 
            ORDER BY p.orden ASC, p.id ASC
        `);

        // Calcular probabilidad porcentual de los premios activos con stock
        const activos = result.rows.filter(p => p.activo && (!p.stock_disponible || p.stock_entregado < p.stock_disponible));
        const totalPesoActivo = activos.reduce((acc, p) => acc + (Number(p.probabilidad_peso) || 1), 0);

        const conPorcentaje = result.rows.map(p => {
            const isEligible = p.activo && (!p.stock_disponible || p.stock_entregado < p.stock_disponible);
            const probPct = isEligible && totalPesoActivo > 0 
                ? Number(((Number(p.probabilidad_peso) / totalPesoActivo) * 100).toFixed(1)) 
                : 0;
            return { ...p, probabilidad_porcentaje: probPct };
        });

        res.json({ ok: true, data: conPorcentaje, totalPesoActivo });
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar administración de premios', details: err.message });
    }
});

// Obtener configuración visual de la ruleta (fondo, pasador, animación)
router.get('/ruleta/config', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query('SELECT * FROM nl_ruleta_config WHERE id = 1');
        const config = result.rows[0] || { id: 1, fondo_url: null, pasador_url: null, tiempo_animacion_segundos: 4 };
        res.json({ ok: true, data: config });
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar configuración de ruleta', details: err.message });
    }
});

// Guardar configuración visual de la ruleta
router.put('/ruleta/config', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { fondo_url, pasador_url, tiempo_animacion_segundos } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO nl_ruleta_config (id, fondo_url, pasador_url, tiempo_animacion_segundos, updated_at)
            VALUES (1, $1, $2, COALESCE($3, 4), NOW())
            ON CONFLICT (id) DO UPDATE SET
                fondo_url = EXCLUDED.fondo_url,
                pasador_url = EXCLUDED.pasador_url,
                tiempo_animacion_segundos = EXCLUDED.tiempo_animacion_segundos,
                updated_at = NOW()
            RETURNING *
        `, [
            fondo_url || null,
            pasador_url || null,
            Number(tiempo_animacion_segundos) || 4
        ]);
        res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar configuración de ruleta', details: err.message });
    }
});

// Reordenar sectores de la ruleta
router.put('/ruleta/premios/reordenar', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { ordenIds } = req.body; // Array de IDs en nuevo orden [3, 1, 4, 2]
    if (!Array.isArray(ordenIds) || ordenIds.length === 0) {
        return res.status(400).json({ error: 'Se requiere un arreglo ordenIds con los IDs de sectores' });
    }
    try {
        await pool.query('BEGIN');
        for (let i = 0; i < ordenIds.length; i++) {
            await pool.query('UPDATE nl_ruleta_premios SET orden = $1, updated_at = NOW() WHERE id = $2', [i, ordenIds[i]]);
        }
        await pool.query('COMMIT');
        res.json({ ok: true, message: 'Sectores reordenados exitosamente' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Error al reordenar sectores', details: err.message });
    }
});

// Obtener premios activos disponibles para girar (público / kiosco)
router.get('/ruleta/premios', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT * FROM nl_ruleta_premios 
            WHERE activo = TRUE 
              AND (stock_disponible IS NULL OR stock_entregado < stock_disponible)
            ORDER BY orden ASC, id ASC
        `);
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar premios de la ruleta', details: err.message });
    }
});

// Crear nuevo sector / premio
router.post('/ruleta/premios', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const {
        titulo,
        tipo_premio,
        valor,
        descripcion,
        color_hex,
        texto_color,
        probabilidad_peso,
        stock_disponible,
        imagen_url,
        resultado_titulo,
        resultado_descripcion,
        orden
    } = req.body;

    if (!titulo || !tipo_premio) {
        return res.status(400).json({ error: 'Título y tipo de premio son requeridos' });
    }

    try {
        const insertRes = await pool.query(`
            INSERT INTO nl_ruleta_premios (
                titulo, tipo_premio, valor, descripcion, color_hex, texto_color,
                probabilidad_peso, stock_disponible, stock_entregado, activo,
                imagen_url, resultado_titulo, resultado_descripcion, orden
            ) VALUES ($1, $2, $3, $4, COALESCE($5, '#0284c7'), COALESCE($6, '#ffffff'), COALESCE($7, 10), $8, 0, TRUE, $9, $10, $11, COALESCE($12, 0))
            RETURNING *
        `, [
            String(titulo).trim(),
            tipo_premio,
            valor !== undefined && valor !== null && valor !== '' ? Number(valor) : 0,
            descripcion || null,
            color_hex,
            texto_color,
            probabilidad_peso ? Number.parseInt(probabilidad_peso, 10) : 10,
            stock_disponible !== undefined && stock_disponible !== null && stock_disponible !== '' 
                ? Number.parseInt(stock_disponible, 10) 
                : null,
            imagen_url || null,
            resultado_titulo || null,
            resultado_descripcion || null,
            orden !== undefined ? Number(orden) : 0
        ]);

        res.status(201).json({ ok: true, data: insertRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear sector de la ruleta', details: err.message });
    }
});

// Modificar sector / premio
router.put('/ruleta/premios/:id', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { id } = req.params;
    const {
        titulo,
        tipo_premio,
        valor,
        descripcion,
        color_hex,
        texto_color,
        probabilidad_peso,
        stock_disponible,
        activo,
        imagen_url,
        resultado_titulo,
        resultado_descripcion,
        orden
    } = req.body;

    try {
        const updateRes = await pool.query(`
            UPDATE nl_ruleta_premios 
            SET 
                titulo = COALESCE($1, titulo),
                tipo_premio = COALESCE($2, tipo_premio),
                valor = COALESCE($3, valor),
                descripcion = $4,
                color_hex = COALESCE($5, color_hex),
                texto_color = COALESCE($6, texto_color),
                probabilidad_peso = COALESCE($7, probabilidad_peso),
                stock_disponible = $8,
                activo = COALESCE($9, activo),
                imagen_url = $10,
                resultado_titulo = $11,
                resultado_descripcion = $12,
                orden = COALESCE($13, orden),
                updated_at = NOW()
            WHERE id = $14
            RETURNING *
        `, [
            titulo,
            tipo_premio,
            valor !== undefined ? Number(valor) : null,
            descripcion || null,
            color_hex,
            texto_color,
            probabilidad_peso !== undefined ? Number.parseInt(probabilidad_peso, 10) : null,
            stock_disponible !== undefined && stock_disponible !== null && stock_disponible !== '' 
                ? Number.parseInt(stock_disponible, 10) 
                : null,
            activo,
            imagen_url !== undefined ? imagen_url : null,
            resultado_titulo !== undefined ? resultado_titulo : null,
            resultado_descripcion !== undefined ? resultado_descripcion : null,
            orden !== undefined ? Number(orden) : null,
            id
        ]);

        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Sector no encontrado' });
        res.json({ ok: true, data: updateRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar sector', details: err.message });
    }
});

// Alternar estado activo / inactivo de un sector
router.patch('/ruleta/premios/:id/toggle', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { id } = req.params;
    try {
        const updateRes = await pool.query(`
            UPDATE nl_ruleta_premios 
            SET activo = NOT activo, updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
        `, [id]);
        if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Sector no encontrado' });
        res.json({ ok: true, data: updateRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al cambiar estado del sector', details: err.message });
    }
});

// Eliminar o desactivar sector de ruleta
router.delete('/ruleta/premios/:id', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { id } = req.params;
    try {
        const check = await pool.query('SELECT COUNT(*)::int AS total FROM nl_ruleta_giros WHERE premio_id = $1', [id]);
        if (check.rows[0].total > 0) {
            await pool.query('UPDATE nl_ruleta_premios SET activo = FALSE, updated_at = NOW() WHERE id = $1', [id]);
            return res.json({ ok: true, message: 'Sector desactivado (conserva historial de giros pasados)' });
        }
        const delRes = await pool.query('DELETE FROM nl_ruleta_premios WHERE id = $1 RETURNING id', [id]);
        if (delRes.rows.length === 0) return res.status(404).json({ error: 'Sector no encontrado' });
        res.json({ ok: true, message: 'Sector eliminado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar sector', details: err.message });
    }
});

// =========================================================================
// 5. GIRO DE LA RULETA (EJECUCIÓN, STOCK, GENERACIÓN DE TICKET Y NOTIFICACIÓN)
// =========================================================================
router.post('/ruleta/girar', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const { doctor_nombre, clinica_id, doctor_telefono, evento_nombre } = req.body;
    const docNombre = String(doctor_nombre || '').trim() || 'Participante Invitado';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener premios activos que tengan stock disponible
        const premiosRes = await client.query(`
            SELECT * FROM nl_ruleta_premios 
            WHERE activo = TRUE 
              AND (stock_disponible IS NULL OR stock_entregado < stock_disponible)
            ORDER BY orden ASC, id ASC
            FOR UPDATE
        `);

        if (premiosRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay premios disponibles actualmente en la ruleta.' });
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

        // 3. Descontar stock entregado
        await client.query(`
            UPDATE nl_ruleta_premios 
            SET stock_entregado = stock_entregado + 1, updated_at = NOW() 
            WHERE id = $1
        `, [selectedPrize.id]);

        let couponCodeGenerated = null;
        const fechaVencimientoTicket = new Date();
        fechaVencimientoTicket.setDate(fechaVencimientoTicket.getDate() + 30); // Exactamente 30 días (1 mes)

        // 4. Si el premio es descuento (porcentaje o monto_fijo), generar código de 6 dígitos
        if (['porcentaje', 'monto_fijo'].includes(selectedPrize.tipo_premio) && Number(selectedPrize.valor) > 0) {
            couponCodeGenerated = generate6DigitCode();

            await client.query(`
                INSERT INTO nl_descuentos (
                    codigo, descripcion, tipo, valor, limite_usos_total, limite_usos_por_doctor,
                    fecha_fin, clinica_id, creado_por, origen, evento_nombre, para_un_solo_producto
                ) VALUES (
                    $1, $2, $3, $4, 1, 1,
                    $5, $6, $7, 'ruleta_evento', $8, TRUE
                )
            `, [
                couponCodeGenerated,
                `Premio Ruleta: ${selectedPrize.titulo} (Evento: ${evento_nombre || 'Visita Asesor'}) - Válido para 1 solo trabajo`,
                selectedPrize.tipo_premio,
                Number(selectedPrize.valor),
                fechaVencimientoTicket,
                clinica_id ? Number(clinica_id) : null,
                req.user?.id || null,
                evento_nombre || 'Visita a Clínica'
            ]);
        }

        // 5. Registrar giro en el historial
        const giroRes = await client.query(`
            INSERT INTO nl_ruleta_giros (
                premio_id, asesor_usuario_id, clinica_id, doctor_nombre, doctor_telefono,
                evento_nombre, codigo_descuento_generado, fecha_vencimiento_ticket
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            selectedPrize.id,
            req.user?.id || null,
            clinica_id ? Number(clinica_id) : null,
            docNombre,
            doctor_telefono ? String(doctor_telefono).trim() : null,
            evento_nombre ? String(evento_nombre).trim() : 'Visita a Clínica',
            couponCodeGenerated,
            fechaVencimientoTicket
        ]);

        // 6. Si se asignó a una clínica que tiene cuenta en el portal, enviar notificación con pop-up
        if (clinica_id) {
            const clinicUsers = await client.query(`
                SELECT id, nombre, email FROM nl_usuarios 
                WHERE clinica_id = $1 AND tipo = 'cliente' AND activo = TRUE
            `, [clinica_id]);

            for (const user of clinicUsers.rows) {
                const notifTitulo = '🎉 ¡Tienes un nuevo regalo en tu portal AFINIX LAB!';
                const notifMensaje = couponCodeGenerated
                    ? `Felicidades Dr(a). Has ganado un ${selectedPrize.titulo}. Tu código exclusivo es: ${couponCodeGenerated}. Válido por 30 días para tu próximo pedido.`
                    : `Felicidades Dr(a). Has ganado: ${selectedPrize.titulo}. Tu asesor te entregará el detalle.`;

                const ticketData = JSON.stringify({
                    codigo: couponCodeGenerated,
                    premio_titulo: selectedPrize.titulo,
                    tipo_premio: selectedPrize.tipo_premio,
                    valor: selectedPrize.valor,
                    doctor_nombre: docNombre,
                    fecha_vencimiento: fechaVencimientoTicket.toISOString(),
                    evento_nombre: evento_nombre || 'Visita Comercial Afinix',
                    para_un_solo_producto: true
                });

                await client.query(`
                    INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link, data)
                    VALUES ($1, 'premio_ruleta', $2, $3, '/pedidos/nuevo', $4)
                `, [
                    user.id,
                    notifTitulo,
                    notifMensaje,
                    ticketData
                ]);
            }
        }

        await client.query('COMMIT');

        res.json({
            ok: true,
            premio: selectedPrize,
            giro: giroRes.rows[0],
            codigo_descuento: couponCodeGenerated,
            ticket: {
                codigo: couponCodeGenerated,
                premio_titulo: selectedPrize.titulo,
                tipo_premio: selectedPrize.tipo_premio,
                valor: selectedPrize.valor,
                doctor_nombre: docNombre,
                fecha_vencimiento: fechaVencimientoTicket.toISOString(),
                para_un_solo_producto: true,
                evento_nombre: evento_nombre || 'Visita Comercial'
            }
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

// =========================================================================
// 6. CAMPAÑAS DE MARKETING VISUALES & PUSH BROADCAST
// =========================================================================

// Listar todas las campañas
router.get('/campanas', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT 
                c.*,
                u.nombre AS creador_nombre,
                d.codigo AS cupon_codigo,
                d.valor AS cupon_valor,
                d.tipo AS cupon_tipo
            FROM nl_campanas_marketing c
            LEFT JOIN nl_usuarios u ON c.creado_por = u.id
            LEFT JOIN nl_descuentos d ON c.cupon_id = d.id
            ORDER BY c.created_at DESC
        `);
        let campaigns = result.rows;
        if ((await campaignReadiness(pool)).ready) {
            const receipts = await pool.query(`SELECT e.campana_id, e.estado, e.metricas,
                COUNT(*) FILTER (WHERE p.estado = 'accepted')::int AS accepted,
                COUNT(*) FILTER (WHERE p.estado = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE p.estado = 'skipped')::int AS skipped,
                COUNT(*) FILTER (WHERE p.estado = 'pending')::int AS pending,
                COUNT(*) FILTER (WHERE p.estado = 'sending')::int AS uncertain
                FROM nl_campana_envios e LEFT JOIN nl_campana_push_envios p ON p.envio_id = e.id
                WHERE e.es_prueba = FALSE GROUP BY e.id`);
            const byId = new Map(receipts.rows.map(r => [Number(r.campana_id), r]));
            campaigns = campaigns.map(c => {
                const r = byId.get(Number(c.id));
                return r ? { ...c, envio_estado: r.estado, envio_metricas: { ...r.metricas, push_aceptados: r.accepted, push_fallidos: r.failed, push_omitidos: r.skipped, push_pendientes: r.pending, push_inciertos: r.uncertain } } : c;
            });
        }
        res.json({ ok: true, data: campaigns });
    } catch (err) {
        res.status(500).json({ error: 'Error al listar campañas', details: err.message });
    }
});

// Obtener campañas activas in-app para el cliente autenticado
router.get('/campanas/activas-in-app', requireRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const client = await pool.query(`
            SELECT clinica_id FROM nl_usuarios
            WHERE id = $1 AND tipo = 'cliente' AND estado = 'activo'
        `, [req.user.id]);
        if (client.rows.length === 0) return res.json({ ok: true, campana: null });
        const clinicId = client.rows[0].clinica_id;
        if (!Number.isSafeInteger(Number(clinicId)) || Number(clinicId) <= 0) {
            return res.json({ ok: true, campana: null });
        }
        const result = await pool.query(`
            SELECT c.id, c.titulo, c.mensaje, c.imagen_url, c.beneficio_tipo,
                   c.codigo_descuento, c.link_destino, c.created_at,
                   c.tipo_audiencia, c.segmento_ids
            FROM nl_campanas_marketing c
            WHERE c.activo = TRUE AND c.mostrar_toast_in_app = TRUE
              AND COALESCE((to_jsonb(c)->>'fecha_fin')::timestamptz, 'infinity'::timestamptz) >= NOW()
              AND EXISTS (
                  SELECT 1 FROM nl_notificaciones n
                  WHERE n.usuario_id = $1 AND n.tipo = 'campana_marketing'
                    AND n.data->>'campana_id' = c.id::text
                    AND COALESCE((n.data->>'mostrar_toast_in_app')::boolean, TRUE) = TRUE
              )
            ORDER BY c.created_at DESC
        `, [req.user.id]);
        let hasRecentOrder = null;
        let selected = null;
        for (const campaign of result.rows) {
            if (campaign.tipo_audiencia === 'inactivos' && hasRecentOrder === null) {
                const recent = await pool.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM nl_pedidos
                        WHERE clinica_id = $1 AND fecha >= NOW() - INTERVAL '30 days'
                    ) AS has_recent_order
                `, [clinicId]);
                hasRecentOrder = recent.rows[0]?.has_recent_order === true;
            }
            if (campaignMatchesClient(campaign, clinicId, hasRecentOrder)) {
                const { tipo_audiencia, segmento_ids, ...visibleCampaign } = campaign;
                selected = visibleCampaign;
                break;
            }
        }
        res.json({ ok: true, campana: selected });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener campañas activas', details: err.message });
    }
});

// Crear y disparar nueva campaña (In-App + Web Push + Notificación de sistema)
router.get('/campanas/clinicas', forbidRole('cliente'), async (req, res) => {
    try {
        const { rows } = await getPool(req).query('SELECT id, nombre, provincia FROM nl_clinicas ORDER BY nombre ASC');
        res.json({ ok: true, data: rows });
    } catch {
        res.status(500).json({ error: 'Error al cargar clínicas' });
    }
});

const campaignAccess = [requireRole('admin', 'operador', 'visitador'), async (req, res, next) => {
    try {
        const { rows } = await getPool(req).query("SELECT id FROM nl_usuarios WHERE id = $1 AND estado = 'activo' AND tipo IN ('admin','operador','visitador')", [req.user.id]);
        if (!rows.length) return res.status(403).json({ error: 'Tu cuenta no tiene acceso a campañas.' });
        next();
    } catch { res.status(503).json({ error: 'No se pudo verificar el acceso a campañas.' }); }
}];
const campaignUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } }).single('imagen');
const validateUploadedCampaignImage = (body, ownerId) => {
    try {
        const asset = jwt.verify(body.imagen_token, getJwtSecret(), { algorithms: ['HS256'] });
        if (asset.purpose !== 'marketing_image' || Number(asset.owner) !== Number(ownerId) || asset.url !== body.imagen_url) throw new Error('Invalid image binding');
    } catch { throw campaignError('Sube nuevamente la imagen desde este formulario.'); }
};
router.post('/campanas/imagen', ...campaignAccess, (req, res) => {
    campaignUpload(req, res, async error => {
        if (error) return res.status(400).json({ error: 'Sube una sola imagen PNG, JPEG o WebP de hasta 5 MB.' });
        try {
            validateCampaignImage(req.file);
            const url = await uploadMarketingImage(req.file);
            const token = jwt.sign({ purpose: 'marketing_image', owner: req.user.id, url }, getJwtSecret(), { algorithm: 'HS256', expiresIn: '48h' });
            res.status(201).json({ ok: true, imagen_url: url, imagen_token: token });
        } catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo subir la imagen.' }); }
    });
});
router.get('/campanas/readiness', ...campaignAccess, async (req, res) => {
    try { res.json({ ok: true, ...(await campaignReadiness(getPool(req))) }); }
    catch { res.status(503).json({ error: 'No se pudo verificar la preparación de campañas.' }); }
});
router.post('/campanas/preview', ...campaignAccess, async (req, res) => {
    try { res.json({ ok: true, ...(await previewCampaignAudience(getPool(req), req.body || {})) }); }
    catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'Error al calcular destinatarios.' }); }
});
router.get('/campanas/envios/:requestId', ...campaignAccess, async (req, res) => {
    try {
        if (!(await campaignReadiness(getPool(req))).ready) return res.status(503).json({ error: 'Falta aplicar migration_938_campaign_delivery.sql.' });
        const result = await campaignDispatchStatus(getPool(req), req.user.id, req.params.requestId);
        if (!result) return res.status(404).json({ error: 'Todavía no existe un envío con este identificador.' });
        res.json({ ok: true, data: result });
    } catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo consultar el estado del envío.' }); }
});
const dispatchCampaign = isTest => async (req, res) => {
    try {
        const data = await createCampaignDispatch({ pool: getPool(req), ownerId: req.user.id, body: req.body, isTest, validateImage: validateUploadedCampaignImage });
        res.status(data.repetido ? 200 : 201).json({ ok: true, data });
    } catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo confirmar el envío. Consulta su estado antes de reintentar.', request_id: req.body?.request_id }); }
};
router.post('/campanas/prueba', ...campaignAccess, dispatchCampaign(true));
router.post('/campanas', ...campaignAccess, dispatchCampaign(false));

// Activar o pausar campaña
router.patch('/campanas/:id/toggle', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            UPDATE nl_campanas_marketing 
            SET activo = NOT activo, updated_at = NOW() 
            WHERE id = $1 
            RETURNING id, activo
        `, [req.params.id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }
        res.json({ ok: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al alternar estado de campaña', details: err.message });
    }
});

// Registrar clic en campaña
router.post('/campanas/:id/click', async (req, res) => {
    const pool = getPool(req);
    try {
        await pool.query(`
            UPDATE nl_campanas_marketing 
            SET total_clics = total_clics + 1 
            WHERE id = $1
        `, [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al registrar clic', details: err.message });
    }
});

// Eliminar campaña de marketing
router.delete('/campanas/:id', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = req.params.id;

        // Limpiar dependencias en destinatarios y envíos si existieran
        await client.query('DELETE FROM nl_campana_destinatarios WHERE campana_id = $1', [id]);
        await client.query('UPDATE nl_campana_envios SET campana_id = NULL WHERE campana_id = $1', [id]);
        // Limpiar notificaciones in-app generadas por la campana
        await client.query("DELETE FROM nl_notificaciones WHERE data->>'campana_id' = $1", [String(id)]);

        const result = await client.query(`
            DELETE FROM nl_campanas_marketing 
            WHERE id = $1 
            RETURNING id, titulo
        `, [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        await client.query('COMMIT');
        res.json({ ok: true, message: 'Campaña eliminada correctamente', data: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al eliminar campaña', details: err.message });
    } finally {
        client.release();
    }
});

export default router;
