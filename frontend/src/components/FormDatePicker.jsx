import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const PANEL_GAP = 8;
const VIEWPORT_PAD = 16;
const PANEL_WIDTH = 312;
const DEFAULT_MIN_YEAR = 1900;

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

const formatDisplayDate = (isoDate) => {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    return new Intl.DateTimeFormat('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
};

const formatAriaDate = (isoDate) => {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    const label = date.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildMonthCells = (monthDate, selectedIso, minIso, maxIso, todayIso) => {
    const first = startOfMonth(monthDate);
    const mondayOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < mondayOffset; i += 1) {
        cells.push({ key: `pad-${i}`, empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(first.getFullYear(), first.getMonth(), day);
        const iso = toIsoDate(date);
        const disabled = Boolean((minIso && iso < minIso) || (maxIso && iso > maxIso));
        cells.push({
            key: iso,
            empty: false,
            day,
            iso,
            disabled,
            isSelected: iso === selectedIso,
            isToday: iso === todayIso,
        });
    }

    return cells;
};

/**
 * Date field with a custom popover calendar styled to match NEWLAB forms.
 * Value is always ISO `YYYY-MM-DD` (local calendar date).
 * Panel portals to document.body so it is not clipped by modal overflow.
 */
const FormDatePicker = ({
    id,
    value = '',
    onChange,
    disabled = false,
    min,
    max,
    className = '',
    'aria-label': ariaLabel,
}) => {
    const [open, setOpen] = useState(false);
    const [panelStyle, setPanelStyle] = useState(null);
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const panelId = useId();
    const todayIso = toIsoDate(new Date());
    const [viewMonth, setViewMonth] = useState(() => parseIsoDate(value) || new Date());

    const updatePanelPosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const panelEl = panelRef.current;
        const panelHeight = panelEl?.offsetHeight || 360;
        const panelWidth = Math.min(
            PANEL_WIDTH,
            Math.max(rect.width, window.innerWidth - VIEWPORT_PAD * 2),
        );

        const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_PAD;
        const spaceAbove = rect.top - PANEL_GAP - VIEWPORT_PAD;
        const openUp = spaceBelow < panelHeight && spaceAbove > spaceBelow;

        const alignEnd = Boolean(
            rootRef.current?.classList.contains('form-date-picker--end'),
        );

        let left = alignEnd ? rect.right - panelWidth : rect.left;
        left = Math.min(left, window.innerWidth - VIEWPORT_PAD - panelWidth);
        left = Math.max(VIEWPORT_PAD, left);

        if (openUp) {
            setPanelStyle({
                position: 'fixed',
                top: 'auto',
                bottom: Math.max(VIEWPORT_PAD, window.innerHeight - rect.top + PANEL_GAP),
                left,
                right: 'auto',
                width: panelWidth,
                maxHeight: Math.max(160, spaceAbove),
            });
        } else {
            setPanelStyle({
                position: 'fixed',
                top: rect.bottom + PANEL_GAP,
                bottom: 'auto',
                left,
                right: 'auto',
                width: panelWidth,
                maxHeight: Math.max(160, spaceBelow),
            });
        }
    };

    useLayoutEffect(() => {
        if (!open) {
            setPanelStyle(null);
            return undefined;
        }

        updatePanelPosition();

        const handleReposition = () => updatePanelPosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);
        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [open, viewMonth]);

    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (rootRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setViewMonth(parseIsoDate(value) || new Date());
    }, [open, value]);

    const monthLabel = useMemo(() => {
        const label = viewMonth.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }, [viewMonth]);

    const yearOptions = useMemo(() => {
        const minYear = parseIsoDate(min)?.getFullYear() ?? DEFAULT_MIN_YEAR;
        const maxYear = parseIsoDate(max)?.getFullYear() ?? (new Date().getFullYear() + 5);
        const years = [];
        for (let y = maxYear; y >= minYear; y -= 1) years.push(y);
        return years;
    }, [min, max]);

    const monthOptions = useMemo(() => {
        const year = viewMonth.getFullYear();
        const minDate = parseIsoDate(min);
        const maxDate = parseIsoDate(max);
        return MONTH_NAMES.map((label, index) => {
            const monthStart = new Date(year, index, 1);
            const monthEnd = new Date(year, index + 1, 0);
            const beforeMin = Boolean(minDate && monthEnd < minDate);
            const afterMax = Boolean(maxDate && monthStart > maxDate);
            return { value: index, label, disabled: beforeMin || afterMax };
        });
    }, [viewMonth, min, max]);

    const cells = useMemo(
        () => buildMonthCells(viewMonth, value, min, max, todayIso),
        [viewMonth, value, min, max, todayIso],
    );

    const canGoPrev = useMemo(() => {
        if (!min) return true;
        const minDate = parseIsoDate(min);
        if (!minDate) return true;
        const prevLast = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0);
        return prevLast >= minDate;
    }, [viewMonth, min]);

    const canGoNext = useMemo(() => {
        if (!max) return true;
        const maxDate = parseIsoDate(max);
        if (!maxDate) return true;
        const nextFirst = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
        return nextFirst <= maxDate;
    }, [viewMonth, max]);

    const display = formatDisplayDate(value);
    const todayDisabled = Boolean((min && todayIso < min) || (max && todayIso > max));

    const selectDate = (iso) => {
        onChange?.(iso);
        setOpen(false);
    };

    const shiftMonth = (delta) => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const setViewYear = (year) => {
        setViewMonth((prev) => new Date(Number(year), prev.getMonth(), 1));
    };

    const setViewMonthIndex = (monthIndex) => {
        setViewMonth((prev) => new Date(prev.getFullYear(), Number(monthIndex), 1));
    };

    const panel = open ? (
        <div
            ref={panelRef}
            id={panelId}
            className="form-date-picker-panel is-ported"
            role="dialog"
            aria-label="Calendario"
            style={panelStyle || { position: 'fixed', visibility: 'hidden' }}
        >
            <div className="delivery-coord-calendar" role="group" aria-label="Elegir día">
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
                    <div className="form-date-picker-nav-selects" aria-label={monthLabel}>
                        <select
                            id={`${panelId}-month`}
                            className="form-select form-date-picker-month-select"
                            value={viewMonth.getMonth()}
                            onChange={(e) => setViewMonthIndex(e.target.value)}
                            aria-label="Mes"
                        >
                            {monthOptions.map((option) => (
                                <option key={option.value} value={option.value} disabled={option.disabled}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <select
                            id={`${panelId}-year`}
                            className="form-select form-date-picker-year-select"
                            value={viewMonth.getFullYear()}
                            onChange={(e) => setViewYear(e.target.value)}
                            aria-label="Año"
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={() => shiftMonth(1)}
                        disabled={!canGoNext}
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

                        const dayClassName = [
                            'delivery-coord-day',
                            cell.disabled ? 'is-disabled' : '',
                            cell.isToday ? 'is-today' : '',
                            cell.isSelected ? 'is-selected' : '',
                        ].filter(Boolean).join(' ');

                        return (
                            <button
                                key={cell.key}
                                type="button"
                                className={dayClassName}
                                disabled={cell.disabled}
                                aria-pressed={cell.isSelected}
                                aria-current={cell.isToday ? 'date' : undefined}
                                aria-label={formatAriaDate(cell.iso)}
                                onClick={() => selectDate(cell.iso)}
                            >
                                {cell.day}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="form-date-picker-footer">
                <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={todayDisabled}
                    onClick={() => selectDate(todayIso)}
                >
                    Hoy
                </button>
            </div>
        </div>
    ) : null;

    return (
        <div
            ref={rootRef}
            className={`form-date-picker${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        >
            <button
                ref={triggerRef}
                type="button"
                id={id}
                className={`form-input form-date-picker-trigger${open ? ' is-open' : ''}`}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={ariaLabel || 'Seleccionar fecha'}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span className={display ? undefined : 'form-date-picker-placeholder'}>
                    {display || 'Seleccionar fecha'}
                </span>
                <i className="bi bi-calendar3" aria-hidden="true"></i>
            </button>

            {typeof document !== 'undefined' && panel
                ? createPortal(panel, document.body)
                : null}
        </div>
    );
};

export default FormDatePicker;
