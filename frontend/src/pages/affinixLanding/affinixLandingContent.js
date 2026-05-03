const IMG = '/images/affinix-landing';

export const heroSlides = [
    {
        kicker: 'CAD/CAM de alta precisión',
        titleBefore: 'Restauraciones ',
        titleHighlight: 'digitales',
        titleAfter: ' con control total.',
        copy: 'Tu STL se revisa antes de fresar: trazabilidad en cada etapa y entregas previsibles para programar al paciente con seguridad.',
        image: `${IMG}/hero-precision.jpg`,
        alt: 'Fresado CAD CAM de restauraciones dentales en bloque cerámico',
        floatCards: [
            { icon: 'bi-bullseye', label: 'Precisión', value: 'CAD/CAM 5 ejes' },
            { icon: 'bi-layers', label: 'Materiales', value: 'Certificados' },
            { icon: 'bi-clock-history', label: 'Entrega', value: '48 - 72 h' },
        ],
    },
    {
        kicker: 'Producción visible',
        titleBefore: 'Tu clínica ve cada pedido ',
        titleHighlight: 'en tiempo real',
        titleAfter: '.',
        copy: 'Estado, historial y aprobaciones en un solo lugar: tu equipo gana tiempo y el paciente ve un servicio ordenado.',
        image: `${IMG}/hero-production.jpg`,
        alt: 'Fresadora dental trabajando con refrigeración y piezas en producción',
        floatCards: [
            { icon: 'bi-activity', label: 'Trazabilidad', value: 'Por etapa' },
            { icon: 'bi-shield-check', label: 'Historial', value: 'Auditado' },
            { icon: 'bi-broadcast', label: 'Seguimiento', value: '24/7' },
        ],
    },
    {
        kicker: 'Diseño 3D y aprobación',
        titleBefore: 'Aprueba en línea y evita ',
        titleHighlight: 'retrabajos',
        titleAfter: ' antes de fresar.',
        copy: 'Revisas el 3D con el laboratorio en el mismo flujo: menos idas y venidas y menos sorpresas en boca.',
        image: `${IMG}/hero-equipment.jpg`,
        alt: 'Equipo de fresado de cinco ejes para estructuras dentales',
        floatCards: [
            { icon: 'bi-bezier2', label: 'Diseño 3D', value: 'Revisión clínica' },
            { icon: 'bi-check2-circle', label: 'Aprobación', value: 'En línea' },
            { icon: 'bi-cpu', label: 'Producción', value: '5 ejes' },
        ],
    },
];

/** Pasos demo para el widget de seguimiento flotante (hero). */
export const heroTrackingSteps = [
    { id: '1', label: 'Pedido realizado' },
    { id: '2', label: 'Diseño aprobado' },
    { id: '3', label: 'Producción CAD/CAM' },
    { id: '4', label: 'Entrega delivery' },
];

export const services = [
    {
        name: 'Zirconia',
        code: 'ZIR-MONO',
        detail: 'Más durabilidad y estética en posteriores: menos sustituciones y más tranquilidad para tu paciente.',
        leadTime: '48 - 72 h',
        price: 'Desde cotización por caso',
        material: 'Zirconia multicapa',
        indication: 'Coronas y puentes posteriores',
        tags: ['Monolítica', 'Multicapa'],
        image: `${IMG}/service-zirconia-real.jpg`,
    },
    {
        name: 'Disilicato / e.max',
        code: 'E.MAX-CAD',
        detail: 'Sonrisa natural en zona estética: integración con el diente y resultados que refuerzan tu criterio clínico.',
        leadTime: '72 h',
        price: 'Desde evaluación estética',
        material: 'Disilicato de litio',
        indication: 'Carillas, incrustaciones y coronas',
        tags: ['Anterior', 'Translúcido'],
        image: `${IMG}/service-cad-real.jpg`,
    },
    {
        name: 'Guías quirúrgicas',
        code: 'SURG-GUIDE',
        detail: 'Cirugía más predecible: menos improvisación en quirófano y mejor encaje con tu plan de implante.',
        leadTime: '3 - 5 días',
        price: 'A consultar',
        material: 'Resina biocompatible',
        indication: 'Implantes guiados',
        tags: ['CBCT', 'Implantes'],
        image: `${IMG}/service-provisional-real.jpg`,
    },
    {
        name: 'Prótesis híbridas',
        code: 'HYB-CAM',
        detail: 'Pasividad y encaje en rehabilitaciones grandes: menos ajustes en cita y menos estrés para el equipo.',
        leadTime: '5 - 7 días',
        price: 'Según estructura',
        material: 'PMMA, CoCr o zirconia',
        indication: 'Rehabilitación sobre implantes',
        tags: ['Estructura', 'Pasivo'],
        image: `${IMG}/service-hybrid-real.jpg`,
    },
    {
        name: 'Coronas y puentes',
        code: 'CROWN-BRIDGE',
        detail: 'Márgenes y contactos bajo control en serie: agendas más fluidas y menos remakes por ajuste.',
        leadTime: '48 - 96 h',
        price: 'Desde tarifa de laboratorio',
        material: 'Zirconia, PMMA, metal cerámica',
        indication: 'Casos unitarios y múltiples',
        tags: ['Seriado', 'Marginal'],
        image: `${IMG}/service-implant-real.jpg`,
    },
    {
        name: 'Diseño digital 3D',
        code: 'CAD-REVIEW',
        detail: 'Diseño listo para que lo apruebes online: alineas criterio clínico y producción antes de comprometer fresado.',
        leadTime: '24 - 48 h',
        price: 'A consultar',
        material: 'Archivo STL / CAD',
        indication: 'Planificación y aprobación online',
        tags: ['STL', 'Aprobación'],
        image: `${IMG}/equipment-milling.jpg`,
    },
];

