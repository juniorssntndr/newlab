import React, { useEffect, useState } from 'react';
import { resolveImageUrl, resolveProductImageUrl } from '../../utils/resolveImageUrl.js';
import { matchLandingProductImage } from '../../utils/productCatalogImages.js';

/**
 * Product thumbnail used in wizard confirm and order detail for visual continuity.
 */
const OrderProductThumb = ({ product }) => {
    const primarySrc = resolveProductImageUrl(product);
    const landingSrc = resolveImageUrl(matchLandingProductImage(product));
    const preferredSrc = primarySrc || landingSrc;
    const [src, setSrc] = useState(preferredSrc);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setSrc(preferredSrc);
        setImgError(false);
    }, [preferredSrc]);

    if (!src || imgError) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, color: 'var(--color-primary)' }} aria-label="Producto Dental">
                <path d="M7 2.5C4.5 2.5 3 4.5 3 7.5C3 11 4.5 13.5 5 16.5C5.5 19.5 6 21.5 7.5 21.5C9 21.5 9.5 18.5 10.5 15.5C11.2 13.5 12.8 13.5 13.5 15.5C14.5 18.5 15 21.5 16.5 21.5C18 21.5 18.5 19.5 19 16.5C19.5 13.5 21 11 21 7.5C21 4.5 19.5 2.5 17 2.5C14.8 2.5 13.5 4 12 4C10.5 4 9.2 2.5 7 2.5Z" />
            </svg>
        );
    }

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => {
                if (landingSrc && src !== landingSrc) {
                    setSrc(landingSrc);
                    return;
                }
                setImgError(true);
            }}
        />
    );
};

export default OrderProductThumb;
