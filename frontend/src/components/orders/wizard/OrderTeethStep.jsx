import React from 'react';
import OdontogramaInteractive from '../../OdontogramaInteractive.jsx';
import { buildItemSelection, isBridgeProduct } from '../../../utils/odontograma.js';

const VITA_OPTIONS = [
    ['Tonos A', ['A1', 'A2', 'A3', 'A3.5', 'A4']],
    ['Tonos B', ['B1', 'B2', 'B3', 'B4']],
    ['Tonos C / D / Bleach', ['C1', 'D2', 'BL1']],
];

/**
 * Paso Piezas: odontograma + chips (sin duplicar números) + tono + nota.
 */
const OrderTeethStep = ({
    product,
    selection,
    onChange,
    productLabel = 'Trabajo',
    colorVita = '',
    notes = '',
    onColorChange,
    onNotesChange,
    onClear,
    onContinue,
    continueDisabled = false,
    continueLabel = 'Continuar a confirmar',
    showOdontogram = true,
}) => {
    const teeth = Array.isArray(selection?.piezas_dentales) ? selection.piezas_dentales : [];
    const count = teeth.length;
    const countLabel = count === 1 ? '1 diente seleccionado' : `${count} dientes seleccionados`;
    const isBridge = isBridgeProduct(product);

    const removeTooth = (tooth) => {
        const next = teeth.filter((value) => value !== tooth);
        onChange(buildItemSelection(next, isBridge && next.length >= 2));
    };

    const clearAll = () => {
        if (onClear) onClear();
        else onChange(buildItemSelection([], false));
    };

    const canContinue = showOdontogram ? count >= 1 : true;

    return (
        <div className={`order-teeth-step${!showOdontogram ? ' is-specs-only' : ''}`}>
            {showOdontogram ? (
                <div className="order-teeth-step-map">
                    <h2 className="order-teeth-step-title">
                        {count > 0 ? 'Revisa o ajusta las piezas' : 'Selecciona las piezas'}
                    </h2>
                    <p className="order-teeth-step-help">
                        Haz clic o arrastra sobre las piezas.
                    </p>
                    <OdontogramaInteractive
                        product={product}
                        selection={selection || { piezas_dentales: [] }}
                        onChange={onChange}
                        variant="minimal"
                        showSidePanel={false}
                        showProductPill={false}
                        showHeader={false}
                        preserveAspectRatio="xMidYMid meet"
                    />
                </div>
            ) : null}

            <aside className="order-teeth-step-summary">
                <h3>{showOdontogram ? countLabel : 'Tono e instrucciones'}</h3>
                <p>
                    {showOdontogram
                        ? (count > 0
                            ? 'Elige el tono y deja una nota si hace falta.'
                            : 'Selecciona al menos una pieza para continuar.')
                        : 'Color y nota para el laboratorio.'}
                </p>

                {showOdontogram && count > 0 ? (
                    <div className="order-teeth-group" role="group" aria-label={`Piezas de ${productLabel}`}>
                        <div className="order-teeth-group-head">
                            <strong>{productLabel}</strong>
                            <button type="button" className="order-teeth-clear" onClick={clearAll}>
                                Borrar
                            </button>
                        </div>
                        <div className="order-teeth-chips" role="list">
                            {teeth.map((tooth) => (
                                <button
                                    key={tooth}
                                    type="button"
                                    className="order-teeth-chip"
                                    role="listitem"
                                    onClick={() => removeTooth(tooth)}
                                    aria-label={`Quitar pieza ${tooth}`}
                                >
                                    <span>{tooth}</span>
                                    <i className="bi bi-x" aria-hidden="true"></i>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="form-group order-teeth-field">
                    <label className="form-label" htmlFor="order-teeth-color">Tono VITA</label>
                    <select
                        id="order-teeth-color"
                        className="form-select"
                        value={colorVita || ''}
                        onChange={(event) => onColorChange?.(event.target.value)}
                        aria-label="Seleccionar tono VITA"
                    >
                        <option value="">Elegir tono</option>
                        {VITA_OPTIONS.map(([group, values]) => (
                            <optgroup key={group} label={group}>
                                {values.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <div className="form-group order-teeth-field">
                    <label className="form-label" htmlFor="order-teeth-notes">Instrucciones para el laboratorio</label>
                    <textarea
                        id="order-teeth-notes"
                        className="form-textarea"
                        rows={3}
                        placeholder="Indicaciones específicas para este trabajo..."
                        value={notes || ''}
                        onChange={(event) => onNotesChange?.(event.target.value)}
                    />
                </div>

                <button
                    type="button"
                    className="btn btn-primary order-teeth-continue"
                    onClick={onContinue}
                    disabled={continueDisabled || !canContinue}
                >
                    {continueLabel}
                </button>
            </aside>
        </div>
    );
};

export default OrderTeethStep;
