import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    ['Tonos C / D / Bleach', ['C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4', 'BL1', 'BL2', 'BL3', 'BL4']],
];

const CHROMASCOP_GROUPS = [
    ['Tonos 100 (Blanco / Claro)', ['110', '120', '130', '140']],
    ['Tonos 200 (Amarillo cálido)', ['210', '220', '230', '240']],
    ['Tonos 300 (Gris claro / Marrón)', ['310', '320', '330', '340']],
    ['Tonos 400 (Gris oscuro)', ['410', '420', '430', '440']],
    ['Tonos 500 (Rojizo / Oscuro)', ['510', '520', '530', '540']],
    ['Bleach', ['010', '020', '030', '040']],
];

/**
 * Paso Piezas: odontograma + tono.
 * Móvil: contenedor blanco con selector de tono + botón a popup de instrucciones.
 * Desktop: tono + notas inline.
 */
const OrderTeethStep = ({
    product,
    selection,
    onChange,
    colorVita = '',
    guiaColor = 'vita',
    notes = '',
    onColorChange,
    onGuiaColorChange,
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
    const [activeGuia, setActiveGuia] = useState(() => (
        String(guiaColor || '').toLowerCase() === 'chromascop' ? 'chromascop' : 'vita'
    ));

    useEffect(() => {
        if (guiaColor) {
            const normalized = String(guiaColor).toLowerCase() === 'chromascop' ? 'chromascop' : 'vita';
            setActiveGuia(normalized);
        }
    }, [guiaColor]);

    const handleGuiaChange = (nextGuia) => {
        if (nextGuia === activeGuia) return;
        setActiveGuia(nextGuia);
        onGuiaColorChange?.(nextGuia);
        if (selectedShade) {
            onColorChange?.('');
        }
        setPickerOpen(true);
    };
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
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef(null);

    useEffect(() => {
        if (!pickerOpen) return undefined;
        const handleOutsideClick = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleOutsideClick);
        return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, [pickerOpen]);

    const activeGroups = activeGuia === 'chromascop' ? CHROMASCOP_GROUPS : VITA_GROUPS;
    const guideLabel = activeGuia === 'chromascop' ? 'Chromascop' : 'VITA';

    const shadeSelect = (
        <div className={`form-group order-teeth-field order-teeth-vita-field${shadeMissing ? ' is-required-empty' : ' has-shade'}`}>
            <div className="order-teeth-shade-header">
                <label className="form-label">
                    Tono
                </label>
                <div className="order-teeth-guide-tabs" role="tablist" aria-label="Guía de color">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeGuia === 'vita'}
                        className={`order-teeth-guide-tab${activeGuia === 'vita' ? ' is-active' : ''}`}
                        onClick={() => handleGuiaChange('vita')}
                    >
                        VITA
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeGuia === 'chromascop'}
                        className={`order-teeth-guide-tab${activeGuia === 'chromascop' ? ' is-active' : ''}`}
                        onClick={() => handleGuiaChange('chromascop')}
                    >
                        CHROMASCOP
                    </button>
                </div>
            </div>

            <div className="order-teeth-shade-picker" ref={pickerRef}>
                <button
                    type="button"
                    className={`order-teeth-shade-trigger${selectedShade ? ' has-value' : ' is-empty'}${pickerOpen ? ' is-open' : ''}`}
                    onClick={() => setPickerOpen((prev) => !prev)}
                    aria-expanded={pickerOpen}
                    aria-haspopup="listbox"
                    aria-label="Seleccionar tono"
                >
                    <div className="order-teeth-shade-trigger-main">
                        <span
                            className="order-teeth-shade-trigger-swatch"
                            style={{
                                background: selectedShade
                                    ? (selectedShade.startsWith('0') || selectedShade.startsWith('BL') ? '#ffffff' : '#fef3c7')
                                    : '#e2e8f0'
                            }}
                            aria-hidden="true"
                        />
                        {selectedShade ? (
                            <>
                                <span className="order-teeth-shade-trigger-label">{selectedShade}</span>
                                <span className="order-teeth-shade-trigger-guide-tag">{activeGuia}</span>
                            </>
                        ) : (
                            <span className="order-teeth-shade-trigger-placeholder">Elegir tono ({guideLabel})</span>
                        )}
                    </div>
                    <i className="bi bi-chevron-down order-teeth-shade-trigger-chevron" aria-hidden="true" />
                </button>

                {pickerOpen && (
                    <div className="order-teeth-shade-popover" role="listbox" aria-label={`Tonos ${guideLabel}`}>
                        {activeGroups.map(([group, values]) => (
                            <div key={group} className="order-teeth-shade-group">
                                <div className="order-teeth-shade-group-title">{group}</div>
                                <div className="order-teeth-shade-grid">
                                    {values.map((value) => {
                                        const isSelected = selectedShade === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                className={`order-teeth-shade-chip${isSelected ? ' is-selected' : ''}`}
                                                onClick={() => {
                                                    onColorChange?.(value);
                                                    setPickerOpen(false);
                                                }}
                                            >
                                                {value}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {shadeMissing ? (
                <span className="order-teeth-vita-hint">Elige un tono para continuar.</span>
            ) : null}
        </div>
    );

    const [helpTooltipOpen, setHelpTooltipOpen] = useState(false);
    const helpTooltipRef = useRef(null);

    useEffect(() => {
        if (!helpTooltipOpen) return undefined;
        const handleOutside = (event) => {
            if (helpTooltipRef.current && !helpTooltipRef.current.contains(event.target)) {
                setHelpTooltipOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleOutside);
        return () => document.removeEventListener('pointerdown', handleOutside);
    }, [helpTooltipOpen]);

    return (
        <div className={`order-teeth-step${!showOdontogram ? ' is-specs-only' : ''}${mapFocus ? ' is-map-focus' : ''}`}>
            {showOdontogram ? (
                <div className="order-teeth-step-map">
                    <div className="order-teeth-step-map-head">
                        <div className="order-teeth-title-wrap" ref={helpTooltipRef}>
                            <h2 className="order-teeth-step-title">
                                {count > 0 ? 'Revisa o ajusta las piezas' : 'Selecciona las piezas'}
                            </h2>
                            <button
                                type="button"
                                className={`order-teeth-help-btn${helpTooltipOpen ? ' is-active' : ''}`}
                                onClick={() => setHelpTooltipOpen((prev) => !prev)}
                                aria-label="¿Cómo marcar piezas?"
                                title="¿Cómo marcar piezas?"
                            >
                                <i className="bi bi-question-lg" aria-hidden="true" />
                            </button>

                            {/* Tooltip Pop-up flotante orgánico (posicionado absoluto, sin empujar nada) */}
                            {helpTooltipOpen && (
                                <div className="order-teeth-help-floating-popover" role="tooltip">
                                    <div className="order-teeth-help-floating-head">
                                        <span>¿Cómo marcar piezas?</span>
                                        <button
                                            type="button"
                                            className="order-teeth-help-floating-close"
                                            onClick={() => setHelpTooltipOpen(false)}
                                            aria-label="Cerrar"
                                        >
                                            <i className="bi bi-x" aria-hidden="true" />
                                        </button>
                                    </div>
                                    <div className="order-teeth-help-floating-rows">
                                        <div className="order-teeth-help-floating-row">
                                            <span className="order-teeth-help-dot order-teeth-help-dot--blue" />
                                            <span><strong>1 Clic / Toque:</strong> Corona unitaria</span>
                                        </div>
                                        <div className="order-teeth-help-floating-row">
                                            <span className="order-teeth-help-dot order-teeth-help-dot--green" />
                                            <span><strong>Arrastrar:</strong> Puente (conecta pilares y pónticos)</span>
                                        </div>
                                        <div className="order-teeth-help-floating-row">
                                            <span className="order-teeth-help-dot order-teeth-help-dot--orange" />
                                            <span><strong>Clic en puente:</strong> Alternar pilar / póntico</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {count > 0 ? (
                            <button type="button" className="order-teeth-clear" onClick={clearAll}>
                                Borrar
                            </button>
                        ) : null}
                    </div>

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

                {shadeSelect}

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

