import React, { useEffect, useMemo, useState } from 'react';
import OdontogramaInteractive from '../../OdontogramaInteractive.jsx';
import Modal from '../../Modal.jsx';
import {
    UPPER_ARCH,
    LOWER_ARCH,
    buildItemSelection,
} from '../../../utils/odontograma.js';

const MOBILE_ARCH_QUERY = '(max-width: 900px)';
const UPPER_ARCH_SET = new Set(UPPER_ARCH);
const LOWER_ARCH_SET = new Set(LOWER_ARCH);

const VITA_GROUPS = [
    ['Tonos A', ['A1', 'A2', 'A3', 'A3.5', 'A4']],
    ['Tonos B', ['B1', 'B2', 'B3', 'B4']],
    ['Tonos C / D / Bleach', ['C1', 'D2', 'BL1']],
];

/**
 * Paso Piezas: odontograma + tono.
 * Móvil: contenedor blanco con VITA + botón a popup de instrucciones.
 * Desktop: tono + notas inline.
 */
const OrderTeethStep = ({
    product,
    selection,
    onChange,
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
    const selectedShade = String(colorVita || '').trim();
    const notesValue = String(notes || '');
    const hasNotes = notesValue.trim().length > 0;
    const [activeArch, setActiveArch] = useState('upper');
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesDraft, setNotesDraft] = useState(notesValue);
    const [isMobile, setIsMobile] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia(MOBILE_ARCH_QUERY).matches
    ));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia(MOBILE_ARCH_QUERY);
        const handleChange = (event) => setIsMobile(event.matches);
        setIsMobile(media.matches);
        if (media.addEventListener) {
            media.addEventListener('change', handleChange);
        } else {
            media.addListener(handleChange);
        }
        return () => {
            if (media.removeEventListener) {
                media.removeEventListener('change', handleChange);
            } else {
                media.removeListener(handleChange);
            }
        };
    }, []);

    useEffect(() => {
        if (!notesOpen) setNotesDraft(notesValue);
    }, [notesValue, notesOpen]);

    const hasUpperSelection = useMemo(
        () => teeth.some((tooth) => UPPER_ARCH_SET.has(tooth)),
        [teeth]
    );
    const hasLowerSelection = useMemo(
        () => teeth.some((tooth) => LOWER_ARCH_SET.has(tooth)),
        [teeth]
    );

    const clearAll = () => {
        if (onClear) onClear();
        else onChange(buildItemSelection([], false));
    };

    const openNotes = () => {
        setNotesDraft(notesValue);
        setNotesOpen(true);
    };

    const saveNotes = () => {
        onNotesChange?.(notesDraft);
        setNotesOpen(false);
    };

    const canContinue = showOdontogram
        ? count >= 1 && Boolean(selectedShade)
        : Boolean(selectedShade);
    const odontogramArch = isMobile ? activeArch : 'both';
    const mapFocus = isMobile && showOdontogram;
    const showInlineNotes = !mapFocus;
    const shadeMissing = !selectedShade;

    const vitaSelect = (
        <div className={`form-group order-teeth-field order-teeth-vita-field${shadeMissing ? ' is-required-empty' : ' has-shade'}`}>
            <label className="form-label" htmlFor="order-teeth-color">
                Tono VITA
            </label>
            <select
                id="order-teeth-color"
                className={`form-select order-teeth-vita-select${selectedShade ? ' has-value' : ' is-empty'}`}
                value={selectedShade}
                onChange={(event) => onColorChange?.(event.target.value)}
                aria-label="Seleccionar tono VITA"
                aria-required="true"
                required
            >
                <option value="">Elegir tono</option>
                {VITA_GROUPS.map(([group, values]) => (
                    <optgroup key={group} label={group}>
                        {values.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
            {shadeMissing ? (
                <span className="order-teeth-vita-hint">Elige un tono para continuar.</span>
            ) : null}
        </div>
    );

    return (
        <div className={`order-teeth-step${!showOdontogram ? ' is-specs-only' : ''}${mapFocus ? ' is-map-focus' : ''}`}>
            {showOdontogram ? (
                <div className="order-teeth-step-map">
                    <div className="order-teeth-step-map-head">
                        <h2 className="order-teeth-step-title">
                            {count > 0 ? 'Revisa o ajusta las piezas' : 'Selecciona las piezas'}
                        </h2>
                        {count > 0 ? (
                            <button type="button" className="order-teeth-clear" onClick={clearAll}>
                                Borrar
                            </button>
                        ) : null}
                    </div>
                    <p className="order-teeth-step-help">
                        Haz clic o arrastra sobre las piezas.
                    </p>
                    <div
                        className="order-teeth-arch-toggle"
                        role="group"
                        aria-label="Maxilar visible"
                    >
                        <button
                            type="button"
                            className={`order-teeth-arch-btn${activeArch === 'upper' ? ' is-active' : ''}`}
                            aria-pressed={activeArch === 'upper'}
                            onClick={() => setActiveArch('upper')}
                        >
                            Superior
                            {hasUpperSelection && activeArch !== 'upper' ? (
                                <span className="order-teeth-arch-dot" aria-hidden="true" />
                            ) : null}
                        </button>
                        <button
                            type="button"
                            className={`order-teeth-arch-btn${activeArch === 'lower' ? ' is-active' : ''}`}
                            aria-pressed={activeArch === 'lower'}
                            onClick={() => setActiveArch('lower')}
                        >
                            Inferior
                            {hasLowerSelection && activeArch !== 'lower' ? (
                                <span className="order-teeth-arch-dot" aria-hidden="true" />
                            ) : null}
                        </button>
                    </div>
                    <OdontogramaInteractive
                        product={product}
                        selection={selection || { piezas_dentales: [] }}
                        onChange={onChange}
                        variant="minimal"
                        arch={odontogramArch}
                        showSidePanel={false}
                        showProductPill={false}
                        showHeader={false}
                        preserveAspectRatio="xMidYMin meet"
                    />
                </div>
            ) : null}

            <aside className="order-teeth-step-summary">
                {!mapFocus ? (
                    <>
                        <h3>Tono e instrucciones</h3>
                        <p>
                            {showOdontogram
                                ? (count > 0
                                    ? 'Elige el tono y deja una nota si hace falta.'
                                    : 'Selecciona al menos una pieza para continuar.')
                                : 'Color y nota para el laboratorio.'}
                        </p>
                    </>
                ) : null}

                {vitaSelect}

                {mapFocus ? (
                    <button
                        type="button"
                        className={`order-teeth-notes-trigger${hasNotes ? ' has-notes' : ''}`}
                        onClick={openNotes}
                    >
                        <span className="order-teeth-notes-trigger-copy">
                            <strong>Instrucciones para el laboratorio</strong>
                            <em className={hasNotes ? 'is-filled' : 'is-optional'}>
                                {hasNotes ? 'Nota agregada' : 'Opcional'}
                            </em>
                        </span>
                        <span className="order-teeth-notes-trigger-action">
                            {hasNotes ? 'Editar' : 'Agregar'}
                        </span>
                        <i className="bi bi-chevron-right" aria-hidden="true" />
                    </button>
                ) : null}

                {showInlineNotes ? (
                    <div className="form-group order-teeth-field">
                        <label className="form-label" htmlFor="order-teeth-notes">Instrucciones para el laboratorio</label>
                        <textarea
                            id="order-teeth-notes"
                            className="form-textarea"
                            rows={2}
                            placeholder="Indicaciones específicas para este trabajo..."
                            value={notesValue}
                            onChange={(event) => onNotesChange?.(event.target.value)}
                        />
                    </div>
                ) : null}

                <button
                    type="button"
                    className="btn btn-primary order-teeth-continue"
                    onClick={onContinue}
                    disabled={continueDisabled || !canContinue}
                >
                    {continueLabel}
                </button>
            </aside>

            <Modal
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                title="Instrucciones para el laboratorio"
                className="order-teeth-notes-modal"
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
                <p className="order-teeth-notes-modal-lead">
                    Indicaciones específicas para este trabajo. Puedes dejarlo vacío si no hace falta.
                </p>
                <label className="form-label" htmlFor="order-teeth-notes-modal">Nota clínica</label>
                <textarea
                    id="order-teeth-notes-modal"
                    className="form-textarea order-teeth-notes-modal-input"
                    rows={5}
                    placeholder="Indicaciones específicas para este trabajo..."
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                />
            </Modal>
        </div>
    );
};

export default OrderTeethStep;
