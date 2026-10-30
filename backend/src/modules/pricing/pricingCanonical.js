/**
 * Canonical pricing math for AFINIX LAB / SUNAT compliance.
 *
 * All operations use Integer Cents and exact Half-Up rounding to avoid floating-point drift.
 * Fiscal invariant: subtotal (gravada) + igv (18%) === total (exact to the cent).
 */

export const EXPRESS_SURCHARGE_RATE = 0.25;
export const IGV_RATE = 0.18;

/**
 * Standard half-up rounding to a given decimal precision.
 */
export function roundHalfUp(num, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((Number(num) + Number.EPSILON) * factor) / factor;
}

/**
 * Converts a currency amount (in soles) to integer cents.
 */
export function toCents(amount) {
    return Math.round((Number(amount) || 0) * 100);
}

/**
 * Converts integer cents back to a 2-decimal soles number.
 */
export function fromCents(cents) {
    return Math.round(Number(cents) || 0) / 100;
}

/**
 * Splits a total amount into Operación Gravada (subtotal) and IGV (18%)
 * strictly adhering to the SUNAT equation: subtotal + igv === total.
 *
 * Uses Integer Cents to guarantee zero floating-point drift.
 * subtotal = round(total / 1.18)
 * igv = total - subtotal
 */
export function splitTotalIntoTax(totalAmount) {
    const totalCents = toCents(totalAmount);
    const subtotalCents = Math.round(totalCents / (1 + IGV_RATE));
    const igvCents = totalCents - subtotalCents;

    return {
        total: fromCents(totalCents),
        subtotal: fromCents(subtotalCents),
        igv: fromCents(igvCents)
    };
}

/**
 * Computes canonical pricing for an order or item following the business rules:
 * - basePrice: base unit price of product
 * - quantity: unit count (default 1)
 * - isExpress: boolean (applies +25% express surcharge strictly over base price)
 * - coupon: optional coupon object { tipo: 'porcentaje' | 'monto_fijo', valor: number, tope_descuento_maximo?: number }
 *
 * Business rule:
 * - Descuento de cupón se calcula ÚNICAMENTE sobre el precio base del ítem, NUNCA sobre el recargo express.
 * - Recargo express (+25%) se calcula sobre el precio base.
 * - Total = (base - descuento_cupon + recargo_express) * cantidad
 * - subtotal (gravada) e igv calculados de modo que subtotal + igv === total con exactitud de 2 decimales.
 */
export function calculateOrderPricing({
    basePrice,
    quantity = 1,
    isExpress = false,
    coupon = null
}) {
    const qty = Math.max(1, Number(quantity) || 1);
    const unitBaseCents = toCents(basePrice);
    const totalBaseCents = unitBaseCents * qty;

    // 1. Recargo Express (+25% strictly on base)
    const unitExpressCents = isExpress ? Math.round(unitBaseCents * EXPRESS_SURCHARGE_RATE) : 0;
    const totalExpressCents = isExpress ? Math.round(totalBaseCents * EXPRESS_SURCHARGE_RATE) : 0;

    // 2. Descuento de cupón (strictly on base, never on express surcharge)
    let totalDiscountCents = 0;
    let unitDiscountCents = 0;

    if (coupon && Number(coupon.valor) > 0) {
        if (coupon.tipo === 'porcentaje') {
            const pct = Number(coupon.valor);
            unitDiscountCents = Math.round((unitBaseCents * pct) / 100);
            let calculatedTotalDiscount = Math.round((totalBaseCents * pct) / 100);

            if (coupon.tope_descuento_maximo) {
                const maxCapCents = toCents(coupon.tope_descuento_maximo);
                calculatedTotalDiscount = Math.min(calculatedTotalDiscount, maxCapCents);
            }
            totalDiscountCents = Math.min(calculatedTotalDiscount, totalBaseCents);
            unitDiscountCents = qty > 0 ? Math.round(totalDiscountCents / qty) : 0;
        } else {
            // monto_fijo
            const fixedCents = toCents(coupon.valor);
            totalDiscountCents = Math.min(fixedCents, totalBaseCents);
            unitDiscountCents = qty > 0 ? Math.round(totalDiscountCents / qty) : 0;
        }
    }

    // 3. Total calculation:
    // Total = (base - descuento_cupon + recargo_express) * cantidad
    const totalCents = Math.max(0, totalBaseCents - totalDiscountCents + totalExpressCents);

    // 4. Effective unit price
    const unitEffectivePriceCents = unitBaseCents - unitDiscountCents + unitExpressCents;

    // 5. SUNAT tax split: subtotal + igv === total
    const { subtotal, igv, total } = splitTotalIntoTax(fromCents(totalCents));

    return {
        unitBase: fromCents(unitBaseCents),
        unitExpress: fromCents(unitExpressCents),
        unitDiscount: fromCents(unitDiscountCents),
        unitEffectivePrice: fromCents(unitEffectivePriceCents),
        quantity: qty,
        totalBase: fromCents(totalBaseCents),
        totalExpress: fromCents(totalExpressCents),
        totalDiscount: fromCents(totalDiscountCents),
        total,
        subtotal,
        igv
    };
}
