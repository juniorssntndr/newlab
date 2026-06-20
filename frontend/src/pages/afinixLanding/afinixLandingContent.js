import { mapsHref, phoneCallHref, socialProfiles, whatsappHref } from '../../config/siteSeo.js';

const IMG = '/images/afinix-landing';

export const heroSlides = [
    {
        kicker: '🎁 Pruebe nuestro flujo digital sin riesgo',
        titleBefore: 'Pruebe nuestro flujo con ',
        titleHighlight: '50% de descuento',
        titleAfter: '.',
        copy: 'Compruebe la precisión de nuestro laboratorio en su primer trabajo. Además, obtenga hasta 30% de descuento por cada colega que nos refiera.',
        ctaMain: 'Enviar mi primer caso',
        ctaSecondary: 'Conocer nuestro flujo',
        image: `${IMG}/hero-precision.jpg`,
        alt: 'Prueba de laboratorio dental digital en Arequipa con descuento de bienvenida',
        floatCards: [
            { icon: 'bi-check2-circle', label: 'Bienvenida', value: '50% Off Primer Caso' },
            { icon: 'bi-broadcast', label: 'Programa', value: '30% Off Referidos' },
            { icon: 'bi-chat-left-text', label: 'Satisfacción', value: 'Garantía total' },
        ],
    },
    {
        kicker: '⚡️ ¿Cansado de retocar coronas en sillón?',
        titleBefore: 'Su prótesis lista para cementar, ',
        titleHighlight: 'sin ajustes de último minuto',
        titleAfter: '.',
        copy: 'Ayudamos a odontólogos de Arequipa a coordinar prótesis con aprobación digital previa. Evite retoques en sillón y optimice su tiempo clínico.',
        ctaMain: 'Enviar mi primer caso',
        ctaSecondary: 'Conocer nuestro flujo',
        image: `${IMG}/hero-production.jpg`,
        alt: 'Laboratorio dental digital en Arequipa con enfoque en control clínico',
        floatCards: [
            { icon: 'bi-check2-circle', label: 'Precisión', value: 'Adaptación marginal' },
            { icon: 'bi-broadcast', label: 'Ajuste', value: 'Cero retoques en boca' },
            { icon: 'bi-chat-left-text', label: 'Materiales', value: 'Zirconia y Disilicato' },
        ],
    },
    {
        kicker: '📅 No vuelva a reprogramar una cita de entrega',
        titleBefore: 'La tranquilidad de tener ',
        titleHighlight: 'sus casos terminados a tiempo',
        titleAfter: '.',
        copy: 'Detrás de cada corona hay un paciente y su reputación clínica en juego. Aseguramos plazos de entrega estrictos y trazabilidad en cada etapa.',
        ctaMain: 'Quiero trabajar con AFINIX',
        ctaSecondary: 'Ver servicios',
        image: `${IMG}/hero-equipment.jpg`,
        alt: 'Flujo de trabajo dental ordenado y trazable con entregas a tiempo',
        floatCards: [
            { icon: 'bi-person-check', label: 'Confianza', value: 'Entregas garantizadas' },
            { icon: 'bi-clock-history', label: 'Trazabilidad', value: 'Seguimiento online' },
            { icon: 'bi-activity', label: 'Compromiso', value: 'Respeto a su agenda' },
        ],
    },
    {
        kicker: '💻 Apruebe el diseño antes de fresar el bloque',
        titleBefore: 'Tenga el control total y ',
        titleHighlight: 'evite sorpresas en la prueba',
        titleAfter: '.',
        copy: 'Revise el diseño 3D desde su celular y deje indicaciones claras. Tome el control clínico de la producción sin depender de chats dispersos.',
        ctaMain: 'Solicitar acceso a AFINIX Link',
        ctaSecondary: 'Consultar servicios',
        image: `${IMG}/hero-precision.jpg`,
        alt: 'Aprobación digital 3D de piezas dentales',
        floatCards: [
            { icon: 'bi-bezier2', label: 'Visualización', value: 'Previsualización 3D' },
            { icon: 'bi-layers', label: 'Comunicación', value: 'Comentarios en línea' },
            { icon: 'bi-cpu', label: 'Decisión', value: 'Aprobación 100% online' },
        ],
    },
];

/** Pasos demo para el widget de seguimiento flotante (hero). */
export const heroTrackingSteps = [
    { id: '1', label: 'Caso registrado' },
    { id: '2', label: 'Diseño y aprobación' },
    { id: '3', label: 'Producción CAD/CAM' },
    { id: '4', label: 'Entrega trazable' },
];

