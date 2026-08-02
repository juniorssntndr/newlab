import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../Modal.jsx';
import { ORDER_INTAKE_MODES } from '../../../modules/orders/wizard/orderWizardConstants.js';
import { whatsappStlCaseHref } from '../../../config/siteSeo.js';
import { getProductDisplayName } from '../../../utils/productDisplayName.js';

/**
 * Coordinación de ingreso: digital / envío / recolección (sin subir archivos aquí).
 * compact=true: cards para Confirmar; nota vía trigger + modal.
 */
const OrderIntakeStep = ({
    value,
    onChange,
    note = '',
    onNoteChange,
    onContinue,
    compact = false,
    title = '¿Cómo llegará el caso al laboratorio?',
    labAddress = '',
    clinicAddress = '',
    patientName = '',
    productName = '',
}) => {
    const optionRefs = useRef({});
    const noteValue = String(note || '');
    const hasNote = noteValue.trim().length > 0;
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesDraft, setNotesDraft] = useState(noteValue);

    const stlWhatsAppHref = useMemo(
        () => whatsappStlCaseHref({
            patientName,
            productName: getProductDisplayName(productName),
        }),
        [patientName, productName]
    );

    useEffect(() => {
        if (!notesOpen) setNotesDraft(noteValue);
    }, [noteValue, notesOpen]);

    const notePlaceholder = value === 'recoleccion'
        ? 'Ej.: dirección, horario preferido o contacto'
        : value === 'envio'
            ? 'Ej.: courier, fecha estimada de envío'
            : 'Ej.: subiré el STL mañana';

    const openNotes = () => {
        setNotesDraft(noteValue);
        setNotesOpen(true);
    };

    const saveNotes = () => {
        onNoteChange?.(notesDraft);
        setNotesOpen(false);
    };

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

            {value === 'envio' && labAddress ? (
                <p className="order-intake-address-hint" role="note">
                    <i className="bi bi-geo-alt" aria-hidden="true"></i>
                    Enviar a: {labAddress}
                </p>
            ) : null}
            {value === 'recoleccion' && clinicAddress ? (
                <p className="order-intake-address-hint" role="note">
                    <i className="bi bi-geo-alt" aria-hidden="true"></i>
                    Recojo en: {clinicAddress}
                </p>
            ) : null}
            {value === 'recoleccion' && !clinicAddress ? (
                <p className="order-intake-address-hint is-warning" role="note">
                    <i className="bi bi-exclamation-circle" aria-hidden="true"></i>
                    Completa la dirección del consultorio en Mi cuenta.
                </p>
            ) : null}
            {value === 'digital' ? (
                <div className="order-intake-address-hint order-intake-stl-hint" role="note">
                    <i className="bi bi-whatsapp" aria-hidden="true"></i>
                    <span className="order-intake-stl-hint-copy">
                        Envía el STL por WhatsApp a AFINIX con el detalle del caso.
                    </span>
                    <a
                        className="btn btn-sm btn-primary order-intake-stl-wa"
                        href={stlWhatsAppHref}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <i className="bi bi-whatsapp" aria-hidden="true"></i>
                        Abrir WhatsApp
                    </a>
                </div>
            ) : null}

            {compact ? (
                <button
                    type="button"
                    className={`order-notes-trigger${hasNote ? ' has-notes' : ''}`}
                    onClick={openNotes}
                >
                    <span className="order-notes-trigger-copy">
                        <strong>Nota de coordinación</strong>
                        <em className={hasNote ? 'is-filled' : 'is-optional'}>
                            {hasNote ? 'Nota agregada' : 'Opcional'}
                        </em>
                    </span>
                    <span className="order-notes-trigger-action">
                        {hasNote ? 'Editar' : 'Agregar'}
                    </span>
                    <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>
            ) : (
                <div className="form-group order-intake-note">
                    <label className="form-label" htmlFor="order-intake-note">
                        Nota de coordinación (opcional)
                    </label>
                    <textarea
                        id="order-intake-note"
                        className="form-textarea"
                        rows={3}
                        placeholder={notePlaceholder}
                        value={noteValue}
                        onChange={(event) => onNoteChange?.(event.target.value)}
                    />
                </div>
            )}

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

            <Modal
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                title="Nota de coordinación"
                className="order-intake-notes-modal"
                footer={(
                    <>
                        <button type="button" className="btn btn-ghost" onClick={() => setNotesOpen(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn btn-primary" onClick={saveNotes}>
                            Guardar
                        </button>
                    </>
                )}
            >
                <p className="order-notes-modal-lead">
                    Detalles para coordinación del ingreso. Puedes dejarlo vacío si no hace falta.
                </p>
                <label className="form-label" htmlFor="order-intake-note-modal">Nota</label>
                <textarea
                    id="order-intake-note-modal"
                    className="form-textarea order-notes-modal-input"
                    rows={5}
                    placeholder={notePlaceholder}
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                />
            </Modal>
        </div>
    );
};

export default OrderIntakeStep;
