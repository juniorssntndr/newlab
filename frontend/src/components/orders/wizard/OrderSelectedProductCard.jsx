import React, { useEffect, useState } from 'react';
import { resolveImageUrl, resolveProductImageUrl } from '../../../utils/resolveImageUrl.js';
import { matchLandingProductImage } from '../../../utils/productCatalogImages.js';

/**
 * Catalog-style product summary for the order wizard.
 * Use variant="featured" on Paciente for a larger image + single price/ETA line.
 */
const OrderSelectedProductCard = ({
    product,
    onChange,
    changeLabel = 'Cambiar producto',
    empty = false,
    emptyLabel = 'Sin producto',
    emptyHint = 'Elige uno desde el catálogo para continuar',
    emptyActionLabel = 'Ir al catálogo',
    onEmptyAction,
    variant = 'default',
    priceLabel = null,
    etaLabel = null,
    priceNote = null,
}) => {
    const primarySrc = !empty ? resolveProductImageUrl(product) : '';
    const landingSrc = !empty ? resolveImageUrl(matchLandingProductImage(product)) : '';
    const preferredSrc = primarySrc || landingSrc;
    const [src, setSrc] = useState(preferredSrc);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setSrc(preferredSrc);
        setImgError(false);
    }, [preferredSrc]);

    const handleImgError = () => {
        if (landingSrc && src !== landingSrc) {
            setSrc(landingSrc);
            return;
        }
        setImgError(true);
    };

    const summaryClass = [
        'order-wizard-product-summary',
        variant === 'featured' ? 'is-featured' : '',
        empty ? 'is-empty' : '',
    ].filter(Boolean).join(' ');

    if (empty) {
        return (
            <div className={summaryClass}>
                <div className="order-wizard-product-summary-media" aria-hidden="true">
                    <i className="bi bi-bag-plus"></i>
                </div>
                <div className="order-wizard-product-summary-copy">
                    <strong>{emptyLabel}</strong>
                    <span>{emptyHint}</span>
                    {onEmptyAction ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={onEmptyAction}>
                            {emptyActionLabel}
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    const name = product?.nombre || 'Producto';
    const category = product?.categoria_nombre || '';
    const material = product?.material_nombre || product?.material || '';
    const fallbackPrice = Number(product?.precio_base ?? product?.precio_unitario ?? 0);
    const resolvedPriceLabel = priceLabel != null
        ? priceLabel
        : (fallbackPrice > 0 ? `S/. ${fallbackPrice.toFixed(2)}` : null);

    return (
        <div className={summaryClass}>
            <div className="order-wizard-product-summary-media" aria-hidden="true">
                {src && !imgError ? (
                    <img
                        src={src}
                        alt=""
                        loading="lazy"
                        onError={handleImgError}
                    />
                ) : (
                    <i className="bi bi-gem"></i>
                )}
            </div>
            <div className="order-wizard-product-summary-copy">
                {category ? <span className="order-wizard-product-summary-kicker">{category}</span> : null}
                <strong>{name}</strong>
                {material ? <span className="order-wizard-product-summary-material">{material}</span> : null}

                {(resolvedPriceLabel || etaLabel) ? (
                    <div className="order-wizard-product-summary-meta" aria-live="polite">
                        {resolvedPriceLabel ? (
                            <span className="order-wizard-product-summary-price">{resolvedPriceLabel}</span>
                        ) : null}
                        {etaLabel ? (
                            <span className="order-wizard-product-summary-eta">{etaLabel}</span>
                        ) : null}
                    </div>
                ) : null}

                {priceNote ? (
                    <span className="order-wizard-product-summary-note">{priceNote}</span>
                ) : null}

                {onChange ? (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm order-wizard-product-change-btn"
                        onClick={onChange}
                    >
                        <i className="bi bi-arrow-left-right" aria-hidden="true"></i>
                        {changeLabel}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default React.memo(OrderSelectedProductCard);
