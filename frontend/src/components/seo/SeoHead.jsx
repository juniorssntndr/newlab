import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { absoluteUrl, defaultOgImagePath, gaMeasurementId, googleSiteVerification, SITE_NAME } from '../../config/siteSeo.js';

function upsertMeta(attr, key, content) {
    if (!content) return;
    const selector = attr === 'property' ? `meta[property="${key}"]` : `meta[name="${key}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function upsertLink(rel, href) {
    if (!href) return;
    const selector = `link[rel="${rel}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function upsertHreflang(hreflang, href) {
    if (!href) return;
    const selector = `link[rel="alternate"][hreflang="${hreflang}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'alternate');
        el.setAttribute('hreflang', hreflang);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function clearHreflangAlternates() {
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
}

let gaInitialized = false;

function ensureGa(measurementId) {
    if (!measurementId || gaInitialized || typeof document === 'undefined') {
        return;
    }
    gaInitialized = true;
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(gtagScript);

    const inline = document.createElement('script');
    inline.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}', { anonymize_ip: true });
    `;
    document.head.appendChild(inline);
}

/**
 * @param {{
 *   title: string,
 *   description: string,
 *   path?: string,
 *   ogImagePath?: string,
 *   noindex?: boolean,
 *   type?: string,
 * }} props
 */
export default function SeoHead({ title, description, path, ogImagePath = defaultOgImagePath, noindex = false, type = 'website' }) {
    const location = useLocation();
    const resolvedPath = path ?? location.pathname + (location.search || '');
    const canonical = absoluteUrl(resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`);
    const ogImage = absoluteUrl(ogImagePath.startsWith('/') ? ogImagePath : `/${ogImagePath}`);
    const resolvedTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const siteVerify = googleSiteVerification();

    useEffect(() => {
        document.title = resolvedTitle;
        upsertMeta('name', 'description', description);
        upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
        upsertMeta('property', 'og:title', resolvedTitle);
        upsertMeta('property', 'og:description', description);
        upsertMeta('property', 'og:type', type);
        upsertMeta('property', 'og:url', canonical);
        upsertMeta('property', 'og:image', ogImage);
        upsertMeta('property', 'og:site_name', SITE_NAME);
        upsertMeta('property', 'og:locale', 'es_PE');
        upsertMeta('name', 'twitter:card', 'summary_large_image');
        upsertMeta('name', 'twitter:title', resolvedTitle);
        upsertMeta('name', 'twitter:description', description);
        upsertMeta('name', 'twitter:image', ogImage);
        upsertLink('canonical', canonical);
        if (siteVerify) {
            upsertMeta('name', 'google-site-verification', siteVerify);
        }

        if (!noindex && canonical.startsWith('http')) {
            upsertHreflang('es-pe', canonical);
            upsertHreflang('x-default', canonical);
        } else {
            clearHreflangAlternates();
        }

        const measurementId = gaMeasurementId();
        ensureGa(measurementId);
    }, [canonical, description, noindex, ogImage, resolvedTitle, siteVerify, type]);

    return null;
}
