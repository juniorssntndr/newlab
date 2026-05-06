/**
 * Crea 4 Google Forms balanceados para estudio de mercado dental presencial.
 *
 * Instrucciones:
 * 1. Abrir https://script.google.com/
 * 2. Crear un proyecto nuevo.
 * 3. Pegar este archivo completo.
 * 4. Ejecutar crearFormulariosEstudioMercadoDental().
 * 5. Autorizar permisos.
 * 6. Revisar el log: Ver > Registros de ejecución.
 */

const FORMULARIOS_ESTUDIO_MERCADO_DENTAL = [
  {
    titulo: 'Formulario A - Estudio mercado dental: Flujo digital y confianza',
    descripcion:
      'Entrevista presencial de 5-7 minutos. Objetivo: validar flujo digital, frecuencia de uso, logística, satisfacción técnica y valor de seguimiento.',
    preguntas: [
      {
        titulo: 'Zona o distrito donde se realiza la entrevista',
        tipo: 'texto',
        obligatoria: true,
      },
      {
        titulo: '¿Cuenta actualmente con escáner intraoral en su clínica?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Sí, lo uso para la mayoría de casos',
          'Sí, pero solo para casos específicos',
          'No, pero planeo adquirir uno pronto',
          'No, prefiero trabajar con impresiones tradicionales',
        ],
      },
      {
        titulo: '¿Con qué frecuencia requiere servicios de laboratorio dental?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Diariamente',
          'Varias veces por semana',
          'Una vez por semana',
          'Algunas veces al mes',
          'Solo en casos puntuales',
        ],
      },
      {
        titulo:
          'Si un laboratorio ofrece recojo y entrega gratuita en todo Arequipa, ¿estaría dispuesto a probarlo aunque no esté en su distrito?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Definitivamente sí',
          'Lo consideraría si la calidad es alta',
          'Me genera dudas por la seguridad de los modelos',
          'Prefiero trabajar solo con laboratorios cercanos',
        ],
      },
      {
        titulo: 'En prótesis fija, ¿con qué material trabaja con mayor frecuencia?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Zirconia',
          'Disilicato de litio',
          'Metal-cerámica tradicional',
          'Resinas compuestas',
          'Otro',
        ],
      },
      {
        titulo:
          'Del 1 al 5, ¿qué tan satisfecho está con el ajuste marginal y la oclusión de su laboratorio actual?',
        tipo: 'escala',
        obligatoria: true,
        min: 1,
        max: 5,
        minLabel: 'Muy insatisfecho',
        maxLabel: 'Muy satisfecho',
      },
      {
        titulo: '¿Le resultaría valioso rastrear el estado de su orden desde el celular?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Sí, me daría tranquilidad',
          'Sería interesante, pero no determinante',
          'No lo considero necesario',
        ],
      },
      {
        titulo: '¿Qué problema de su flujo actual con laboratorios le gustaría resolver primero?',
        tipo: 'parrafo',
        obligatoria: false,
      },
    ],
  },
  {
    titulo: 'Formulario B - Estudio mercado dental: Operación y cambio de proveedor',
    descripcion:
      'Entrevista presencial de 5-7 minutos. Objetivo: entender tipo de consultorio, canal de envío, trabajos frecuentes, tiempos y motivos de cambio.',
    preguntas: [
      {
        titulo: 'Zona o distrito donde se realiza la entrevista',
        tipo: 'texto',
        obligatoria: true,
      },
      {
        titulo: '¿Qué tipo de atención realiza con mayor frecuencia en su consultorio?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Odontología general',
          'Rehabilitación oral',
          'Estética dental',
          'Implantología',
          'Ortodoncia',
          'Atención mixta',
        ],
      },
      {
        titulo: '¿Cómo prefiere enviar sus casos al laboratorio?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Escáner intraoral',
          'Impresiones físicas',
          'Ambas opciones según el caso',
          'Aún no tengo preferencia definida',
        ],
      },
      {
        titulo: '¿Cuál es el principal problema logístico que enfrenta hoy?',
        tipo: 'lista',
        obligatoria: true,
        opciones: [
          'Retrasos en la entrega',
          'Daños en modelos o impresiones durante transporte',
          'Falta de comunicación con mensajero',
          'Costos de envío elevados',
          'Ninguno relevante',
        ],
      },
      {
        titulo: '¿Cuáles son los trabajos que más encarga actualmente? Seleccione máximo 3.',
        tipo: 'casillas',
        obligatoria: true,
        opciones: [
          'Coronas y puentes',
          'Carillas estéticas',
          'Incrustaciones inlay/onlay',
          'Prótesis sobre implantes',
          'Modelos de estudio',
          'Alineadores invisibles',
          'Prótesis removible',
        ],
      },
      {
        titulo:
          '¿Cuál es el tiempo promedio de entrega de su laboratorio actual para una corona de zirconia?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          '24 a 48 horas',
          '3 a 5 días hábiles',
          'Más de una semana',
          'No trabajo zirconia actualmente',
        ],
      },
      {
        titulo: '¿Qué lo motivaría más a cambiar de laboratorio dental?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Mejores tiempos de entrega',
          'Mayor precisión técnica',
          'Precios más competitivos',
          'Mejor comunicación y asesoría técnica',
          'Mayor variedad de materiales',
        ],
      },
      {
        titulo: '¿Cuál es el problema técnico más repetido que ha tenido con trabajos de laboratorio?',
        tipo: 'parrafo',
        obligatoria: false,
      },
    ],
  },
  {
    titulo: 'Formulario C - Estudio mercado dental: Especialidad, volumen y precio',
    descripcion:
      'Entrevista presencial de 5-7 minutos. Objetivo: estimar volumen, especialidad, barreras de cercanía, brechas de oferta y referencias de precio.',
    preguntas: [
      {
        titulo: 'Zona o distrito donde se realiza la entrevista',
        tipo: 'texto',
        obligatoria: true,
      },
      {
        titulo: '¿Cuál describe mejor su enfoque clínico principal?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'General integral',
          'Rehabilitación y prótesis',
          'Estética dental',
          'Cirugía e implantes',
          'Ortodoncia',
          'Odontopediatría',
          'Otro',
        ],
      },
      {
        titulo: 'En un mes promedio, ¿cuántos casos envía a laboratorio?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          '1 a 5 casos',
          '6 a 10 casos',
          '11 a 20 casos',
          'Más de 20 casos',
          'Varía demasiado según temporada',
        ],
      },
      {
        titulo: '¿Qué tan importante es para usted la cercanía física del laboratorio dental?',
        tipo: 'escala',
        obligatoria: true,
        min: 1,
        max: 5,
        minLabel: 'Nada importante',
        maxLabel: 'Crítico',
      },
      {
        titulo:
          '¿Cuál es el material o servicio que más le cuesta conseguir con buena calidad en Arequipa?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Zirconia estética',
          'Disilicato de litio',
          'Guías quirúrgicas',
          'Prótesis sobre implantes',
          'Prótesis totales o híbridas',
          'Modelos impresos 3D',
          'Ninguno en particular',
        ],
      },
      {
        titulo:
          '¿Cuál es el rango de precio promedio que paga por una corona de zirconia solo laboratorio?',
        tipo: 'lista',
        obligatoria: true,
        opciones: [
          'Menos de S/ 130',
          'Entre S/ 130 y S/ 160',
          'Entre S/ 160 y S/ 190',
          'Más de S/ 200',
          'No trabajo zirconia',
        ],
      },
      {
        titulo:
          '¿Qué tan interesado está en implementar prótesis totales digitales o híbridas en su consulta?',
        tipo: 'escala',
        obligatoria: true,
        min: 1,
        max: 5,
        minLabel: 'Nada interesado',
        maxLabel: 'Muy interesado',
      },
      {
        titulo: '¿Cuál ha sido su peor experiencia reciente trabajando con un laboratorio dental?',
        tipo: 'parrafo',
        obligatoria: false,
      },
    ],
  },
  {
    titulo: 'Formulario D - Estudio mercado dental: Innovación y valor añadido',
    descripcion:
      'Entrevista presencial de 5-7 minutos. Objetivo: validar adopción tecnológica, confianza logística, servicios innovadores y disposición a resolver dolores.',
    preguntas: [
      {
        titulo: 'Zona o distrito donde se realiza la entrevista',
        tipo: 'texto',
        obligatoria: true,
      },
      {
        titulo: '¿Qué tan digitalizado considera hoy su flujo clínico-laboratorio?',
        tipo: 'escala',
        obligatoria: true,
        min: 1,
        max: 5,
        minLabel: 'Totalmente tradicional',
        maxLabel: 'Muy digitalizado',
      },
      {
        titulo:
          'Si el laboratorio recoge y entrega casos en su clínica, ¿qué factor le daría más confianza?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Puntualidad comprobable',
          'Empaque seguro para modelos o impresiones',
          'Comunicación por WhatsApp en cada etapa',
          'Responsable fijo de recojo y entrega',
          'Garantía ante daños o retrasos',
        ],
      },
      {
        titulo: '¿Qué servicios de mayor valor le gustaría que su laboratorio ofreciera?',
        tipo: 'casillas',
        obligatoria: true,
        opciones: [
          'Guías quirúrgicas impresas 3D',
          'Modelos de estudio impresos 3D',
          'PPR digitales en PEEK o metal impreso',
          'Sistemas PIC para implantes múltiples',
          'Caracterización estética personalizada',
          'Diseño digital revisable antes de fabricar',
        ],
      },
      {
        titulo:
          'Del 1 al 10, ¿qué tan satisfecho está con la comunicación técnica de su laboratorio actual?',
        tipo: 'escala',
        obligatoria: true,
        min: 1,
        max: 10,
        minLabel: 'Muy mala',
        maxLabel: 'Excelente',
      },
      {
        titulo: 'Si dos laboratorios tienen calidad similar, ¿qué factor pesaría más en su decisión?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Precio',
          'Tiempo de entrega',
          'Comunicación y seguimiento',
          'Garantía o repetición sin conflicto',
          'Tecnología y precisión digital',
        ],
      },
      {
        titulo: '¿Cómo preferiría validar diseños de casos de alta estética antes de fabricación?',
        tipo: 'opcion_multiple',
        obligatoria: true,
        opciones: [
          'Confío en el criterio del técnico',
          'Capturas por WhatsApp',
          'Videollamada breve',
          'Enlace para revisar modelo 3D',
          'Prefiero validarlo solo al recibir el trabajo',
        ],
      },
      {
        titulo: 'Si pudiera pagar por resolver un solo problema de laboratorio, ¿cuál sería?',
        tipo: 'parrafo',
        obligatoria: false,
      },
    ],
  },
];

