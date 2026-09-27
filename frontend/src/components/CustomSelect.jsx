import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * CustomSelect - Componente de selección unificado para AFINIX LAB
 * 
 * Reemplaza selectores nativos <select> por una experiencia moderna,
 * estilizada, accesible y con soporte para iconos, chips, búsqueda y portal.
 * 
 * @param {Array<{ value: string|number, label: string, icon?: string, dotColor?: string, disabled?: boolean }>} [props.options]
 * @param {React.ReactNode} [props.children] - Opcional: <option value="...">...</option> como fallback compatible
 * @param {string|number} props.value
 * @param {Function} props.onChange - Recibe (syntheticEvent, value, option)
 * @param {string} [props.placeholder='Seleccionar...']
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.size='md'] - 'sm' | 'md'
 * @param {string} [props.variant='default'] - 'default' | 'pill'
 * @param {boolean} [props.searchable] - Mostrar buscador (por defecto si > 7 opciones)
 * @param {string} [props.className='']
 * @param {string} [props.id]
 * @param {string} [props['aria-label']]
 */
export default function CustomSelect({
    options,
    children,
    value = '',
    onChange,
    placeholder = 'Seleccionar...',
    disabled = false,
    size = 'md',
    variant = 'default',
    searchable,
    className = '',
    id,
    'aria-label': ariaLabel,
    style,
}) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    // Normalizar opciones (desde prop options o parseando children <option>)
    const normalizedOptions = useMemo(() => {
        if (Array.isArray(options)) {
            return options.map((opt) => {
                if (typeof opt === 'object' && opt !== null) {
                    return {
                        value: opt.value ?? '',
                        label: opt.label !== undefined ? String(opt.label) : String(opt.value ?? ''),
                        icon: opt.icon,
                        dotColor: opt.dotColor,
                        disabled: Boolean(opt.disabled),
                    };
                }
                return {
                    value: String(opt),
                    label: String(opt),
                };
            });
        }

        if (children) {
            return React.Children.toArray(children)
                .filter(Boolean)
                .map((child) => {
                    if (child.type === 'option') {
                        return {
                            value: child.props.value ?? '',
                            label: child.props.children ? String(child.props.children) : String(child.props.value ?? ''),
                            disabled: Boolean(child.props.disabled),
                        };
                    }
                    return null;
                })
                .filter(Boolean);
        }

        return [];
    }, [options, children]);

    // Opción actualmente seleccionada
    const selectedOption = useMemo(() => {
        return normalizedOptions.find((opt) => String(opt.value) === String(value));
    }, [normalizedOptions, value]);

    // Determinar si activar búsqueda
    const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length > 7;

    // Filtrar opciones por búsqueda
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return normalizedOptions;
        const term = searchTerm.toLowerCase();
        return normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(term));
    }, [normalizedOptions, searchTerm]);

    // Posicionamiento dinámico (portal flotante sin desbordamiento)
    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const minWidth = Math.max(rect.width, 210);
        const padding = 12;

        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const spaceAbove = rect.top - 8;
        const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;

        let left = rect.left;
        if (left + minWidth > window.innerWidth - padding) {
            left = window.innerWidth - padding - minWidth;
        }
        left = Math.max(padding, left);

        if (openUp) {
            setMenuStyle({
                position: 'fixed',
                bottom: window.innerHeight - rect.top + 6,
                left,
                width: minWidth,
                maxHeight: Math.min(300, spaceAbove),
            });
        } else {
            setMenuStyle({
                position: 'fixed',
                top: rect.bottom + 6,
                left,
                width: minWidth,
                maxHeight: Math.min(300, spaceBelow),
            });
        }
    }, []);

    useLayoutEffect(() => {
        if (!open) {
            setMenuStyle(null);
            setSearchTerm('');
            return undefined;
        }

        updatePosition();

        const handleReposition = () => updatePosition();
        window.addEventListener('resize', handleReposition);
        window.addEventListener('scroll', handleReposition, true);

        return () => {
            window.removeEventListener('resize', handleReposition);
            window.removeEventListener('scroll', handleReposition, true);
        };
    }, [open, updatePosition]);

    // Cerrar al hacer click afuera o presionar Escape
    useEffect(() => {
        if (!open) return undefined;

        const handlePointerDown = (e) => {
            const target = e.target;
            if (!(target instanceof Node)) return;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    // Autofocus en buscador al abrir
    useEffect(() => {
        if (open && isSearchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [open, isSearchable]);

    const handleSelect = (option) => {
        if (option.disabled) return;
        const syntheticEvent = {
            target: {
                value: option.value,
                id,
                name: id,
            },
        };
        onChange?.(syntheticEvent, option.value, option);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const triggerClass = [
        'afinix-select-trigger',
        size === 'sm' ? 'afinix-select-trigger--sm' : '',
        variant === 'pill' ? 'afinix-select-trigger--pill' : '',
        open ? 'is-open' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className="afinix-select-wrap" style={style}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                className={triggerClass}
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={ariaLabel || placeholder}
            >
                <span className="afinix-select-label-wrap">
                    {selectedOption?.dotColor && (
                        <span
                            className="pedidos-filter-dot"
                            style={{ backgroundColor: selectedOption.dotColor }}
                            aria-hidden="true"
                        />
                    )}
                    {selectedOption?.icon && (
                        <i className={`bi ${selectedOption.icon}`} aria-hidden="true" style={{ fontSize: '0.85rem' }} />
                    )}
                    <span className={`afinix-select-label-text${!selectedOption ? ' afinix-select-label-placeholder' : ''}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </span>
                <i className={`bi bi-chevron-down afinix-select-chevron${open ? ' is-rotated' : ''}`} aria-hidden="true" />
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="afinix-select-menu-portal"
                    style={menuStyle || { position: 'fixed', visibility: 'hidden' }}
                    role="listbox"
                    aria-label={ariaLabel || placeholder}
                >
                    {isSearchable && (
                        <div className="afinix-select-search-wrap">
                            <i className="bi bi-search afinix-select-search-icon" aria-hidden="true" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="afinix-select-search-input"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    <div className="afinix-select-list">
                        {filteredOptions.length === 0 ? (
                            <div className="afinix-select-empty">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        className={`afinix-select-item${isSelected ? ' is-selected' : ''}`}
                                        disabled={opt.disabled}
                                        onClick={() => handleSelect(opt)}
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        {opt.dotColor && (
                                            <span
                                                className="pedidos-filter-dot"
                                                style={{ backgroundColor: opt.dotColor }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        {opt.icon && (
                                            <i className={`bi ${opt.icon}`} aria-hidden="true" style={{ fontSize: '0.85rem' }} />
                                        )}
                                        <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {opt.label}
                                        </span>
                                        {isSelected && (
                                            <i
                                                className="bi bi-check2 text-primary"
                                                style={{ marginLeft: 'auto', fontWeight: 800 }}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
