import { defaultOgImagePath } from '../../config/siteSeo.js';

/** @typedef {{ path: string, title: string, description: string, ogImagePath?: string, h1: string, lead: string[], sections: { h2: string, p: string[] }[], faqs?: { question: string, answer: string }[], serviceJsonLd?: { name: string, description: string, path: string, serviceType?: string } }} SeoArticle */

/** @type {Record<string, SeoArticle>} */
export const SEO_ARTICLES = {
    '/coronas-cad-cam-arequipa': {
        path: '/coronas-cad-cam-arequipa',
        title: 'Coronas CAD/CAM en Arequipa',
        description:
            'Laboratorio dental digital en Arequipa para coronas CAD/CAM, zirconia y disilicato. Revisa el diseño 3D online y sigue tu pedido en tiempo real con AFINIX Dental Lab.',
        ogImagePath: defaultOgImagePath,
        h1: 'Coronas CAD/CAM en Arequipa para odontólogos y clínicas',
        lead: [
            'Las coronas CAD/CAM son restauraciones fijas fabricadas con flujo digital: del escaneo o archivo STL al diseño 3D, fresado y acabado, con registros por etapa que mejoran la comunicación clínica-laboratorio.',
            'En AFINIX Dental Lab trabajamos con odontólogos, clínicas y consultorios en Arequipa que buscan revisar el diseño antes de producir y dar seguimiento al caso sin depender solo de mensajes sueltos.',
        ],
        sections: [
            {
                h2: 'Qué son las coronas CAD/CAM',
                p: [
                    'Son coronas elaboradas con cadena digital CAD/CAM: se modela la anatomía en software, se valida el diseño con criterio clínico y luego se fresa en bloques cerámicos o similares según la indicación.',
                    'Este enfoque permite alinear expectativas entre lo que ves en pantalla y lo que se fabrica, y ayuda a reducir retrabajos cuando la aprobación 3D forma parte del flujo.',
                ],
            },
            {
                h2: 'Indicaciones frecuentes',
                p: [
                    'Casos unitarios y en serie que requieren restauración fija posterior o anterior según material, sustituciones de corona previa, integración en puentes cortos y rehabilitaciones donde el archivo digital está completo.',
                    'La elección de material (por ejemplo zirconia o disilicato) depende de carga, espacio y estética; lo definimos contigo según el plan clínico.',
                ],
            },
            {
                h2: 'Archivos que puedes enviar',
                p: [
                    'STL de escáner intraoral u otros formatos acordados (PLY/OBJ cuando aplique), radiografías o CBCT si el caso lo requiere, y notas clínicas con margen, contacto, color y referencias de oclusión.',
                    'Si el archivo llega incompleto, la validación del caso se detiene hasta completar datos: esto evita reprocesos y protege tu agenda.',
                ],
            },
            {
                h2: 'Aprobación 3D con Exocad Viewer',
                p: [
                    'Podrás revisar el diseño 3D mediante enlace de Exocad Viewer cuando corresponda al flujo del caso, dejando comentarios o aprobación registrada antes de avanzar a fresado.',
                    'Este paso facilita la aprobación clínica y deja trazabilidad del criterio aceptado en cada etapa.',
                ],
            },
            {
                h2: 'Materiales y tiempos referenciales',
                p: [
                    'Trabajamos coronas en zirconia, disilicato (E.max) u otros materiales según indicación y disponibilidad aprobada para el caso.',
                    'Los tiempos son referenciales según complejidad del caso, cola de producción y validaciones: te comunicamos ventanas estimadas al confirmar el pedido.',
                ],
            },
            {
                h2: 'Seguimiento del pedido',
                p: [
                    'Con acceso al portal puedes ver el estado del pedido, historial y aprobaciones en un solo lugar, lo que mejora la trazabilidad para tu equipo y para el paciente.',
                ],
            },
        ],
        faqs: [
            {
                question: '¿Qué archivos necesito enviar para una corona CAD/CAM?',
                answer: 'Lo habitual es STL del preparado (u otro formato acordado), indicaciones de margen y contacto, referencia de color y notas de oclusión. Si el plan lo requiere, también CBCT o documentación complementaria.',
            },
            {
                question: '¿Puedo aprobar el diseño antes de fresar?',
                answer: 'Sí. El flujo contempla revisión y aprobación del diseño 3D cuando aplica, incluyendo visualización con Exocad Viewer, para alinear el resultado antes de producción.',
            },
            {
                question: '¿Trabajan con STL de escáner intraoral?',
                answer: 'Sí. Recepcionamos archivos STL y validamos que el caso esté completo antes de avanzar a diseño y producción.',
            },
            {
                question: '¿Cuánto demora una corona de zirconia?',
                answer: 'Los plazos son referenciales según complejidad del caso, material y cola de laboratorio. Al registrar el pedido te indicamos una ventana estimada.',
            },
            {
                question: '¿Realizan delivery en Arequipa?',
                answer: 'Coordinamos entrega según disponibilidad operativa y la opción acordada por canal comercial; confirma detalle al enviar el caso.',
            },
            {
                question: '¿Puedo enviar casos desde otra ciudad del sur del Perú?',
                answer: 'Puedes coordinar envío digital del caso y logística de entrega según acuerdo comercial. Escríbenos por WhatsApp con el origen del caso para evaluar la mejor opción.',
            },
        ],
        serviceJsonLd: {
            name: 'Coronas CAD/CAM en Arequipa',
            description:
                'Laboratorio dental digital en Arequipa: coronas CAD/CAM con revisión 3D, zirconia y disilicato, seguimiento de pedido en línea.',
            path: '/coronas-cad-cam-arequipa',
            serviceType: 'Coronas dentales CAD/CAM',
        },
    },
    '/zirconia-dental-arequipa': {
        path: '/zirconia-dental-arequipa',
        title: 'Zirconia dental en Arequipa',
        description:
            'Coronas y puentes en zirconia con flujo digital en Arequipa. AFINIX Dental Lab: diseño revisable, producción CAD/CAM y seguimiento online.',
        h1: 'Zirconia dental en Arequipa con flujo CAD/CAM',
        lead: [
            'La zirconia combina resistencia y versatilidad estética en coronas y puentes. En laboratorio digital, el valor está en validar archivos, diseño y producción con el mismo hilo de trazabilidad.',
        ],
        sections: [
            {
                h2: 'Qué ofrecemos en zirconia',
                p: [
                    'Coronas y puentes con fresado CAD/CAM, control por etapas y comunicación clara antes de entregar la pieza.',
                    'Los tiempos son referenciales según complejidad del caso y el plan de material elegido.',
                ],
            },
        ],
        faqs: [
            {
                question: '¿Reciben STL para coronas de zirconia?',
                answer: 'Sí. Recibimos STL y validamos el caso antes de diseño y fresado.',
            },
        ],
        serviceJsonLd: {
            name: 'Zirconia dental en Arequipa',
            description: 'Coronas y puentes en zirconia con laboratorio dental digital y seguimiento online.',
            path: '/zirconia-dental-arequipa',
            serviceType: 'Zirconia dental',
        },
    },
    '/disilicato-emax-arequipa': {
        path: '/disilicato-emax-arequipa',
        title: 'Disilicato / E.max en Arequipa',
        description:
            'Restauraciones estéticas en disilicato (E.max) con diseño digital y revisión previa. Laboratorio AFINIX Dental Lab en Arequipa.',
        h1: 'Disilicato / E.max en Arequipa para zona estética',
        lead: [
            'El disilicato de litio es una opción habitual para anteriores cuando buscas translucidez y detalle. Nuestro flujo digital prioriza la revisión del diseño antes de fabricar.',
        ],
        sections: [
            {
                h2: 'Casos habituales',
                p: ['Carillas, coronas e incrustaciones anteriores con planificación CAD y aprobación cuando el caso lo requiere.'],
            },
        ],
        serviceJsonLd: {
            name: 'Disilicato / E.max en Arequipa',
            description: 'Restauraciones estéticas en disilicato con flujo digital y revisión 3D.',
            path: '/disilicato-emax-arequipa',
            serviceType: 'Disilicato dental',
        },
    },
    '/guias-quirurgicas-dentales-arequipa': {
        path: '/guias-quirurgicas-dentales-arequipa',
        title: 'Guías quirúrgicas dentales en Arequipa',
        description:
            'Guías quirúrgicas con planificación digital en Arequipa. CBCT, STL e implantes: flujo ordenado con AFINIX Dental Lab.',
        h1: 'Guías quirúrgicas dentales en Arequipa',
        lead: [
            'Las guías apoyan la cirugía guiada con planificación digital previa. Recibimos CBCT y archivos según el protocolo del caso para alinear el laboratorio con tu plan implantológico.',
        ],
        sections: [
            {
                h2: 'Flujo recomendado',
                p: [
                    'Validación de archivos, diseño y revisión, producción y control de calidad con tiempos referenciales según complejidad del caso.',
                ],
            },
        ],
        serviceJsonLd: {
            name: 'Guías quirúrgicas dentales en Arequipa',
            description: 'Planificación digital y fabricación de guías quirúrgicas para implantes.',
            path: '/guias-quirurgicas-dentales-arequipa',
            serviceType: 'Guía quirúrgica dental',
        },
    },
    '/protesis-sobre-implantes-arequipa': {
        path: '/protesis-sobre-implantes-arequipa',
        title: 'Prótesis sobre implantes en Arequipa',
        description:
            'Prótesis sobre implantes con flujo digital en Arequipa: estructuras, validación y seguimiento online con AFINIX Dental Lab.',
        h1: 'Prótesis sobre implantes en Arequipa',
        lead: [
            'Casos unitarios, múltiples e híbridos con enfoque CAD/CAM y comunicación por etapas. El objetivo es que diseño, pasividad y acabado se revisen con criterio antes de la entrega.',
        ],
        sections: [
            {
                h2: 'Documentación',
                p: ['Solicitamos archivos y registros alineados al plan de implantes para validar el caso antes de fabricar.'],
            },
        ],
        serviceJsonLd: {
            name: 'Prótesis sobre implantes en Arequipa',
            description: 'Rehabilitaciones sobre implantes con flujo digital y trazabilidad por etapa.',
            path: '/protesis-sobre-implantes-arequipa',
            serviceType: 'Prótesis sobre implantes',
        },
    },
    '/impresion-3d-dental-arequipa': {
        path: '/impresion-3d-dental-arequipa',
        title: 'Impresión 3D dental en Arequipa',
        description:
            'Impresión 3D dental y modelos desde archivos validados. Laboratorio digital AFINIX Dental Lab en Arequipa.',
        h1: 'Impresión 3D dental en Arequipa',
        lead: [
            'Impresión de modelos y auxiliares a partir de STL u otros formatos acordados, con validación previa para evitar reprocesos.',
        ],
        sections: [
            {
                h2: 'Casos de uso',
                p: ['Modelos de trabajo, auxiliares de diagnóstico y piezas de apoyo según indicación y material disponible para el caso.'],
            },
        ],
        serviceJsonLd: {
            name: 'Impresión 3D dental en Arequipa',
            description: 'Impresión 3D dental con validación de archivos y comunicación por etapas.',
            path: '/impresion-3d-dental-arequipa',
            serviceType: 'Impresión 3D dental',
        },
    },
    '/flujo-digital': {
        path: '/flujo-digital',
        title: 'Flujo digital clínica-laboratorio',
        description:
            'Flujo digital AFINIX Dental Lab: recepción STL/CBCT, diseño 3D, aprobación online, producción CAD/CAM y entrega trazable en Arequipa.',
        h1: 'Flujo digital de laboratorio dental en Arequipa',
        lead: [
            'Así conectamos tu criterio clínico con producción: recepción STL/CBCT, diseño 3D, aprobación online, producción CAD/CAM y entrega trazable, con seguimiento en portal.',
        ],
        sections: [
            {
                h2: 'Vista rápida del proceso',
                p: [
                    'Puedes ver el detalle animado en la página principal, sección Flujo digital. Los textos resumen cada etapa para odontólogos y equipos administrativos.',
                ],
            },
        ],
    },
    '/para-clinicas': {
        path: '/para-clinicas',
        title: 'Laboratorio dental para clínicas en Arequipa',
        description:
            'Laboratorio dental digital para clínicas y consultorios en Arequipa: CAD/CAM, aprobación 3D y seguimiento de pedidos con AFINIX Dental Lab.',
        h1: 'Laboratorio dental digital para clínicas y consultorios',
        lead: [
            'Apoyamos a clínicas que necesitan menos fricción administrativa: un canal para archivos, aprobaciones y estado del pedido, con foco en coronas CAD/CAM y rehabilitaciones digitales.',
        ],
        sections: [
            {
                h2: 'Qué gana tu equipo',
                p: [
                    'Mayor trazabilidad, comunicación clínica-laboratorio más clara y revisión del diseño antes de fresar cuando el protocolo del caso lo permite.',
                ],
            },
        ],
    },
    '/contacto': {
        path: '/contacto',
        title: 'Contacto',
        description:
            'Contacta a AFINIX Dental Lab en Arequipa por WhatsApp o entra al portal para seguimiento de pedidos y aprobación 3D.',
        h1: 'Contacto AFINIX Dental Lab',
        lead: [
            'Escríbenos por WhatsApp para enviar o cotizar un caso dental digital. Si ya tienes acceso, entra al portal para ver tus pedidos.',
        ],
        sections: [
            {
                h2: 'Canales',
                p: [
                    'WhatsApp comercial con mensaje prellenado, ubicación en Google Maps cuando configures el enlace en el sitio, y acceso al portal para clientes registrados.',
                ],
            },
            {
                h2: 'Privacidad',
                p: [
                    'La política de privacidad del sitio está disponible desde el enlace “Privacidad” en el pie de página o en la ruta /politica-de-privacidad.',
                ],
            },
        ],
        faqs: [
            {
                question: '¿Cómo empiezo un caso nuevo?',
                answer: 'Usa WhatsApp con el mensaje sugerido o solicita acceso al portal si tu clínica aún no tiene usuario.',
            },
        ],
    },
    '/politica-de-privacidad': {
        path: '/politica-de-privacidad',
        title: 'Política de privacidad',
        description:
            'Política de privacidad de AFINIX Dental Lab: tratamiento de datos personales, finalidades y derechos del titular en el marco aplicable en Perú.',
        h1: 'Política de privacidad',
        lead: [
            'AFINIX Dental Lab (en adelante, “AFINIX”) pone a disposición esta política para explicar de forma clara cómo puede tratarse la información que nos proporcionas al usar la web comercial, solicitar información o operar el portal de seguimiento de pedidos.',
            'Si necesitas el texto adaptado a un tratamiento específico (por ejemplo, consentimientos adicionales en contrato con tu clínica), conviene revisarlo con asesoría legal.',
        ],
        sections: [
            {
                h2: 'Responsable del tratamiento',
                p: [
                    'El responsable del tratamiento de los datos personales asociados a este sitio y al portal es AFINIX Dental Lab, con operación en Arequipa, Perú. Los datos de contacto comercial aparecen en la página de contacto y en los canales configurados en la web.',
                ],
            },
            {
                h2: 'Datos que podemos tratar',
                p: [
                    'Datos identificativos y de contacto (nombre, correo, teléfono, clínica), datos profesionales necesarios para cotizar o ejecutar servicios de laboratorio, archivos clínicos digitales que envíes de forma voluntaria (por ejemplo STL, CBCT u otros formatos acordados), datos de navegación técnicos (dirección IP, tipo de dispositivo, cookies necesarias para el funcionamiento y analítica si la activas) y registros de comunicación entre tú y AFINIX.',
                ],
            },
            {
                h2: 'Finalidades',
                p: [
                    'Gestionar solicitudes comerciales y operativas, coordinar casos dentales, permitir el acceso al portal y el seguimiento de pedidos, mejorar la comunicación clínica-laboratorio, cumplir obligaciones legales y resolver incidencias de seguridad.',
                ],
            },
            {
                h2: 'Base legitimadora',
                p: [
                    'Ejecución de medidas precontractuales o contractuales cuando corresponda, consentimiento cuando lo solicitemos de forma expresa, interés legítimo en la seguridad del servicio y el cumplimiento de obligaciones legales aplicables en Perú.',
                ],
            },
            {
                h2: 'Conservación',
                p: [
                    'Conservamos la información el tiempo necesario para las finalidades indicadas y según los plazos legales o contractuales que apliquen al servicio de laboratorio y a la relación con tu clínica.',
                ],
            },
            {
                h2: 'Derechos del titular',
                p: [
                    'Puedes solicitar acceso, rectificación, cancelación u oposición según corresponda, y otros derechos previstos en la normativa peruana sobre protección de datos personales. Para ejercerlos, utiliza los canales de contacto indicados en la web o, si está configurado, el correo de privacidad mostrado en esta página.',
                ],
            },
            {
                h2: 'Seguridad y transferencias',
                p: [
                    'Aplicamos medidas técnicas y organizativas razonables para proteger la información. Si existiera transferencia internacional (por ejemplo, proveedores de nube o software), se realizará conforme a la normativa aplicable y, cuando proceda, con las garantías adecuadas.',
                ],
            },
            {
                h2: 'Cambios',
                p: [
                    'Podemos actualizar esta política para reflejar cambios legales o del servicio. La versión vigente estará publicada en esta URL con la fecha de actualización que corresponda en el pie o en el encabezado del documento cuando lo habilites en tu proceso editorial.',
                ],
            },
        ],
    },
};

export function getSeoArticle(path) {
    return SEO_ARTICLES[path] || null;
}

export const SEO_ARTICLE_PATHS = Object.keys(SEO_ARTICLES);
