import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken, requireRole, forbidRole } from '../middleware/auth.js';
import { sendPushNotificationToMany } from '../modules/notifications/pushNotificationService.js';

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

// Obtener premios activos disponibles para girar (público / kiosco)
router.get('/ruleta/premios', async (req, res) => {
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
        stock_disponible
    } = req.body;

    if (!titulo || !tipo_premio) {
        return res.status(400).json({ error: 'Título y tipo de premio son requeridos' });
    }

    try {
        const insertRes = await pool.query(`
            INSERT INTO nl_ruleta_premios (
                titulo, tipo_premio, valor, descripcion, color_hex, texto_color,
                probabilidad_peso, stock_disponible, stock_entregado, activo
            ) VALUES ($1, $2, $3, $4, COALESCE($5, '#0284c7'), COALESCE($6, '#ffffff'), COALESCE($7, 10), $8, 0, TRUE)
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
                : null
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
        activo
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
                updated_at = NOW()
            WHERE id = $10
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
router.post('/ruleta/girar', async (req, res) => {
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
        res.json({ ok: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Error al listar campañas', details: err.message });
    }
});

// Obtener campañas activas in-app para el cliente autenticado
router.get('/campanas/activas-in-app', async (req, res) => {
    const pool = getPool(req);
    try {
        const result = await pool.query(`
            SELECT 
                id, titulo, mensaje, imagen_url, beneficio_tipo, 
                codigo_descuento, link_destino, created_at
            FROM nl_campanas_marketing
            WHERE activo = TRUE AND mostrar_toast_in_app = TRUE
            ORDER BY created_at DESC
            LIMIT 1
        `);
        res.json({ ok: true, campana: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener campañas activas', details: err.message });
    }
});

// Crear y disparar nueva campaña (In-App + Web Push + Notificación de sistema)
router.post('/campanas', forbidRole('cliente'), async (req, res) => {
    const pool = getPool(req);
    const {
        titulo,
        mensaje,
        imagen_url,
        tipo_audiencia, // 'todos' | 'inactivos' | 'clinicas_especificas'
        segmento_ids,
        beneficio_tipo,
        cupon_id,
        codigo_descuento,
        link_destino,
        mostrar_toast_in_app = true,
        enviar_push_web = true
    } = req.body;

    if (!titulo || !mensaje) {
        return res.status(400).json({ error: 'Título y mensaje son requeridos' });
    }

    try {
        // 1. Guardar campaña
        const campanaRes = await pool.query(`
            INSERT INTO nl_campanas_marketing (
                titulo, mensaje, imagen_url, tipo_audiencia, segmento_ids,
                beneficio_tipo, cupon_id, codigo_descuento, link_destino,
                mostrar_toast_in_app, enviar_push_web, creado_por
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            titulo.trim(),
            mensaje.trim(),
            imagen_url ? imagen_url.trim() : null,
            tipo_audiencia || 'todos',
            JSON.stringify(segmento_ids || []),
            beneficio_tipo || 'cupon',
            cupon_id ? Number(cupon_id) : null,
            codigo_descuento ? String(codigo_descuento).trim().toUpperCase() : null,
            link_destino ? link_destino.trim() : '/pedidos/nuevo',
            Boolean(mostrar_toast_in_app),
            Boolean(enviar_push_web),
            req.user?.id || null
        ]);

        const campana = campanaRes.rows[0];

        // 2. Determinar usuarios destinatarios
        let usersQuery = `
            SELECT u.id, u.nombre, u.clinica_id 
            FROM nl_usuarios u 
            WHERE u.tipo = 'cliente' AND u.estado = 'activo'
        `;
        const queryParams = [];

        if (tipo_audiencia === 'clinicas_especificas' && Array.isArray(segmento_ids) && segmento_ids.length > 0) {
            usersQuery += ` AND u.clinica_id = ANY($1::int[])`;
            queryParams.push(segmento_ids);
        } else if (tipo_audiencia === 'inactivos') {
            usersQuery += ` AND (
                u.clinica_id NOT IN (
                    SELECT DISTINCT clinica_id FROM nl_pedidos 
                    WHERE fecha >= NOW() - INTERVAL '30 days' AND clinica_id IS NOT NULL
                )
            )`;
        }

        const targetUsers = await pool.query(usersQuery, queryParams);
        const userIds = targetUsers.rows.map(u => u.id);

        // 3. Crear notificación in-app en nl_notificaciones para cada usuario objetivo
        if (userIds.length > 0) {
            const notifValues = [];
            const notifParams = [];
            let pIdx = 1;

            const notifData = JSON.stringify({
                campana_id: campana.id,
                imagen_url: campana.imagen_url,
                codigo_descuento: campana.codigo_descuento,
                beneficio_tipo: campana.beneficio_tipo
            });

            for (const uid of userIds) {
                notifParams.push(uid, 'campana_marketing', campana.titulo, campana.mensaje, campana.link_destino || '/pedidos/nuevo', notifData);
                notifValues.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5})`);
                pIdx += 6;
            }

            if (notifValues.length > 0) {
                await pool.query(`
                    INSERT INTO nl_notificaciones (usuario_id, tipo, titulo, mensaje, link, data)
                    VALUES ${notifValues.join(', ')}
                `, notifParams);
            }

            // 4. Disparar Web Push si está marcado
            if (enviar_push_web) {
                try {
                    await sendPushNotificationToMany({
                        pool,
                        userIds,
                        payload: {
                            title: campana.titulo,
                            body: campana.mensaje,
                            icon: '/icon-192x192.png',
                            image: campana.imagen_url || undefined,
                            badge: '/icon-32x32.png',
                            url: campana.link_destino || '/pedidos/nuevo',
                            data: {
                                campana_id: campana.id,
                                codigo_descuento: campana.codigo_descuento
                            }
                        }
                    });
                } catch (pushErr) {
                    console.error('[Marketing] Error disparando Web Push masivo:', pushErr.message);
                }
            }

            // Actualizar total_enviados
            await pool.query(`
                UPDATE nl_campanas_marketing 
                SET total_enviados = $1 
                WHERE id = $2
            `, [userIds.length, campana.id]);
        }

        res.status(201).json({
            ok: true,
            data: campana,
            destinatarios_alcanzados: userIds.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear y disparar campaña', details: err.message });
    }
});

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

export default router;
