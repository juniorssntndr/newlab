import React from 'react';

const OrderPricingSummary = ({
    item,
    total,
    title = 'Resumen del item',
    showItemSubtotal = true,
    extraCharge = 0,
    extraChargeLabel = 'Recargo adicional',
    className = ''
}) => {
    if (!item) {
        return (
            <section className={['order-composer-pricing', className].filter(Boolean).join(' ')}>
                <h4 className="order-composer-pricing-title">{title}</h4>
                <p className="order-composer-pricing-empty">Selecciona un producto para ver subtotal y total.</p>
            </section>
        );
    }

    return (
        <section className={['order-composer-pricing', className].filter(Boolean).join(' ')}>
            <h4 className="order-composer-pricing-title">{title}</h4>
            <div className="order-composer-pricing-row">
                <span className="order-composer-pricing-label">Precio unitario</span>
                <strong className="order-composer-pricing-value">S/. {Number(item.precio_unitario || 0).toFixed(2)}</strong>
            </div>
            <div className="order-composer-pricing-row">
                <span className="order-composer-pricing-label">{item.requiresDentalSelection ? 'Piezas seleccionadas' : 'Cantidad manual'}</span>
                <strong className="order-composer-pricing-value">{item.cantidad || 0}</strong>
            </div>
            {showItemSubtotal && (
                <div className="order-composer-pricing-row order-composer-pricing-row-subtotal">
                    <span className="order-composer-pricing-label">Subtotal item</span>
                    <strong className="order-composer-pricing-value">S/. {Number(item.subtotal || 0).toFixed(2)}</strong>
                </div>
            )}
            {Number(extraCharge) > 0 && (
                <div className="order-composer-pricing-row">
                    <span className="order-composer-pricing-label">{extraChargeLabel}</span>
                    <strong className="order-composer-pricing-value order-composer-pricing-value-extra-charge">
                        S/. {Number(extraCharge).toFixed(2)}
                    </strong>
                </div>
            )}
            <div className="order-composer-pricing-total">
                <span className="order-composer-pricing-total-label">TOTAL PEDIDO</span>
                <strong>S/. {Number(total || 0).toFixed(2)}</strong>
            </div>
        </section>
    );
};

export default OrderPricingSummary;