export const services = [
    {
        name: 'Coronas Zirconia (CAD/CAM)',
        code: 'CAD-CROWN',
        detail: 'Alta resistencia y estética funcional para restauraciones posteriores y puentes. Diseñadas digitalmente para asegurar un ajuste preciso y reducir el tiempo en sillón.',
        leadTime: '48 horas',
        price: 'Cotización por caso',
        material: 'Zirconia multicapa / monolítica',
        indication: 'Coronas y puentes posteriores y mixtos',
        tags: ['Zirconia', 'Alta Resistencia', 'CAD/CAM'],
        image: `${IMG}/service-zirconia-real.jpg`,
    },
    {
        name: 'Estética en Disilicato (E.max)',
        code: 'E.MAX-CAD',
        detail: 'Restauraciones altamente estéticas para el sector anterior. Logramos naturalidad y traslucidez con un flujo digital que permite previsualizar el resultado final.',
        leadTime: '48 horas',
        price: 'Desde evaluación estética',
        material: 'Disilicato de litio / IPS e.max',
        indication: 'Carillas, incrustaciones y coronas anteriores',
        tags: ['Estética Premium', 'Translucidez'],
        image: `${IMG}/service-emax.jpg`,
    },
    {
        name: 'Guías Quirúrgicas',
        code: 'SURG-GUIDE',
        detail: 'Planificación digital para cirugías implantológicas predecibles. Unimos tu CBCT con el escaneo intraoral para una colocación de implantes precisa y segura.',
        leadTime: '48 horas',
        price: 'A consultar',
        material: 'Resina biocompatible certificada',
        indication: 'Cirugía guiada de implantes',
        tags: ['Precisión', 'CBCT + STL'],
        image: `${IMG}/service-guide.jpg`,
    },
    {
        name: 'Prótesis sobre Implantes',
        code: 'IMP-PROS',
        detail: 'Soluciones digitales para casos unitarios y múltiples. Control total del perfil de emergencia y ajuste pasivo mediante flujos 100% digitales.',
        leadTime: '48 horas',
        price: 'Según estructura y material',
        material: 'Zirconia, Titanio, PMMA',
        indication: 'Rehabilitación sobre implantes',
        tags: ['Ajuste Pasivo', 'Perfil de Emergencia'],
        image: `${IMG}/service-implant-real.jpg`,
    },
    {
        name: 'Corona Metal-Cerámica',
        code: 'PFM-CROWN',
        detail: 'Alternativa protésica de uso clínico extendido que combina una estructura metálica con recubrimiento cerámico.',
        leadTime: '6 días',
        price: 'Cotización por caso',
        material: 'Cr-Co + cerámica',
        indication: 'Coronas unitarias y rehabilitaciones convencionales',
        tags: ['Metal-Cerámica', 'Prótesis Fija'],
        image: `${IMG}/service-cad-real.jpg`,
    },
    {
        name: 'Provisionales en PMMA',
        code: 'PMMA-TEMP',
        detail: 'Coronas y puentes provisionales fresados para proteger preparaciones y validar forma, función y estética.',
        leadTime: '48 horas',
        price: 'Cotización por caso',
        material: 'PMMA multicapa',
        indication: 'Provisionales unitarios y múltiples',
        tags: ['PMMA', 'Provisional'],
        image: `${IMG}/service-provisional-real.jpg`,
    },
    {
        name: 'Carillas Estéticas',
        code: 'VENEER-CAD',
        detail: 'Restauraciones ultraconservadoras para mejorar forma, color y proporción en el sector anterior.',
        leadTime: '5 días',
        price: 'Evaluación estética',
        material: 'Disilicato de litio',
        indication: 'Carillas anteriores',
        tags: ['Carillas', 'Alta Estética'],
        image: `${IMG}/service-emax.jpg`,
    },
    {
        name: 'Inlay y Onlay',
        code: 'INLAY-ONLAY',
        detail: 'Restauraciones parciales CAD/CAM que conservan tejido dental y recuperan anatomía y función.',
        leadTime: '4 días',
        price: 'Cotización por caso',
        material: 'Disilicato o zirconia',
        indication: 'Restauraciones posteriores parciales',
        tags: ['Inlay/Onlay', 'Conservador'],
        image: `${IMG}/service-zirconia.jpg`,
    },
    {
        name: 'Puentes en Zirconia',
        code: 'ZR-BRIDGE',
        detail: 'Estructuras múltiples diseñadas digitalmente para lograr resistencia, ajuste y una integración estética predecible.',
        leadTime: '7 días',
        price: 'Según número de unidades',
        material: 'Zirconia multicapa',
        indication: 'Puentes anteriores y posteriores',
        tags: ['Puentes', 'Zirconia'],
        image: `${IMG}/service-zirconia-real.jpg`,
    },
    {
        name: 'Pilares Personalizados',
        code: 'CUSTOM-ABUTMENT',
        detail: 'Pilares CAD/CAM adaptados al perfil de emergencia y a las necesidades protésicas de cada implante.',
        leadTime: '5 días',
        price: 'Según conexión',
        material: 'Titanio o zirconia',
        indication: 'Rehabilitación implantosoportada',
        tags: ['Titanio', 'CAD/CAM'],
        image: `${IMG}/service-implant-real.jpg`,
    },
    {
        name: 'Férula Michigan',
        code: 'MICHIGAN-SPLINT',
        detail: 'Férula oclusal digital para protección, estabilización y manejo clínico de cargas parafuncionales.',
        leadTime: '3 días',
        price: 'Cotización por caso',
        material: 'PMMA o resina',
        indication: 'Relajación y protección oclusal',
        tags: ['Férula', 'Oclusión'],
        image: `${IMG}/service-provisional-real.jpg`,
    },
    {
        name: 'Estructura Metálica PPR',
        code: 'PPR-CRCO',
        detail: 'Estructuras removibles planificadas para ofrecer estabilidad, soporte y adaptación clínica.',
        leadTime: '8 días',
        price: 'Según diseño',
        material: 'Cromo-cobalto',
        indication: 'Prótesis parcial removible',
        tags: ['PPR', 'Cr-Co'],
        image: `${IMG}/service-hybrid-real.jpg`,
    },
];

