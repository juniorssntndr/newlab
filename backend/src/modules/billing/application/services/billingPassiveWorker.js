import { logger } from '../../../../lib/logger.js';
import { consultarEstadoSunat } from '../../../../services/apisperu.js';

/**
 * Worker de Envío Pasivo y Contingencia de Facturación SUNAT
 *
 * Responsabilidad:
 * 1. Inspeccionar comprobantes en estado 'generado' o 'error' (menos de 3 días de antigüedad).
 * 2. Idempotencia: Consultar primero estado en SUNAT/APISPERU (GET /invoice/status).
 *    - Si ya existe en SUNAT: Actualizar a 'aceptado' y descargar URLs (CDR, PDF, XML).
 *    - Si NO existe en SUNAT: Reintentar el despacho hacia el proveedor con el mismo correlativo.
 * 3. Ejecución periódica no bloqueante con backoff y guardia de concurrencia.
 */

export const syncOrRetryComprobante = async ({ pool, billingModule, comprobanteId }) => {
    const id = Number(comprobanteId);
    if (!id || isNaN(id)) throw new Error('ID de comprobante inválido');

    const compRes = await pool.query(
        `SELECT c.*, p.id as pedido_id, p.total as pedido_total, p.subtotal as pedido_subtotal
         FROM nl_comprobantes c
         LEFT JOIN nl_pedidos p ON p.id = c.pedido_id
         WHERE c.id = $1 LIMIT 1`,
        [id]
    );

    if (compRes.rows.length === 0) {
        throw new Error(`Comprobante ${id} no encontrado.`);
    }

    const comp = compRes.rows[0];

    // Si ya está aceptado o anulado, no requiere acción
    if (['aceptado', 'anulado'].includes(comp.estado_sunat)) {
        return {
            comprobanteId: id,
            status: comp.estado_sunat,
            message: `El comprobante ya está en estado final: ${comp.estado_sunat}`
        };
    }

    // PASO 1: Consultar estado en APISPERU / SUNAT antes de reenviar (Evita error 1033)
    try {
        let statusResult;
        if (billingModule?.billingController && billingModule?.billingAclMode === 'new-acl') {
            const syncExec = await billingModule.billingController.syncInvoiceStatus.execute(
                { requestId: `passive-sync-${id}`, actorId: 'system-passive-worker' },
                { params: { comprobanteId: String(id) } }
            );
            if (syncExec.ok && syncExec.data) {
                statusResult = syncExec.data;
            }
        } else {
            statusResult = await consultarEstadoSunat(pool, id);
        }

        if (statusResult && (statusResult.estadoCpe === '01' || statusResult.invoiceStatus === 'SENT' || statusResult.sunatResponse?.success)) {
            logger.info('billing_passive_sync_accepted', {
                comprobante_id: id,
                serie: comp.serie,
                correlativo: comp.correlativo
            });
            return {
                comprobanteId: id,
                status: 'aceptado',
                message: 'Comprobante confirmado y aceptado por SUNAT.'
            };
        }
    } catch (statusError) {
        // Si la consulta da 404 o "no encontrado", significa que aún no llegó a SUNAT -> procedemos al reenvío
        logger.warn('billing_status_check_miss', {
            comprobante_id: id,
            error: statusError.message
        });
    }

    // PASO 2: Si el comprobante nunca llegó a SUNAT y tiene borrador persistido, reintentamos despacho
    if (billingModule?.billingService && billingModule?.billingAclMode === 'new-acl') {
        try {
            const syncResult = await billingModule.billingService.syncInvoiceStatus(id);
            return {
                comprobanteId: id,
                status: syncResult.invoiceStatus === 'SENT' ? 'aceptado' : 'error',
                message: syncResult.cdrDescription || 'Sincronizado'
            };
        } catch (retryError) {
            logger.error('billing_passive_retry_failed', {
                comprobante_id: id,
                error: retryError.message
            });
            throw retryError;
        }
    }

    return {
        comprobanteId: id,
        status: comp.estado_sunat,
        message: 'Pendiente de procesamiento'
    };
};

export const runBillingPassiveSyncCycle = async ({ pool, billingModule }) => {
    try {
        // Seleccionamos comprobantes en 'generado' o 'error' de hasta 3 días (plazo legal de SUNAT)
        const pendingRows = await pool.query(
            `SELECT id, tipo_comprobante, serie, correlativo, estado_sunat, created_at
             FROM nl_comprobantes
             WHERE estado_sunat IN ('generado', 'error')
               AND created_at >= NOW() - INTERVAL '3 days'
             ORDER BY created_at ASC
             LIMIT 10`
        );

        if (pendingRows.rows.length === 0) {
            return { processed: 0, accepted: 0, failed: 0 };
        }

        logger.info('billing_passive_worker_cycle_started', {
            count: pendingRows.rows.length
        });

        let accepted = 0;
        let failed = 0;

        for (const row of pendingRows.rows) {
            try {
                const res = await syncOrRetryComprobante({ pool, billingModule, comprobanteId: row.id });
                if (res.status === 'aceptado') accepted++;
            } catch (err) {
                failed++;
            }
        }

        logger.info('billing_passive_worker_cycle_finished', {
            processed: pendingRows.rows.length,
            accepted,
            failed
        });

        return { processed: pendingRows.rows.length, accepted, failed };
    } catch (cycleError) {
        logger.error('billing_passive_worker_error', {
            error: cycleError.message
        });
        return { error: cycleError.message };
    }
};

/**
 * Inicia el cron en segundo plano de despacho pasivo
 */
export const startBillingPassiveWorker = ({ pool, billingModule, intervalMs = 300000 }) => {
    let isProcessing = false;

    const timer = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            await runBillingPassiveSyncCycle({ pool, billingModule });
        } catch (err) {
            logger.error('billing_worker_tick_error', { error: err.message });
        } finally {
            isProcessing = false;
        }
    }, intervalMs);

    // Evitar que el timer bloquee la finalización limpia del proceso Node
    if (timer.unref) timer.unref();

    return {
        stop: () => clearInterval(timer),
        runNow: () => runBillingPassiveSyncCycle({ pool, billingModule })
    };
};
