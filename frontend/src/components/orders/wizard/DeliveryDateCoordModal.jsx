import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../Modal.jsx';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const parseIsoDate = (isoDate) => {
    if (!isoDate) return null;
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const toIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatLongDate = (isoDate) => {
    const date = parseIsoDate(isoDate);
    if (!date) return '—';
    const label = date.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildMonthCells = (monthDate, minIso, selectedIso) => {
    const first = startOfMonth(monthDate);
    // Monday-first offset
    const mondayOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < mondayOffset; i += 1) {
        cells.push({ key: `pad-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(first.getFullYear(), first.getMonth(), day);
        const iso = toIsoDate(date);
        cells.push({
            key: iso,
            empty: false,
            day,
            iso,
            disabled: Boolean(minIso && iso < minIso),
            isMin: iso === minIso,
            isSelected: iso === selectedIso,
        });
    }

    return cells;
};

/**
 * Modal to coordinate a delivery date on or after the lab minimum.
 */
const DeliveryDateCoordModal = ({
    open,
    onClose,
    minDate,
    value,
    onConfirm,
    onUseEstimated,
}) => {
    const initial = value && minDate && value < minDate ? minDate : (value || minDate || '');
    const [draftDate, setDraftDate] = useState(initial);
    const [viewMonth, setViewMonth] = useState(() => parseIsoDate(initial) || new Date());

    useEffect(() => {
        if (!open) return;
        const next = value && minDate && value < minDate ? minDate : (value || minDate || '');
        setDraftDate(next);
        setViewMonth(parseIsoDate(next) || parseIsoDate(minDate) || new Date());
    }, [open, value, minDate]);

    const monthLabel = useMemo(() => {
        const label = viewMonth.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }, [viewMonth]);

    const cells = useMemo(
        () => buildMonthCells(viewMonth, minDate, draftDate),
        [viewMonth, minDate, draftDate],
    );

    const canGoPrev = useMemo(() => {
        if (!minDate) return true;
        const min = parseIsoDate(minDate);
        if (!min) return true;
        const prevLast = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0);
        return prevLast >= min;
    }, [viewMonth, minDate]);

    const shiftMonth = (delta) => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Coordinar fecha de entrega"
            className="delivery-coord-modal"
            footer={(
                <>
                    <button type="button" className="btn btn-ghost" onClick={onUseEstimated}>
                        Usar fecha estimada
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => onConfirm(draftDate || minDate)}
                        disabled={!draftDate}
                    >
                        Confirmar fecha
                    </button>
                </>
            )}
        >
            <p className="delivery-coord-lead">
                Entrega mínima del lab: <strong>{formatLongDate(minDate)}</strong>.
                Solo puedes elegir ese día o uno posterior (por ejemplo si la clínica cierra o prefieres el lunes).
            </p>

            <div className="delivery-coord-calendar" role="group" aria-label="Calendario de entrega">
                <div className="delivery-coord-calendar-nav">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => shiftMonth(-1)}
                        disabled={!canGoPrev}
                        aria-label="Mes anterior"
                    >
                        <i className="bi bi-chevron-left" aria-hidden="true"></i>
                    </button>
                    <strong>{monthLabel}</strong>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => shiftMonth(1)}
                        aria-label="Mes siguiente"
                    >
                        <i className="bi bi-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>

                <div className="delivery-coord-weekdays" aria-hidden="true">
                    {WEEKDAYS.map((label) => (
                        <span key={label}>{label}</span>
                    ))}
                </div>

                <div className="delivery-coord-grid">
                    {cells.map((cell) => {
                        if (cell.empty) {
                            return <span key={cell.key} className="delivery-coord-day is-empty" />;
                        }
                        const className = [
                            'delivery-coord-day',
                            cell.disabled ? 'is-disabled' : '',
                            cell.isMin ? 'is-min' : '',
                            cell.isSelected ? 'is-selected' : '',
                        ].filter(Boolean).join(' ');

                        return (
                            <button
                                key={cell.key}
                                type="button"
                                className={className}
                                disabled={cell.disabled}
                                aria-pressed={cell.isSelected}
                                aria-label={formatLongDate(cell.iso)}
                                onClick={() => setDraftDate(cell.iso)}
                            >
                                {cell.day}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="delivery-coord-selected" aria-live="polite">
                Fecha elegida: <strong>{formatLongDate(draftDate)}</strong>
                {draftDate && minDate && draftDate > minDate ? (
                    <span> · Posterior al mínimo</span>
                ) : null}
            </p>
        </Modal>
    );
};

export default DeliveryDateCoordModal;
