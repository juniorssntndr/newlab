import React from 'react';
import CustomSelect from '../CustomSelect.jsx';

const VITA_OPTIONS = [
    { value: '', label: 'Elegir tono VITA' },
    { value: 'A1', label: 'A1' },
    { value: 'A2', label: 'A2' },
    { value: 'A3', label: 'A3' },
    { value: 'A3.5', label: 'A3.5' },
    { value: 'A4', label: 'A4' },
    { value: 'B1', label: 'B1' },
    { value: 'B2', label: 'B2' },
    { value: 'B3', label: 'B3' },
    { value: 'B4', label: 'B4' },
    { value: 'C1', label: 'C1' },
    { value: 'D2', label: 'D2' },
    { value: 'BL1', label: 'BL1' }
];

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
                        <div className="order-composer-vita-select-wrap" style={{ minWidth: '160px' }}>
                            <CustomSelect
                                options={VITA_OPTIONS}
                                value={form?.color_vita || ''}
                                onChange={(val) => onColorChange(val)}
                                placeholder="Elegir tono VITA"
                                disabled={disabled}
                            />
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
