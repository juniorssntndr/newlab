import React, { useState, useEffect } from 'react';
import '../styles/afinix-landing-v2.css';
import SeoHead from '../components/seo/SeoHead.jsx';
import JsonLd from '../components/seo/JsonLd.jsx';
import { NavbarV2 } from './afinixLandingV2/NavbarV2.jsx';
import { HeroV2 } from './afinixLandingV2/HeroV2.jsx';
import { PainPointsV2 } from './afinixLandingV2/PainPointsV2.jsx';
import { CatalogGridV2 } from './afinixLandingV2/CatalogGridV2.jsx';
import { WorkflowV2 } from './afinixLandingV2/WorkflowV2.jsx';
import { TrustGuaranteeV2 } from './afinixLandingV2/TrustGuaranteeV2.jsx';
import { FaqV2, FAQ_ITEMS } from './afinixLandingV2/FaqV2.jsx';
import { FinalCtaV2 } from './afinixLandingV2/FinalCtaV2.jsx';
import { FooterV2 } from './afinixLandingV2/FooterV2.jsx';
import { StickyMobileCta } from './afinixLandingV2/StickyMobileCta.jsx';

const AfinixLandingV2 = () => {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('afinix-theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
    });

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        localStorage.setItem('afinix-theme', next);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Structured Data JSON-LD for SEO Rich Snippets
    const jsonLdSchema = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'DentalLaboratory',
                '@id': 'https://www.affinixlab.com/#organization',
                name: 'AFINIX Dental Lab - AFINIX DENTAL LAB S.A.C.',
                legalName: 'AFINIX DENTAL LAB S.A.C.',
                taxID: '20616033973',
                url: 'https://www.affinixlab.com/landing-2',
                logo: 'https://www.affinixlab.com/images/branding/logo-dark.png',
                description: 'Laboratorio dental digital en Arequipa especializado en prótesis fijas CAD/CAM, coronas de zirconia, disilicato y guías quirúrgicas 3D con aprobación digital previa.',
                telephone: '+51910707060',
                priceRange: '$$',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: 'Calle Piura 316, Mariano Melgar',
                    addressLocality: 'Arequipa',
                    addressRegion: 'Arequipa',
                    postalCode: '040126',
                    addressCountry: 'PE'
                },
                geo: {
                    '@type': 'GeoCoordinates',
                    latitude: -16.4042,
                    longitude: -71.5175
                },
                openingHoursSpecification: [
                    {
                        '@type': 'OpeningHoursSpecification',
                        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                        opens: '08:00',
                        closes: '19:00'
                    }
                ]
            },
            {
                '@type': 'FAQPage',
                mainEntity: FAQ_ITEMS.map((item) => ({
                    '@type': 'Question',
                    name: item.q,
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: item.a
                    }
                }))
            }
        ]
    };

    return (
        <div className="afinix-v2-page" data-theme={theme}>
            <SeoHead
                title="AFINIX Dental Lab | Laboratorio Dental Digital en Arequipa (50% OFF Primer Caso)"
                description="Laboratorio dental digital en Arequipa para odontólogos y clínicas. Coronas CAD/CAM en Zirconia y Disilicato, guías quirúrgicas 3D y aprobación previa en tu móvil. Entregas desde 48h."
                path="/landing-2"
            />
            <JsonLd id="ld-v2-schema" data={jsonLdSchema} />

            <NavbarV2 theme={theme} onToggleTheme={toggleTheme} />

            <main id="main-content">
                <HeroV2 />
                <PainPointsV2 />
                <CatalogGridV2 />
                <WorkflowV2 />
                <TrustGuaranteeV2 />
                <FaqV2 />
                <FinalCtaV2 />
            </main>

            <FooterV2 theme={theme} />
            <StickyMobileCta />
        </div>
    );
};

export default AfinixLandingV2;
