import React from 'react';

export const PainPointsV2 = () => {
    return (
        <section className="afinix-v2-section afinix-v2-pain-points" id="por-que-afinix">
            <div className="afinix-v2-container">
                <div className="afinix-v2-section-head">
                    <span className="afinix-v2-kicker">
                        <i className="bi bi-shield-check" aria-hidden="true"></i>
                        Tranquilidad clínica para tu consulta
                    </span>
                    <h2 className="afinix-v2-section-title">
                        ¿Cansado de la falta de previsibilidad en tus casos protésicos?
                    </h2>
                    <p className="afinix-v2-section-sub">
                        Sabemos lo frustrante que es reprogramar pacientes o pasar 45 minutos retocando una corona. Diseñamos un flujo digital para que tu tiempo en sillón sea rentable y libre de estrés.
                    </p>
                </div>

                <div className="afinix-v2-comparison-grid">
                    <div className="afinix-v2-comp-card afinix-v2-comp-card--bad">
                        <h3 className="afinix-v2-comp-title">
                            <i className="bi bi-x-octagon-fill" aria-hidden="true" style={{ color: '#ff4757' }}></i>
                            <span>Con Laboratorios Convencionales</span>
                        </h3>
                        <ul className="afinix-v2-comp-list">
                            <li>
                                <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Retoque prolongado en sillón:</strong> Puntos de contacto altos, oclusión desajustada y pérdida de tiempo clínico con el paciente esperando.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Fechas de entrega inciertas:</strong> Casos que no llegan a la hora pactada, obligándote a reprogramar citas y arriesgar tu reputación.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Cero control del diseño:</strong> No ves cómo quedará la anatomía hasta que la pieza ya está terminada en metal o cerámica.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Indicaciones extraviadas:</strong> Mensajes de chat dispersos, fotos que se pierden y falta de trazabilidad en la orden.
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div className="afinix-v2-comp-card afinix-v2-comp-card--good">
                        <h3 className="afinix-v2-comp-title">
                            <i className="bi bi-check-circle-fill" aria-hidden="true" style={{ color: '#00e096' }}></i>
                            <span>Con el Flujo Digital AFINIX</span>
                        </h3>
                        <ul className="afinix-v2-comp-list">
                            <li>
                                <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Adaptación pasiva y marginal exacta:</strong> Fresado CAD/CAM de precisión micrométrica. Piezas listas para cementar con ajuste inmediato.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Puntualidad rigurosa desde 48h:</strong> Tiempos de entrega estrictos y trazables para que tu agenda clínica nunca se detenga.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Aprobación 3D previa en tu móvil:</strong> Revisás la morfología, contactos y perfiles antes de fresar el bloque definitivo.
                                </div>
                            </li>
                            <li>
                                <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                                <div>
                                    <strong>Comunicación clínica directa:</strong> Un canal claro para archivos STL, fotografías clínicas y observaciones específicas de cada caso.
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};
