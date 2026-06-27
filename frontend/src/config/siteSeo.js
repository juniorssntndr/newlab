/**
 * SEO y canales comerciales centralizados.
 * Configura VITE_SITE_ORIGIN, VITE_WHATSAPP_E164, VITE_GA_MEASUREMENT_ID y URLs sociales en .env (Vite).
 * No incluir datos inventados: dirección y horarios solo si existen en env.
 */

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const SITE_NAME = 'AFINIX Dental Lab';
export const SITE_TAGLINE = 'Laboratorio dental digital en Arequipa';

export const getConfiguredSiteOrigin = () => trimTrailingSlash(import.meta.env.VITE_SITE_ORIGIN || '');

export const getSiteOrigin = () => {
    const configured = getConfiguredSiteOrigin();
    if (configured) return configured;
    if (typeof window !== 'undefined' && window.location?.origin) {
        return trimTrailingSlash(window.location.origin);
    }
    return '';
};

export const absoluteUrl = (path) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const base = getSiteOrigin();
    if (!base) return normalized;
    return `${base}${normalized}`;
};

export const WHATSAPP_PREFILL_MESSAGE =
    'Hola AFINIX Dental Lab, quisiera recibir información sobre sus servicios y enviarles un caso.';

export const whatsappHref = () => {
    const phone = String(import.meta.env.VITE_WHATSAPP_E164 || '51910707060').replace(/\D/g, '');
    const text = encodeURIComponent(WHATSAPP_PREFILL_MESSAGE);
    return `https://wa.me/${phone}?text=${text}`;
};

export const phoneCallHref = () => {
    const phone = String(import.meta.env.VITE_PHONE_CALL || import.meta.env.VITE_WHATSAPP_E164 || '51910707060').replace(/\D/g, '');
    return phone ? `tel:+${phone}` : 'tel:';
};

export const mapsHref = () =>
    trimTrailingSlash(import.meta.env.VITE_MAPS_URL || 'https://maps.app.goo.gl/HnqqE8r9vsNVrznA7') || 'https://www.google.com/maps';

export const googleBusinessProfileHref = () => trimTrailingSlash(import.meta.env.VITE_GOOGLE_BUSINESS_URL || '') || '';

export const socialProfiles = {
    instagram: trimTrailingSlash(import.meta.env.VITE_SOCIAL_INSTAGRAM_URL || '') || 'https://instagram.com/afinixlab',
    facebook: trimTrailingSlash(import.meta.env.VITE_SOCIAL_FACEBOOK_URL || '') || 'https://facebook.com/afinixlab',
    tiktok: trimTrailingSlash(import.meta.env.VITE_SOCIAL_TIKTOK_URL || '') || 'https://tiktok.com/@afinixlab',
};

export const businessSchemaAddress = () => {
    const street = String(import.meta.env.VITE_BUSINESS_ADDRESS_STREET || '').trim();
    const locality = String(import.meta.env.VITE_BUSINESS_ADDRESS_LOCALITY || 'Arequipa').trim() || 'Arequipa';
    const region = String(import.meta.env.VITE_BUSINESS_ADDRESS_REGION || '').trim();
    const postal = String(import.meta.env.VITE_BUSINESS_ADDRESS_POSTAL || '').trim();
    const country = String(import.meta.env.VITE_BUSINESS_ADDRESS_COUNTRY || 'PE').trim() || 'PE';
    if (!street) {
        return null;
    }
    return {
        '@type': 'PostalAddress',
        streetAddress: street,
        addressLocality: locality,
        addressRegion: region || undefined,
        postalCode: postal || undefined,
        addressCountry: country,
    };
};

export const businessOpeningHours = () => {
    const raw = String(import.meta.env.VITE_BUSINESS_OPENING_HOURS_JSON || '').trim();
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const defaultOgImagePath = '/images/afinix-landing/hero-precision.jpg';

export const gaMeasurementId = () => String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim();

export const googleSiteVerification = () => String(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION || '').trim();

export const privacyContactEmail = () => String(import.meta.env.VITE_PRIVACY_CONTACT_EMAIL || '').trim();
