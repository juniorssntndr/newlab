import { mapsHref, phoneCallHref, socialProfiles, whatsappHref } from '../../config/siteSeo.js';

const IMG = '/images/afinix-landing';

export const heroSlides = [
    {
        kicker: '🎁 Pruebe nuestro flujo digital sin riesgo',
        kickerMobile: '🎁 Pruebe nuestro flujo sin riesgo',
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
        kickerMobile: '⚡️ ¿Cansado de retocar coronas?',
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
        kickerMobile: '📅 Casos listos y a tiempo',
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
        kickerMobile: '💻 Aprobación de diseño 3D',
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
        name: 'Guías Quirúrgicas Impresas en 3D (apilables y con irrigación)',
        code: 'SURG-GUIDE-3D',
        detail: 'Guías apilables impresas en 3D con sistema de irrigación integrado. Planificación digital a partir de CBCT y escaneo intraoral para cirugías implantológicas más predecibles.',
        leadTime: '48 horas',
        price: 'A consultar',
        material: 'Resina biocompatible certificada',
        indication: 'Cirugía guiada de implantes',
        tags: ['Impresión 3D', 'Apilables', 'Irrigación'],
        image: `${IMG}/service-guide.jpg`,
    },
    {
        name: 'Coronas de Resina con Carga Cerámica Impresa en 3D',
        code: 'RESIN-CROWN-3D',
        detail: 'Coronas con resina de alta performance y carga cerámica, impresas en 3D para un flujo digital ágil con estética y ajuste predecible.',
        leadTime: '48 horas',
        price: 'Cotización por caso',
        material: 'Resina con carga cerámica',
        indication: 'Coronas unitarias anteriores y posteriores',
        tags: ['Impresión 3D', 'Resina Cerámica'],
        image: `${IMG}/service-crown-resin-3d.jpg`,
    },
    {
        name: 'Carillas de Resina con Carga Cerámica Impresa en 3D',
        code: 'RESIN-VENEER-3D',
        detail: 'Carillas ultrafinas impresas en 3D con resina cerámica para mejorar forma, color y proporción en el sector anterior con mínima intervención.',
        leadTime: '48 horas',
        price: 'Evaluación estética',
        material: 'Resina con carga cerámica',
        indication: 'Carillas anteriores',
        tags: ['Impresión 3D', 'Carillas', 'Estética'],
        image: `${IMG}/service-veneer-resin-3d.jpg`,
    },
    {
        name: 'Inlay - Onlay de Resina con Carga Cerámica Impresa en 3D',
        code: 'INLAY-ONLAY-3D',
        detail: 'Restauraciones parciales impresas en 3D que conservan tejido dental y recuperan anatomía oclusal con precisión digital.',
        leadTime: '4 días',
        price: 'Cotización por caso',
        material: 'Resina cerámica / composite',
        indication: 'Restauraciones posteriores parciales',
        tags: ['Impresión 3D', 'Inlay/Onlay', 'Conservador'],
        image: `${IMG}/service-inlay-onlay-3d.jpg`,
    },
    {
        name: 'Coronas en Zirconia',
        code: 'CAD-CROWN',
        detail: 'Alta resistencia y estética funcional para restauraciones posteriores. Diseñadas digitalmente para asegurar un ajuste preciso y reducir el tiempo en sillón.',
        leadTime: '48 horas',
        price: 'Cotización por caso',
        material: 'Zirconia multicapa / monolítica',
        indication: 'Coronas unitarias posteriores y mixtas',
        tags: ['Zirconia', 'Alta Resistencia', 'CAD/CAM'],
        image: `${IMG}/service-zirconia-crown.jpg`,
    },
    {
        name: 'Carillas en Disilicato',
        code: 'E.MAX-VENEER',
        detail: 'Carillas altamente estéticas en disilicato de litio para el sector anterior. Naturalidad y traslucidez con flujo digital y previsualización del resultado.',
        leadTime: '48 horas',
        price: 'Desde evaluación estética',
        material: 'Disilicato de litio / IPS e.max',
        indication: 'Carillas anteriores',
        tags: ['Disilicato', 'Estética Premium'],
        image: `${IMG}/service-veneer-disilicate.jpg`,
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
        image: `${IMG}/service-zirconia-bridge.jpg`,
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
        image: `${IMG}/service-provisional-pmma.jpg`,
    },
];

export const workflow = [
    {
        id: 'recepcion',
        number: '01',
        title: 'Recepción del caso',
        text: 'Envías tu caso y revisamos que la información esté completa para iniciar. Si falta algún detalle que pueda afectar el resultado, te avisamos de inmediato.',
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
        text: 'Modelamos la propuesta digital en 3D considerando la anatomía de tu paciente, los espacios oclusales disponibles y los criterios clínicos que nos indiques.',
        benefit: 'Previsualizas la morfología final antes de enviar el diseño a la fresadora CAD/CAM.',
        icon: 'bi-bezier2',
        status: 'Diseño en proceso',
        tags: ['Exocad Expert', 'Oclusión digital'],
        image: `${IMG}/workflow-design-3d.jpg`,
        imageAlt: 'Diseño 3D y planificación digital de alta precisión en exocad',
        imagePosition: 'center',
    },
    {
        id: 'aprobacion',
        number: '03',
        title: 'Revisión y aprobación',
        text: 'Antes de fabricar, puedes revisar el diseño en 3D, dejar indicaciones o aprobarlo en línea. Tu decisión clínica queda registrada para asegurar la producción.',
        benefit: 'Tienes control total del resultado y evitas sorpresas o retoques en la prueba en boca.',
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
        text: 'Con el diseño aprobado, pasamos a fabricar la restauración con el material seleccionado. Cada etapa se controla para asegurar fidelidad con el modelo digital.',
        benefit: 'Garantizamos que la pieza final sea una copia fiel del diseño digital que aprobaste.',
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
        text: 'Coordinamos la entrega puntual del caso a tu clínica y guardamos el diseño digital en el historial para futuras referencias o duplicación inmediata de la pieza.',
        benefit: 'Cuentas con trazabilidad completa y un respaldo digital seguro de cada restauración.',
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