export const workflow = [
    {
        id: 'recepcion',
        number: '01',
        title: 'Recepción del caso',
        text: 'Envías tu caso con los archivos disponibles y revisamos si la información está completa para avanzar. Si falta algo o hay algún detalle que pueda afectar el resultado, te lo comunicamos antes de iniciar.',
        benefit: 'Evitas avanzar con archivos incompletos o dudas que después puedan generar retrasos.',
        icon: 'bi-cloud-arrow-up',
        status: 'Validando archivos',
        tags: ['Control de calidad', 'Validación STL'],
        image: `${IMG}/hero-lab.jpg`,
        imageAlt: 'Técnico de laboratorio recibiendo y revisando un caso dental digital',
        imagePosition: 'center',
    },
    {
        id: 'diseno',
        number: '02',
        title: 'Diseño 3D',
        text: 'Preparamos el diseño digital considerando la indicación del caso, la anatomía, los espacios disponibles y los criterios que nos compartas.',
        benefit: 'Puedes visualizar la propuesta antes de que el trabajo entre a producción.',
        icon: 'bi-bezier2',
        status: 'Diseño en proceso',
        tags: ['Exocad Expert', 'Oclusión digital'],
        image: `${IMG}/service-cad-real.jpg`,
        imageAlt: 'Estación de trabajo para diseño dental CAD en el laboratorio',
        imagePosition: 'center',
    },
    {
        id: 'aprobacion',
        number: '03',
        title: 'Revisión y aprobación',
        text: 'Antes de fabricar, puedes revisar el diseño, dejar comentarios o aprobarlo en línea. Tu criterio clínico queda registrado y el laboratorio trabaja sobre una decisión validada.',
        benefit: 'Tienes más control sobre el resultado final y reduces sorpresas al momento de la prueba o instalación.',
        icon: 'bi-person-check',
        status: 'Esperando tu OK',
        tags: ['Cero sorpresas', 'Aprobación online'],
        image: `${IMG}/section-tech.jpg`,
        imageAlt: 'Profesional revisando información digital de un caso dental',
        imagePosition: 'center',
    },
    {
        id: 'produccion',
        number: '04',
        title: 'Producción',
        text: 'Una vez aprobado el diseño, pasamos a producción con el material indicado para el caso. Cada etapa se gestiona con control interno para mantener coherencia entre lo aprobado y lo fabricado.',
        benefit: 'El trabajo no avanza “a ciegas”; se produce sobre una base revisada y aceptada.',
        icon: 'bi-cpu',
        status: 'Fresando pieza',
        tags: ['Alta tecnología', 'Fidelidad 3D'],
        image: `${IMG}/equipment-milling.jpg`,
        imageAlt: 'Equipo de fresado CAD CAM produciendo una restauración dental',
        imagePosition: 'center',
    },
    {
        id: 'entrega',
        number: '05',
        title: 'Entrega y seguimiento',
        text: 'Coordinamos la entrega y conservamos el historial del caso para futuras referencias, ajustes o nuevos trabajos relacionados.',
        benefit: 'Tienes respaldo, trazabilidad y una comunicación más ordenada con el laboratorio.',
        icon: 'bi-box-seam',
        status: 'Listo para envío',
        tags: ['Historial clínico', 'Garantía digital'],
        image: `${IMG}/service-hybrid-real.jpg`,
        imageAlt: 'Prótesis dental terminada y preparada para su entrega',
        imagePosition: 'center',
    },
];

