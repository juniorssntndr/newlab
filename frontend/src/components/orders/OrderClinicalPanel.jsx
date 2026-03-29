import React from 'react';

export const OrderClinicalPanel = ({
    className = '',
    form,
    resolvedCantidad,
    requiresDentalSelection,
    onColorChange,
    onNotesChange,
    onQuantityChange,
    showDerivedFields = true,
    disabled = false
}) => {
    const panelClassName = ['order-composer-clinical-panel', className].filter(Boolean).join(' ');
    const piezasSeleccionadas = form?.piezas_dentales?.length || 0;
    return (
        <section className={panelClassName}>
            <h6 className="order-composer-section-title"><i className="bi bi-journal-medical"></i> Especificaciones Clinicas</h6>

            <div className="form-group">
                <label className="form-label">Seleccion dental y Color</label>
                <div className="order-composer-status-strip">
                    <div className="order-composer-status-inline">
                        <span className="odonto-status-pill">
                            {requiresDentalSelection ? `${piezasSeleccionadas} piezas` : `${resolvedCantidad} unidades`}
                        </span>
                    </div>
                    <div className="order-composer-status-inline">
                        <span className="order-composer-vita-pill">VITA</span>
                        <div className="order-composer-vita-select-wrap">
                            <i className="bi bi-palette order-composer-status-icon"></i>
                            <select
                                className="form-input order-composer-vita-select"
                                value={form?.color_vita || ''}
                                onChange={(event) => onColorChange(event.target.value)}
                                aria-label="Seleccionar tono VITA"
                                disabled={disabled}
                            >
                                <option value="">Elegir tono VITA</option>
                                <optgroup label="Tonos A">
                                    <option value="A1">A1</option><option value="A2">A2</option>
                                    <option value="A3">A3</option><option value="A3.5">A3.5</option><option value="A4">A4</option>
                                </optgroup>
                                <optgroup label="Tonos B">
                                    <option value="B1">B1</option><option value="B2">B2</option>
                                    <option value="B3">B3</option><option value="B4">B4</option>
                                </optgroup>
                                <optgroup label="Tonos C / D / Bleach">
                                    <option value="C1">C1</option><option value="D2">D2</option><option value="BL1">BL1</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {showDerivedFields && (
                <div className="order-composer-fields-grid">
                    <div className="form-group order-composer-field-reset">
                        <label className="form-label">Cantidad</label>
                        <input
                            className="form-input"
                            type="number"
                            min={1}
                            value={resolvedCantidad}
                            disabled={requiresDentalSelection}
                            readOnly={requiresDentalSelection}
                            onChange={(event) => onQuantityChange(event.target.value)}
                        />
                    </div>
                    <div className="form-group order-composer-field-reset">
                        <label className="form-label">Regla</label>
                        <input
                            className="form-input"
                            value={requiresDentalSelection ? 'Cantidad derivada del odontograma' : 'Cantidad manual editable'}
                            readOnly
                        />
                    </div>
                </div>
            )}

            <div className="form-group order-composer-field-reset" style={{ marginTop: '1rem' }}>
                <label className="form-label">Notas del item</label>
                <textarea
                    className="form-input form-textarea"
                    rows={3}
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Instrucciones especificas para esta restauracion..."
                    value={form?.notas || ''}
                    onChange={(event) => onNotesChange(event.target.value)}
                    disabled={disabled}
                />
            </div>
        </section>
    );
};

export default OrderClinicalPanel;
