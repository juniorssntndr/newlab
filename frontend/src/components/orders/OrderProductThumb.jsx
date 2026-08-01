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
        return <i className="bi bi-gem" aria-hidden="true"></i>;
    }

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
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
