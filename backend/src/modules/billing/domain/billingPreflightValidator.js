import { fromCents, splitTotalIntoTax, toCents } from '../../pricing/pricingCanonical.js';

export class BillingPreflightValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'BillingPreflightValidationError';
        this.details = details;
    }
}

/**
 * Validates and reconciles a billing draft to ensure SUNAT fiscal equation:
 * draft.subtotal.amount + draft.igv.amount === draft.total.amount
 */
export function validateAndReconcileDraft(draft) {
    if (!draft) return draft;

    const totalAmount = Number(draft.total?.amount ?? 0);
    const { total, subtotal, igv } = splitTotalIntoTax(totalAmount);

    draft.total = { ...draft.total, amount: total };
    draft.subtotal = { ...draft.subtotal, amount: subtotal };
    draft.igv = { ...draft.igv, amount: igv };

    return draft;
}

/**
 * Preflight validator and reconciler for APISPERU / SUNAT invoice payloads.
 *
 * Verifies that:
 * 1. mtoOperGravadas + mtoIGV === mtoImpVenta (exact to 2 decimal places).
 * 2. Sum of line details mtoValorVenta === mtoOperGravadas.
 * 3. Sum of line details igv === mtoIGV.
 *
 * If a small rounding imbalance (e.g. 0.01 or 0.02) exists between the sum of lines
 * and header totals, it reconciles the difference on the last line item without breaking
 * SUNAT validation rules.
 */
export function validateAndReconcileApisperuPayload(payload) {
    if (!payload) return payload;

    const totalVentaCents = toCents(payload.mtoImpVenta);
    if (totalVentaCents <= 0) {
        throw new BillingPreflightValidationError('El monto total de venta (mtoImpVenta) debe ser mayor a 0', { payload });
    }

    // 1. Compute expected canonical header totals
    const expectedGravadaCents = Math.round(totalVentaCents / 1.18);
    const expectedIgvCents = totalVentaCents - expectedGravadaCents;

    let headerGravadaCents = toCents(payload.mtoOperGravadas);
    let headerIgvCents = toCents(payload.mtoIGV);

    // Reconcile header if it drifts from the canonical total
    if (headerGravadaCents + headerIgvCents !== totalVentaCents) {
        headerGravadaCents = expectedGravadaCents;
        headerIgvCents = expectedIgvCents;
    }

    const details = Array.isArray(payload.details) ? payload.details : [];

    if (details.length > 0) {
        if (details.length === 1) {
            // Single-Product Work Order (standard in AFINIX Dental Lab)
            const item = details[0];
            const qty = Math.max(1, Number(item.cantidad) || 1);

            item.mtoValorVenta = fromCents(headerGravadaCents);
            item.mtoBaseIgv = item.mtoValorVenta;
            item.igv = fromCents(headerIgvCents);
            item.totalImpuestos = item.igv;
            item.mtoValorUnitario = Number((item.mtoValorVenta / qty).toFixed(6));
            item.mtoPrecioUnitario = Number(((item.mtoValorVenta + item.igv) / qty).toFixed(6));
        } else {
            // Multi-line items: check line sums vs header
            let sumLinesValorVentaCents = details.reduce((sum, d) => sum + toCents(d.mtoValorVenta), 0);
            let sumLinesIgvCents = details.reduce((sum, d) => sum + toCents(d.igv), 0);

            const diffGravadaCents = headerGravadaCents - sumLinesValorVentaCents;
            const diffIgvCents = headerIgvCents - sumLinesIgvCents;

            // Reconcile rounding drift up to 5 cents on the last line
            if (diffGravadaCents !== 0 && Math.abs(diffGravadaCents) <= 5) {
                const targetLine = details[details.length - 1];
                const qty = Math.max(1, Number(targetLine.cantidad) || 1);
                const reconciledVentaCents = toCents(targetLine.mtoValorVenta) + diffGravadaCents;
                targetLine.mtoValorVenta = fromCents(reconciledVentaCents);
                targetLine.mtoBaseIgv = targetLine.mtoValorVenta;
                targetLine.mtoValorUnitario = Number((targetLine.mtoValorVenta / qty).toFixed(6));
            }

            if (diffIgvCents !== 0 && Math.abs(diffIgvCents) <= 5) {
                const targetLine = details[details.length - 1];
                const qty = Math.max(1, Number(targetLine.cantidad) || 1);
                const reconciledIgvCents = toCents(targetLine.igv) + diffIgvCents;
                targetLine.igv = fromCents(reconciledIgvCents);
                targetLine.totalImpuestos = targetLine.igv;
                targetLine.mtoPrecioUnitario = Number(((targetLine.mtoValorVenta + targetLine.igv) / qty).toFixed(6));
            }
        }
    }

    // Set canonical amounts on header
    payload.mtoOperGravadas = fromCents(headerGravadaCents);
    payload.valorVenta = payload.mtoOperGravadas;
    payload.mtoIGV = fromCents(headerIgvCents);
    payload.totalImpuestos = payload.mtoIGV;
    payload.mtoImpVenta = fromCents(totalVentaCents);
    payload.subTotal = payload.mtoImpVenta;

    // Strict preflight invariants verification
    const finalSumGravadaCents = details.reduce((sum, d) => sum + toCents(d.mtoValorVenta), 0);
    const finalSumIgvCents = details.reduce((sum, d) => sum + toCents(d.igv), 0);

    if (details.length > 0) {
        if (finalSumGravadaCents !== headerGravadaCents) {
            throw new BillingPreflightValidationError(
                `Desbalance en líneas: la suma de mtoValorVenta (${fromCents(finalSumGravadaCents)}) no coincide con mtoOperGravadas (${fromCents(headerGravadaCents)})`,
                { finalSumGravada: fromCents(finalSumGravadaCents), headerGravada: fromCents(headerGravadaCents) }
            );
        }
        if (finalSumIgvCents !== headerIgvCents) {
            throw new BillingPreflightValidationError(
                `Desbalance en líneas: la suma de igv (${fromCents(finalSumIgvCents)}) no coincide con mtoIGV (${fromCents(headerIgvCents)})`,
                { finalSumIgv: fromCents(finalSumIgvCents), headerIgv: fromCents(headerIgvCents) }
            );
        }
    }

    if (headerGravadaCents + headerIgvCents !== totalVentaCents) {
        throw new BillingPreflightValidationError(
            `Ecuación SUNAT rota: mtoOperGravadas (${payload.mtoOperGravadas}) + mtoIGV (${payload.mtoIGV}) !== mtoImpVenta (${payload.mtoImpVenta})`,
            { gravada: payload.mtoOperGravadas, igv: payload.mtoIGV, total: payload.mtoImpVenta }
        );
    }

    return payload;
}
