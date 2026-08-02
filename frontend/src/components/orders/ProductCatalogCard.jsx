import React, { useEffect, useState } from 'react';
import { resolveProductImageUrl } from '../../utils/resolveImageUrl.js';
import { getProductDisplayName } from '../../utils/productDisplayName.js';

/**
 * Shared product card used in client catalog, lab wizard, and lab product admin.
 */
const ProductCatalogCard = ({
    producto,
    onOrder,
    ctaLabel = 'Solicitar Pedido',
    ctaIcon = 'bi-bag-plus',
    className = '',
    mediaOverlay = null,
}) => {
    const [imgError, setImgError] = useState(false);
    const [descExpanded, setDescExpanded] = useState(false);
    const imageSrc = resolveProductImageUrl(producto);
    const description = String(producto?.descripcion || '').trim();
    const canExpand = description.length > 72;
    const productKey = `${producto?.id || ''}:${imageSrc}`;
    const displayName = getProductDisplayName(producto?.nombre);

    useEffect(() => {
        setImgError(false);
        setDescExpanded(false);
    }, [productKey]);

    return (
        <div className={`card catalog-product-card${className ? ` ${className}` : ''}`}>
            <div className="catalog-product-card-media">
                {imageSrc && !imgError ? (
                    <img
                        src={imageSrc}
                        alt={displayName}
                        loading="lazy"
                        decoding="async"
                        onError={() => setImgError(true)}
                        className="catalog-product-card-image"
                    />
                ) : (
                    <div className="catalog-product-card-media-fallback">
                        <i className="bi bi-gem" aria-hidden="true" />
                    </div>
                )}
                {producto?.categoria_nombre ? (
                    <span className="catalog-product-card-category">
                        {producto.categoria_nombre}
                    </span>
                ) : null}
                {mediaOverlay}
            </div>

            <div className="catalog-product-card-content">
                <h3 className="catalog-product-card-title" title={String(producto?.nombre || displayName)}>
                    {displayName}
                </h3>

                {producto?.material_nombre ? (
                    <p className="catalog-product-card-material">
                        <i className="bi bi-layers" aria-hidden="true" />
                        {producto.material_nombre}
                    </p>
                ) : null}

                {description ? (
                    canExpand ? (
                        <button
                            type="button"
                            className={`catalog-product-card-description${descExpanded ? ' is-expanded' : ''}`}
                            onClick={() => setDescExpanded((v) => !v)}
                            aria-expanded={descExpanded}
                            aria-label={descExpanded ? 'Contraer descripción' : 'Expandir descripción'}
                        >
                            {description}
                            {!descExpanded ? (
                                <span className="catalog-product-card-more"> más</span>
                            ) : null}
                        </button>
                    ) : (
                        <p className="catalog-product-card-description">{description}</p>
                    )
                ) : (
                    <p className="catalog-product-card-description is-empty" aria-hidden="true">&nbsp;</p>
                )}

                <div className="catalog-product-card-footer">
                    <div>
                        {Number(producto?.precio_base) > 0 ? (
                            <div className="catalog-product-card-price">
                                S/. {Number(producto.precio_base).toFixed(2)}
                            </div>
                        ) : null}
                    </div>
                    {producto?.tiempo_estimado_dias ? (
                        <div className="catalog-product-card-time">
                            <i className="bi bi-clock" aria-hidden="true" />
                            {producto.tiempo_estimado_dias} día{producto.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={onOrder}
                    className="btn btn-primary catalog-product-card-cta"
                >
                    <i className={`bi ${ctaIcon}`} aria-hidden="true" /> {ctaLabel}
                </button>
            </div>
        </div>
    );
};

export default React.memo(ProductCatalogCard);