export const workflow = [
    {
        id: 'recepcion',
        number: '01',
        title: 'Recepción STL/CBCT',
        text: 'Tu caso entra con STL o CBCT y sabes de inmediato si el archivo está listo para avanzar, sin perder citas por datos incompletos.',
        icon: 'bi-cloud-arrow-up',
        status: 'Caso recibido',
        tags: ['caso_123.stl', 'scan_cbct.dcm'],
    },
    {
        id: 'diseno',
        number: '02',
        title: 'Diseño 3D',
        text: 'Recibes el diseño 3D listo para valorar anatomía, contactos y emergencia antes de que se fresque nada.',
        icon: 'bi-bezier2',
        status: 'Diseño preparado',
        tags: ['Anatomía', 'Contactos', '65% listo'],
    },
    {
        id: 'aprobacion',
        number: '03',
        title: 'Aprobación online',
        text: 'Apruebas o comentas el diseño en línea: tu criterio queda registrado y el laboratorio avanza solo con tu visto bueno.',
        icon: 'bi-person-check',
        status: 'Esperando aprobación',
        tags: ['Vista 3D', 'Comentarios', 'Validación remota'],
    },
    {
        id: 'produccion',
        number: '04',
        title: 'Producción CAD/CAM',
        text: 'Tras tu aprobación, CAD/CAM y control por etapa para que lo que llega a boca coincida con lo que validaste en pantalla.',
        icon: 'bi-cpu',
        status: 'En producción',
        tags: ['Fresado', 'Acabado', 'QC'],
    },
    {
        id: 'entrega',
        number: '05',
        title: 'Entrega trazable',
        text: 'Coordinas la entrega con trazabilidad y conservas el historial del pedido para auditorías, garantías o revisiones futuras.',
        icon: 'bi-box-seam',
        status: 'Listo para entregar',
        tags: ['Tracking', 'Historial', 'Despacho'],
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
        value: '5 ejes',
        text: 'Geometrías exigentes y estructuras extensas con encaje más fiel a lo que planificaste en software.',
    },
    {
        value: 'STL + CBCT',
        text: 'Tu flujo digital entra validado: menos reprocesos y menos reprogramación por archivos mal enviados.',
    },
    {
        value: 'QC',
        text: 'Cada etapa revisa ajuste, anatomía y contacto para que en silla ganes tiempo, no disculpas.',
    },
];

export const aboutGallery = [
    {
        src: `${IMG}/service-hybrid-real.jpg`,
        alt: 'Prótesis híbrida dental sobre modelo',
    },
    {
        src: `${IMG}/service-zirconia-real.jpg`,
        alt: 'Coronas dentales terminadas',
    },
    {
        src: `${IMG}/equipment-milling.jpg`,
        alt: 'Equipo de fresado dental en funcionamiento',
    },
];

export const mobileQuickLinks = [
    { href: '#servicios', label: 'Servicios' },
    { href: '#flujo', label: 'Flujo' },
];

/** Canales comerciales: WhatsApp + ubicación. */
export const contactChannels = [
    {
        label: 'WhatsApp',
        href: 'https://wa.me/?text=Hola%2C%20quiero%20coordinar%20un%20caso%20dental%20digital%20con%20Affinix%20LAB.',
        icon: 'bi-whatsapp',
        external: true,
    },
    {
        label: 'Ver ubicación',
        href: 'https://maps.google.com/?q=Affinix+LAB',
        icon: 'bi-geo-alt',
        external: true,
    },
];

/** Redes sociales. */
export const socialLinks = [
    {
        label: 'Instagram',
        href: 'https://instagram.com/affinixlab',
        icon: 'bi-instagram',
        external: true,
    },
    {
        label: 'Facebook',
        href: 'https://facebook.com/affinixlab',
        icon: 'bi-facebook',
        external: true,
    },
    {
        label: 'TikTok',
        href: 'https://tiktok.com/@affinixlab',
        icon: 'bi-tiktok',
        external: true,
    },
];

export const landingMetrics = [
    { value: '48-72 h', label: 'Ventana típica para planificar tu agenda', icon: 'bi-clock' },
    { value: '24/7', label: 'Tu equipo consulta estado cuando lo necesita', icon: 'bi-broadcast-pin' },
    { value: '5 ejes', label: 'CAD/CAM alineado a casos complejos', icon: 'bi-gear' },
    { value: '99.2%', label: 'Casos que llegan en la fecha acordada', icon: 'bi-shield-check' },
];