export const partnerClinics = [
    ['CP', 'Clínica Prisma'],
    ['DN', 'Dental Norte'],
    ['IS', 'Implant Studio'],
    ['OP', 'Oral Prime'],
    ['SV', 'Sonrisa Viva'],
    ['CA', 'Centro Aligner'],
];

export const aboutMetrics = [
    {
        value: 'Arequipa Local',
        text: 'Soporte directo y cercano en tu ciudad. Sin demoras por envíos nacionales ni falta de comunicación.',
    },
    {
        value: '24/7 Disponible',
        text: 'Consulta el estado de tus casos, descarga diseños y sube archivos en cualquier momento desde el portal.',
    },
    {
        value: '5 Ejes',
        text: 'Tecnología alemana para casos de alta complejidad que exigen un ajuste marginal perfecto.',
    },
];

export const aboutGallery = [
    {
        src: `${IMG}/service-hybrid-real.jpg`,
        alt: 'Prótesis híbrida dental sobre modelo de trabajo',
    },
    {
        src: `${IMG}/service-zirconia-real.jpg`,
        alt: 'Coronas dentales en zirconia terminadas',
    },
    {
        src: `${IMG}/equipment-milling.jpg`,
        alt: 'Equipo de fresado dental CAD/CAM en funcionamiento',
    },
];

export const mobileQuickLinks = [
    { href: '/#servicios', label: 'Servicios' },
    { href: '/#flujo', label: 'Flujo' },
];

/** Canales comerciales: WhatsApp + ubicación. */
export const contactChannels = [
    {
        label: 'WhatsApp',
        href: whatsappHref(),
        icon: 'bi-whatsapp',
        external: true,
    },
    {
        label: 'Ver ubicación',
        href: mapsHref(),
        icon: 'bi-geo-alt',
        external: true,
    },
];

export const landingContactChannels = [
    {
        id: 'whatsapp',
        title: 'WhatsApp',
        subtitle: 'Envíanos tus archivos o consulta tus dudas al instante.',
        btnText: 'Iniciar chat',
        href: whatsappHref(),
        icon: 'bi-whatsapp',
        colorClass: 'whatsapp',
        external: true,
    },
    {
        id: 'phone',
        title: 'Llamada Directa',
        subtitle: 'Atención rápida y directa para emergencias o coordinaciones.',
        btnText: 'Llamar ahora',
        href: phoneCallHref(),
        icon: 'bi-telephone',
        colorClass: 'phone',
        external: false,
    },
    {
        id: 'maps',
        title: 'Ubicación',
        subtitle: 'Visítanos en nuestro laboratorio dental en Arequipa.',
        btnText: 'Ver en Google Maps',
        href: mapsHref(),
        icon: 'bi-geo-alt',
        colorClass: 'maps',
        external: true,
    },
];

/** Redes sociales (URLs configurables vía VITE_* en siteSeo). */
export const socialLinks = [
    {
        label: 'Instagram',
        href: socialProfiles.instagram,
        icon: 'bi-instagram',
        external: true,
    },
    {
        label: 'Facebook',
        href: socialProfiles.facebook,
        icon: 'bi-facebook',
        external: true,
    },
    {
        label: 'TikTok',
        href: socialProfiles.tiktok,
        icon: 'bi-tiktok',
        external: true,
    },
];

export const landingMetrics = [
    { value: '3,000+', label: 'Casos entregados con éxito', icon: 'bi-check-all' },
    { value: '100%', label: 'Flujo digital y trazable', icon: 'bi-broadcast-pin' },
    { value: '98%', label: 'Satisfacción clínica en Arequipa', icon: 'bi-emoji-smile' },
    { value: '48h', label: 'Tiempo promedio de entrega', icon: 'bi-clock-history' },
];

