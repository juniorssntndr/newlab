import React from 'react';

export const WorkflowV2 = () => {
    const steps = [
        {
            num: '01',
            title: 'Envío del Caso',
            desc: 'Subí archivos STL/PLY de cualquier escáner intraoral (Medit, Trios, iTero, Shining 3D) o coordinamos el recojo de tus modelos físicos en tu clínica en Arequipa.',
            icon: 'bi-cloud-arrow-up',
        },
        {
            num: '02',
            title: 'Planificación 3D',
            desc: 'Diseñamos la estructura en exocad cuidando oclusión funcional, grosores mínimos, perfiles de emergencia y adaptación biológica con el tejido gingival.',
            icon: 'bi-bezier2',
        },
        {
            num: '03',
            title: 'Aprobación en tu Móvil',
            desc: 'Revisás la morfología y oclusión 3D desde tu teléfono antes de tocar el material. Dejás comentarios o ajustes y das tu visto bueno con un clic.',
            icon: 'bi-phone',
        },
        {
            num: '04',
            title: 'Producción y Entrega',
            desc: 'Fresado en bloques certificados o impresión 3D de alta definición, sinterizado, control de calidad y entrega motorizada en tu consultorio desde 48h.',
            icon: 'bi-box-seam',
        },
    ];

    return (
        <section className="afinix-v2-section afinix-v2-workflow" id="flujo">
            <div className="afinix-v2-container">
                <div className="afinix-v2-section-head">
                    <span className="afinix-v2-kicker">
                        <i className="bi bi-diagram-3-fill" aria-hidden="true"></i>
                        Paso a paso sin fricción
                    </span>
                    <h2 className="afinix-v2-section-title">
                        Un flujo 100% digital diseñado para tu comodidad
                    </h2>
                    <p className="afinix-v2-section-sub">
                        Olvídate de la incertidumbre. Desde que recibimos los datos hasta la entrega en tu sillón dental, cada etapa es trazable, rápida y bajo tu criterio clínico.
                    </p>
                </div>

                <div className="afinix-v2-workflow-grid">
                    {steps.map((step) => (
                        <div className="afinix-v2-step-card" key={step.num}>
                            <div className="afinix-v2-step-num">{step.num}</div>
                            <h3>{step.title}</h3>
                            <p>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
