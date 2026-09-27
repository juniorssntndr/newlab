import React, { useState } from 'react';

export const FAQ_ITEMS = [
    {
        q: '¿Cómo accedo al 50% de descuento en mi primer caso?',
        a: 'Es muy sencillo: hacé clic en cualquiera de nuestros botones de WhatsApp y envianos los datos de tu clínica junto con el archivo STL o la orden de trabajo. Tu primer caso técnico se facturará automáticamente con 50% de descuento para que compruebes nuestra precisión sin riesgo financiero.'
    },
    {
        q: '¿Qué formato de archivo digital necesitan para trabajar?',
        a: 'Aceptamos archivos estándar abiertos en formato STL, PLY (con color) u OBJ exportados desde cualquier escáner intraoral del mercado: Medit, 3Shape Trios, iTero, Shining 3D, Carestream, Panda o Alliedstar.'
    },
    {
        q: '¿Puedo enviar impresiones físicas si aún no cuento con escáner intraoral?',
        a: '¡Por supuesto! Recibimos impresiones en silicona o modelos de yeso vaciados. Contamos con servicio de recojo motorizado en clínicas de Arequipa y digitalizamos tus modelos con nuestro escáner de mesa de alta resolución.'
    },
    {
        q: '¿Cuánto tardan las entregas y cómo es la logística en Arequipa?',
        a: 'Nuestros tiempos estándar son desde 48 horas hábiles para coronas impresas 3D, carillas, guías quirúrgicas y coronas unitarias de zirconia. Puentes extensos toman 72 horas. Despachamos directamente a tu consultorio en empaque hermético desinfectado.'
    },
    {
        q: '¿Cómo funciona la aprobación digital 3D antes de fresar?',
        a: 'Una vez diseñado el caso en exocad, te compartimos un enlace interactivo 3D. Podés rotar la preparación, ver los puntos de contacto oclusales, espesores y perfiles desde tu teléfono celular. Dejás tus indicaciones y aprobás con un solo toque.'
    },
    {
        q: '¿Emiten comprobante de pago electrónico con valor fiscal (SUNAT)?',
        a: 'Sí, AFINIX DENTAL LAB S.A.C. emite Factura Electrónica (Serie F001) para personas jurídicas y odontólogos con RUC que deducen gastos, así como Boletas de Venta (Serie B001), 100% integradas a SUNAT.'
    }
];

export const FaqV2 = () => {
    const [openIndex, setOpenIndex] = useState(0);

    const toggle = (idx) => {
        setOpenIndex(openIndex === idx ? null : idx);
    };

    return (
        <section className="afinix-v2-section afinix-v2-faq" id="faq">
            <div className="afinix-v2-container">
                <div className="afinix-v2-section-head">
                    <span className="afinix-v2-kicker">
                        <i className="bi bi-question-circle-fill" aria-hidden="true"></i>
                        Preguntas Frecuentes
                    </span>
                    <h2 className="afinix-v2-section-title">
                        Respuestas claras para tu práctica odontológica
                    </h2>
                    <p className="afinix-v2-section-sub">
                        Todo lo que necesitás saber sobre compatibilidad de escáneres, logística en Arequipa, garantía de ajuste y modalidades de trabajo.
                    </p>
                </div>

                <div className="afinix-v2-faq-stack">
                    {FAQ_ITEMS.map((item, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div className="afinix-v2-faq-item" key={item.q}>
                                <button
                                    type="button"
                                    className="afinix-v2-faq-question"
                                    onClick={() => toggle(idx)}
                                    aria-expanded={isOpen}
                                >
                                    <span>{item.q}</span>
                                    <i className="bi bi-chevron-down" aria-hidden="true"></i>
                                </button>
                                {isOpen && (
                                    <div className="afinix-v2-faq-answer">
                                        <p style={{ margin: 0 }}>{item.a}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
