import { mapsHref, phoneCallHref, socialProfiles, whatsappHref } from '../../config/siteSeo.js';

const IMG = '/images/afinix-landing';

export const heroSlides = [
    {
        kicker: 'Arequipa, Perú · laboratorio dental digital para odontólogos',
        titleBefore: 'Trabaja tus casos dentales con ',
        titleHighlight: 'más control, claridad y confianza',
        titleAfter: '.',
        copy: 'En AFINIX Dental Lab ayudamos a odontólogos y clínicas de Arequipa a trabajar con mayor control, comunicación clara y seguimiento de sus casos. Coronas CAD/CAM, zirconia, disilicato y aprobación digital antes de producir.',
        ctaMain: 'Enviar mi primer caso',
        ctaSecondary: 'Conocer nuestro flujo',
        image: `${IMG}/hero-precision.jpg`,
        alt: 'Laboratorio dental digital en Arequipa con enfoque en control clínico',
        floatCards: [
            { icon: 'bi-check2-circle', label: 'Revisión digital', value: 'Antes de producir' },
            { icon: 'bi-broadcast', label: 'Seguimiento', value: 'De cada caso' },
            { icon: 'bi-chat-left-text', label: 'Comunicación', value: 'Clara y directa' },
        ],
    },
    {
        kicker: 'Menos mensajes sueltos · más orden en cada caso',
        titleBefore: 'Que tu laboratorio ',
        titleHighlight: 'no sea una preocupación más',
        titleAfter: ' en tu agenda.',
        copy: 'Sabemos que detrás de cada corona, puente o guía quirúrgica hay un paciente esperando, una cita programada y tu reputación clínica en juego. Por eso trabajamos con un flujo visible, comentarios registrados y aprobación previa.',
        ctaMain: 'Quiero trabajar con AFINIX',
        ctaSecondary: 'Ver servicios',
        image: `${IMG}/hero-production.jpg`,
        alt: 'Flujo de trabajo dental ordenado y trazable',
        floatCards: [
            { icon: 'bi-person-check', label: 'Aprobación', value: 'Online 100%' },
            { icon: 'bi-clock-history', label: 'Historial', value: 'De cada caso' },
            { icon: 'bi-activity', label: 'Estado', value: 'Actualizado' },
        ],
    },
    {
        kicker: 'AFINIX Link · seguimiento digital de pedidos',
        titleBefore: 'Sigue tus casos en tiempo real y ',
        titleHighlight: 'aprueba el diseño antes de fabricar',
        titleAfter: '.',
        copy: 'Con AFINIX puedes revisar el diseño 3D, dejar observaciones y conocer el avance de tu trabajo sin depender de mensajes dispersos. Un flujo pensado para que tú y tu equipo sepan qué está pasando en cada etapa.',
        ctaMain: 'Solicitar acceso a AFINIX Link',
        ctaSecondary: 'Consultar servicios',
        image: `${IMG}/hero-equipment.jpg`,
        alt: 'Seguimiento digital de pedidos dentales en Arequipa',
        floatCards: [
            { icon: 'bi-bezier2', label: 'Diseño 3D', value: 'Revisable' },
            { icon: 'bi-layers', label: 'Pedido', value: 'Trazable' },
            { icon: 'bi-cpu', label: 'Producción', value: 'Bajo aprobación' },
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