function crearFormulariosEstudioMercadoDental() {
  const spreadsheet = SpreadsheetApp.create('Respuestas - Estudio mercado dental Arequipa');

  FORMULARIOS_ESTUDIO_MERCADO_DENTAL.forEach(function (config) {
    const form = FormApp.create(config.titulo);
    form.setDescription(config.descripcion);
    form.setCollectEmail(false);
    form.setAllowResponseEdits(false);
    form.setShowLinkToRespondAgain(false);
    form.setConfirmationMessage('Gracias. Respuesta registrada.');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());

    config.preguntas.forEach(function (pregunta) {
      agregarPregunta(form, pregunta);
    });

    Logger.log('Formulario creado: ' + config.titulo);
    Logger.log('URL editable: ' + form.getEditUrl());
    Logger.log('URL para responder: ' + form.getPublishedUrl());
  });

  Logger.log('Google Sheets de respuestas: ' + spreadsheet.getUrl());
}

function agregarPregunta(form, pregunta) {
  let item;

  if (pregunta.tipo === 'texto') {
    item = form.addTextItem();
  } else if (pregunta.tipo === 'parrafo') {
    item = form.addParagraphTextItem();
  } else if (pregunta.tipo === 'opcion_multiple') {
    item = form.addMultipleChoiceItem();
    item.setChoiceValues(pregunta.opciones);
  } else if (pregunta.tipo === 'casillas') {
    item = form.addCheckboxItem();
    item.setChoiceValues(pregunta.opciones);
  } else if (pregunta.tipo === 'lista') {
    item = form.addListItem();
    item.setChoiceValues(pregunta.opciones);
  } else if (pregunta.tipo === 'escala') {
    item = form.addScaleItem();
    item.setBounds(pregunta.min, pregunta.max);
    item.setLabels(pregunta.minLabel, pregunta.maxLabel);
  } else {
    throw new Error('Tipo de pregunta no soportado: ' + pregunta.tipo);
  }

  item.setTitle(pregunta.titulo);
  item.setRequired(Boolean(pregunta.obligatoria));
}
