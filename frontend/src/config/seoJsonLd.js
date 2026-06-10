import {
    absoluteUrl,
    businessOpeningHours,
    businessSchemaAddress,
    getSiteOrigin,
    SITE_NAME,
    socialProfiles,
} from './siteSeo.js';

function sameAsLinks() {
    const links = [socialProfiles.instagram, socialProfiles.facebook, socialProfiles.tiktok].filter(Boolean);
    const gbp = String(import.meta.env.VITE_GOOGLE_BUSINESS_URL || '').trim();
    if (gbp) {
        links.push(gbp);
    }
    return [...new Set(links)];
}

export function buildWebSiteJsonLd() {
    const origin = getSiteOrigin();
    if (!origin) {
        return null;
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: SITE_NAME,
        url: origin,
        inLanguage: 'es-PE',
        publisher: { '@id': `${origin}/#organization` },
    };
}

export function buildOrganizationJsonLd() {
    const origin = getSiteOrigin();
    if (!origin) {
        return null;
    }
    const address = businessSchemaAddress();
    const openingHours = businessOpeningHours();
    const payload = {
        '@context': 'https://schema.org',
        '@type': 'MedicalBusiness',
        '@id': `${origin}/#organization`,
        name: SITE_NAME,
        url: origin,
        medicalSpecialty: 'Dentistry',
        areaServed: {
            '@type': 'City',
            name: 'Arequipa',
            containedInPlace: {
                '@type': 'Country',
                name: 'Perú',
            },
        },
    };
    const sameAs = sameAsLinks();
    if (sameAs.length) {
        payload.sameAs = sameAs;
    }
    if (address) {
        payload.address = address;
    }
    if (openingHours) {
        payload.openingHoursSpecification = openingHours;
    }
    return payload;
}

/**
 * @param {{
 *   name: string,
 *   description: string,
 *   path: string,
 *   serviceType?: string,
 * }} input
 */
export function buildServiceJsonLd(input) {
    const origin = getSiteOrigin();
    if (!origin) {
        return null;
    }
    const url = absoluteUrl(input.path);
    return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        '@id': `${url}#service`,
        name: input.name,
        description: input.description,
        serviceType: input.serviceType || input.name,
        provider: { '@id': `${origin}/#organization` },
        areaServed: {
            '@type': 'City',
            name: 'Arequipa',
        },
        url,
    };
}

/**
 * @param {{ question: string, answer: string }[]} faqs
 * @param {string} pageUrl
 */
export function buildFaqJsonLd(faqs, pageUrl) {
    if (!faqs?.length) {
        return null;
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
        url: pageUrl,
    };
}

/**
 * @param {{ name: string, path: string }[]} items
 */
export function buildBreadcrumbJsonLd(items) {
    const origin = getSiteOrigin();
    if (!origin || !items?.length) {
        return null;
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path.startsWith('/') ? item.path : `/${item.path}`),
        })),
    };
}

function stripJsonLdContext(node) {
    if (!node) {
        return null;
    }
    const { '@context': _removed, ...rest } = node;
    return rest;
}

/**
 * Combina varios nodos schema.org en un único bloque @graph.
 * @param {(object|null|undefined)[]} parts
 */
export function buildJsonLdGraph(parts) {
    const graph = parts.map(stripJsonLdContext).filter(Boolean);
    if (!graph.length) {
        return null;
    }
    return {
        '@context': 'https://schema.org',
        '@graph': graph,
    };
}
