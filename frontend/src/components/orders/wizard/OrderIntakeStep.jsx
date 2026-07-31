import React, { useRef } from 'react';
import { ORDER_INTAKE_MODES } from '../../../modules/orders/wizard/orderWizardConstants.js';

/**
 * Coordinación de ingreso: digital / envío / recolección (sin subir archivos aquí).
 * compact=true: cards horizontales para Confirmar.
 */
const OrderIntakeStep = ({
    value,
    onChange,
    note = '',
    onNoteChange,
    onContinue,
    compact = false,
    title = '¿Cómo llegará el caso al laboratorio?',
}) => {
    const optionRefs = useRef({});

    const moveSelection = (delta) => {
        const currentIndex = Math.max(0, ORDER_INTAKE_MODES.findIndex((mode) => mode.id === value));
        const nextIndex = (currentIndex + delta + ORDER_INTAKE_MODES.length) % ORDER_INTAKE_MODES.length;
        const nextMode = ORDER_INTAKE_MODES[nextIndex];
        onChange(nextMode.id);
        window.requestAnimationFrame(() => {
            optionRefs.current[nextMode.id]?.focus?.();
        });
    };

    const handleOptionKeyDown = (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveSelection(1);
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveSelection(-1);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            const first = ORDER_INTAKE_MODES[0];
            onChange(first.id);
            window.requestAnimationFrame(() => optionRefs.current[first.id]?.focus?.());
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            const last = ORDER_INTAKE_MODES[ORDER_INTAKE_MODES.length - 1];
            onChange(last.id);
            window.requestAnimationFrame(() => optionRefs.current[last.id]?.focus?.());
        }
    };

    return (
        <div className={`order-intake-step${compact ? ' is-compact' : ''}`}>
            {title ? <h3 className="order-intake-title">{title}</h3> : null}
            <div
                className="order-intake-options"
                role="radiogroup"
                aria-label="Cómo llega el caso al laboratorio"
                onKeyDown={handleOptionKeyDown}
            >
                {ORDER_INTAKE_MODES.map((mode) => {
                    const selected = value === mode.id;
                    return (
                        <button
                            key={mode.id}
                            ref={(node) => {
                                optionRefs.current[mode.id] = node;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            tabIndex={selected ? 0 : -1}
                            className={`order-intake-card${selected ? ' is-selected' : ''}`}
                            onClick={() => onChange(mode.id)}
                        >
                            <span className="order-intake-card-top">
                                <span className="order-intake-card-icon" aria-hidden="true">
                                    <i className={`bi ${mode.icon}`}></i>
                                </span>
                                <span className="order-intake-card-check" aria-hidden="true">
                                    {selected
                                        ? <i className="bi bi-check-circle-fill"></i>
                                        : <i className="bi bi-circle"></i>}
                                </span>
                            </span>
                            <span className="order-intake-card-copy">
                                <strong>{mode.label}</strong>
                                <span>{mode.description}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="form-group order-intake-note">
                <label className="form-label" htmlFor="order-intake-note">
                    Nota de coordinación (opcional)
                </label>
                <textarea
                    id="order-intake-note"
                    className="form-textarea"
                    rows={compact ? 2 : 3}
                    placeholder={
                        value === 'recoleccion'
                            ? 'Ej.: dirección, horario preferido o contacto'
                            : value === 'envio'
                                ? 'Ej.: courier, fecha estimada de envío'
                                : 'Ej.: subiré el STL mañana'
                    }
                    value={note}
                    onChange={(event) => onNoteChange?.(event.target.value)}
                />
            </div>

            {!compact && onContinue ? (
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onContinue}
                    disabled={!value}
                >
                    Guardar y continuar
                </button>
            ) : null}
        </div>
    );
};

export default OrderIntakeStep;
