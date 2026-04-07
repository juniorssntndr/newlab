export const applyOptimisticPayment = (currentDetail, payload) => {
    if (!currentDetail) {
        return currentDetail;
    }

    const monto = parseFloat(payload?.monto || 0);
    const pagadoActual = parseFloat(currentDetail?.monto_pagado || 0);
    const totalActual = parseFloat(currentDetail?.total || 0);
    const nuevoPagado = pagadoActual + monto;
    const nuevoSaldo = Math.max(totalActual - nuevoPagado, 0);

    const normalizedPago = {
        id: `optimistic-${Date.now()}`,
        monto,
        metodo: payload?.metodo || null,
        tipo_fondo: payload?.tipo_fondo || null,
        referencia: payload?.referencia || null,
        fecha_pago: payload?.fecha_pago || new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
        cuenta_nombre: null
    };

    return {
        ...currentDetail,
        monto_pagado: nuevoPagado,
        saldo: nuevoSaldo,
        estado_pago: nuevoSaldo <= 0 ? 'cancelado' : 'pago_parcial',
        pagos: [...(currentDetail?.pagos || []), normalizedPago]
    };
};
