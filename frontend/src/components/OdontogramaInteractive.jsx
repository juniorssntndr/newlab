import React, { useCallback, useMemo, useState } from 'react';
import {
    ARCH_ORDER,
    UPPER_ARCH,
    LOWER_ARCH,
    sortTeethByArchOrder,
    buildBridgeRange,
    buildItemSelection,
    normalizeBridgePillars,
    isBridgeProduct,
    isVeneerProduct,
    isArchProduct,
    toggleFullArch,
    isMolarTooth,
    getBridgeParts,
    connectBridgeSpan,
    toggleBridgeToothRole,
    addUnitTooth,
    removeTooth
} from '../utils/odontograma.js';
import { ODONTOGRAM_TOOTH_PATHS, ODONTOGRAM_QUADRANTS, buildToothCenters } from './odontogramaShapes.js';
import {
    AFFINITY_VIEWBOX,
    AFFINITY_UPPER_VIEWBOX,
    AFFINITY_LOWER_VIEWBOX,
    AFFINITY_DECORATIONS,
    AFFINITY_TEETH,
    AFFINITY_ARCH_ORDER,
    buildAffinityToothCenters,
    buildAffinityToothLabels
} from './odontogramaAffinityShapes.js';

const CLASSIC_VIEWBOX = '-4 -4 417 702';
const CLASSIC_UPPER_VIEWBOX = '-4 -4 417 355';
const CLASSIC_LOWER_VIEWBOX = '-4 345 417 355';
const UPPER_ARCH_SET = new Set(UPPER_ARCH);
const LOWER_ARCH_SET = new Set(LOWER_ARCH);

const resolveArch = (arch) => (
    arch === 'upper' || arch === 'lower' ? arch : 'both'
);

const OdontogramaInteractive = ({
    product,
    selection,
    onChange,
    title = 'Odontograma Interactivo',
    showSidePanel = true,
    showProductPill = true,
    showHeader = true,
    preserveAspectRatio = 'xMidYMid meet',
    disabled = false,
    variant = 'classic',
    arch = 'both'
}) => {
    const isMinimal = variant === 'minimal';
    const activeArch = resolveArch(arch);
    const [isDragging, setIsDragging] = useState(false);
    const [dragSelectValue, setDragSelectValue] = useState(true);
    const [bridgeAnchor, setBridgeAnchor] = useState(null);
    const [bridgePointerMode, setBridgePointerMode] = useState(null);
    const [bridgePointerStart, setBridgePointerStart] = useState(null);
    const [bridgeDidDrag, setBridgeDidDrag] = useState(false);
    const [bridgeHint, setBridgeHint] = useState('');
    const toothCenters = useMemo(
        () => (isMinimal ? buildAffinityToothCenters() : buildToothCenters()),
        [isMinimal]
    );
    const toothLabels = useMemo(
        () => (isMinimal ? buildAffinityToothLabels() : null),
        [isMinimal]
    );
    const visibleToothCodes = useMemo(() => {
        const order = isMinimal ? AFFINITY_ARCH_ORDER : ARCH_ORDER;
        if (activeArch === 'upper') return order.filter((code) => UPPER_ARCH_SET.has(code));
        if (activeArch === 'lower') return order.filter((code) => LOWER_ARCH_SET.has(code));
        return order;
    }, [activeArch, isMinimal]);
    const visibleQuadrants = useMemo(() => {
        if (isMinimal || activeArch === 'both') return ODONTOGRAM_QUADRANTS;
        if (activeArch === 'upper') {
            return ODONTOGRAM_QUADRANTS.filter((q) => q.prefix === '1' || q.prefix === '2');
        }
        return ODONTOGRAM_QUADRANTS.filter((q) => q.prefix === '3' || q.prefix === '4');
    }, [activeArch, isMinimal]);
    const svgViewBox = useMemo(() => {
        if (isMinimal) {
            if (activeArch === 'upper') return AFFINITY_UPPER_VIEWBOX;
            if (activeArch === 'lower') return AFFINITY_LOWER_VIEWBOX;
            return AFFINITY_VIEWBOX;
        }
        if (activeArch === 'upper') return CLASSIC_UPPER_VIEWBOX;
        if (activeArch === 'lower') return CLASSIC_LOWER_VIEWBOX;
        return CLASSIC_VIEWBOX;
    }, [activeArch, isMinimal]);
    const showUpperDecor = activeArch === 'both' || activeArch === 'upper';
    const showLowerDecor = activeArch === 'both' || activeArch === 'lower';

    const currentTeeth = useMemo(() => sortTeethByArchOrder(selection?.piezas_dentales || []), [selection?.piezas_dentales]);
    const selectedSet = useMemo(() => new Set(currentTeeth), [currentTeeth]);

    const isBridge = isBridgeProduct(product);
    const isVeneer = isVeneerProduct(product);
    const isArch = isArchProduct(product);
    const bridgeParts = getBridgeParts(selection);
    // Para carillas se admiten todas las piezas (incluyendo oclusales/molares)
    const disabledTeeth = useMemo(() => new Set(), []);

    const toggleBridgePillar = useCallback((tooth) => {
        if (!isBridge || disabled || disabledTeeth.has(tooth)) return;
        const { selection: nextSel, error } = toggleBridgeToothRole(selection, tooth);
        if (error) {
            setBridgeHint(error);
        } else {
            setBridgeHint('');
            onChange(nextSel);
        }
    }, [disabled, disabledTeeth, isBridge, onChange, selection]);

    React.useEffect(() => {
        const stopDragging = () => {
            if (isBridge && !bridgeDidDrag && bridgePointerStart) {
                if (bridgePointerMode === 'toggle') {
                    toggleBridgePillar(bridgePointerStart);
                } else if (bridgePointerMode === 'unit') {
                    const isSelected = selectedSet.has(bridgePointerStart);
                    if (isSelected) {
                        const nextSel = removeTooth(selection, bridgePointerStart);
                        onChange(nextSel);
                    } else {
                        const nextSel = addUnitTooth(selection, bridgePointerStart);
                        onChange(nextSel);
                    }
                }
            }

            setIsDragging(false);
            setDragSelectValue(true);
            setBridgeAnchor(null);
            setBridgePointerMode(null);
            setBridgePointerStart(null);
            setBridgeDidDrag(false);
        };

        window.addEventListener('pointerup', stopDragging, { passive: true });
        window.addEventListener('pointercancel', stopDragging, { passive: true });

        return () => {
            window.removeEventListener('pointerup', stopDragging);
            window.removeEventListener('pointercancel', stopDragging);
        };
    }, [bridgeDidDrag, bridgePointerMode, bridgePointerStart, isBridge, onChange, selectedSet, selection, toggleBridgePillar]);

    const commitSelection = (nextTeeth) => {
        const payload = buildItemSelection(nextTeeth, isBridge);
        onChange(payload);
    };

    const handleNormalToggle = (tooth, shouldSelect) => {
        const next = new Set(currentTeeth);
        if (shouldSelect) {
            next.add(tooth);
        } else {
            next.delete(tooth);
        }
        commitSelection([...next]);
    };

    const handlePointerDown = (event, tooth) => {
        event.preventDefault();
        if (disabled) return;
        if (disabledTeeth.has(tooth)) return;

        if (isArch) {
            const isUpper = UPPER_ARCH_SET.has(tooth);
            const nextSelection = toggleFullArch(selection, isUpper ? 'upper' : 'lower');
            onChange(nextSelection);
            return;
        }

        if (isBridge) {
            setBridgeAnchor(tooth);
            setBridgePointerStart(tooth);
            setBridgeDidDrag(false);
            setIsDragging(true);

            const spans = selection?.tramos_detalle || [];
            const isInsideBridge = spans.some((s) => s.tipo === 'puente' && s.piezas.includes(tooth));

            if (isInsideBridge) {
                setBridgePointerMode('toggle');
                return;
            }

            setBridgePointerMode('unit');
            return;
        }

        const shouldSelect = !selectedSet.has(tooth);
        setDragSelectValue(shouldSelect);
        setIsDragging(true);
        handleNormalToggle(tooth, shouldSelect);
    };

    const handlePointerEnter = (tooth) => {
        if (disabled || !isDragging || disabledTeeth.has(tooth)) return;
        if (isArch) return;

        if (isBridge && bridgeAnchor) {
            if (tooth !== bridgePointerStart) {
                setBridgeDidDrag(true);
                const isUpper = UPPER_ARCH_SET.has(bridgeAnchor) && UPPER_ARCH_SET.has(tooth);
                const isLower = LOWER_ARCH_SET.has(bridgeAnchor) && LOWER_ARCH_SET.has(tooth);
                if (!isUpper && !isLower) {
                    setBridgeHint('El puente debe marcarse dentro del mismo arco (superior o inferior).');
                    return;
                }
                setBridgeHint('');
                const nextSelection = connectBridgeSpan(selection, bridgeAnchor, tooth);
                onChange(nextSelection);
            }
            return;
        }

        if (!isBridge) {
            handleNormalToggle(tooth, dragSelectValue);
        }
    };

    const handlePointerMove = (event) => {
        if (disabled) return;
        if (!isDragging) return;
        const hitTarget = document.elementFromPoint(event.clientX, event.clientY);
        const toothNode = hitTarget?.closest?.('[data-tooth-code]');
        const tooth = toothNode?.getAttribute?.('data-tooth-code');
        if (!tooth) return;
        handlePointerEnter(tooth);
    };

    const getToothClassName = (tooth) => {
        const classes = ['tooth-node'];
        if (selectedSet.has(tooth)) classes.push('is-selected');
        if (disabledTeeth.has(tooth)) classes.push('is-disabled');
        if (bridgeParts.pilares.includes(tooth)) classes.push('is-pillar');
        if (bridgeParts.ponticos.includes(tooth)) classes.push('is-pontic');
        return classes.join(' ');
    };

    const visibleToothSet = useMemo(() => new Set(visibleToothCodes), [visibleToothCodes]);

    const bridgePolylines = useMemo(() => {
        const spans = selection?.tramos_detalle;
        if (Array.isArray(spans) && spans.length > 0) {
            return spans
                .filter((tramo) => tramo.tipo === 'puente' && tramo.piezas?.length > 1)
                .map((tramo) => {
                    const validPoints = tramo.piezas
                        .filter((tooth) => visibleToothSet.has(tooth))
                        .map((tooth) => toothCenters[tooth])
                        .filter(Boolean);
                    if (validPoints.length < 2) return null;
                    return {
                        id: tramo.id || `${tramo.piezas[0]}-${tramo.piezas[tramo.piezas.length - 1]}`,
                        points: validPoints.map((p) => `${p.x},${p.y}`).join(' ')
                    };
                })
                .filter(Boolean);
        }

        if (!selection?.es_puente || currentTeeth.length < 2) return [];
        const validPoints = currentTeeth
            .filter((tooth) => visibleToothSet.has(tooth))
            .map((tooth) => toothCenters[tooth])
            .filter(Boolean);
        if (validPoints.length < 2) return [];
        return [{ id: 'legacy-bridge', points: validPoints.map((p) => `${p.x},${p.y}`).join(' ') }];
    }, [currentTeeth, selection?.es_puente, selection?.tramos_detalle, toothCenters, visibleToothSet]);

    return (
        <div className={`odontograma-shell${disabled ? ' is-readonly' : ''}${isMinimal ? ' is-minimal' : ''} is-arch-${activeArch}`}>
            {showHeader && (
                <div className="odontograma-header">
                    <div>
                        <h4>{title}</h4>
                        <p>
                            {isBridge
                                ? 'Arrastra para definir el tramo del puente y luego haz clic en cualquier pieza del tramo para alternar pilar o póntico.'
                                : 'Modo sello activo. Haz clic o arrastra (o desliza con el dedo) sobre las piezas para asignar el producto.'}
                        </p>
                        {bridgeHint && <p className="odontograma-hint">{bridgeHint}</p>}
                    </div>
                    {showProductPill && <span className="odontograma-product-pill">{product?.nombre || 'Producto seleccionado'}</span>}
                </div>
            )}

            <div className={`odontograma-bento ${showSidePanel ? '' : 'odontograma-bento-single'}`.trim()}>
                <section className="odontograma-panel">
                    <div className="odontograma-stage">
                        <svg
                            viewBox={svgViewBox}
                            preserveAspectRatio={preserveAspectRatio}
                            className="odontograma-svg"
                            role="img"
                            aria-label="Mapa dental FDI"
                            onPointerMove={handlePointerMove}
                            aria-disabled={disabled}
                        >
                            {!isMinimal && (
                                <defs>
                                    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                        <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>
                            )}

                            {isMinimal && (
                                <g className="odontograma-decor" aria-hidden="true">
                                    {showUpperDecor
                                        ? (AFFINITY_DECORATIONS.maxilarSuperior || [])
                                            .filter((d) => d.length < 500)
                                            .map((d, index) => (
                                                <path key={`max-sup-${index}`} className="odontograma-arch-guide" d={d} />
                                            ))
                                        : null}
                                    {showUpperDecor && AFFINITY_DECORATIONS.baseSuperior ? (
                                        <path className="odontograma-arch-outline" d={AFFINITY_DECORATIONS.baseSuperior} />
                                    ) : null}
                                    {showLowerDecor && AFFINITY_DECORATIONS.maxilarInferior ? (
                                        <path className="odontograma-arch-outline" d={AFFINITY_DECORATIONS.maxilarInferior} />
                                    ) : null}
                                </g>
                            )}

                            {bridgePolylines.map((bp) => (
                                <polyline
                                    key={`bridge-line-${bp.id}`}
                                    points={bp.points}
                                    className="bridge-connector"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter={isMinimal ? undefined : 'url(#softGlow)'}
                                />
                            ))}

                            {isMinimal
                                ? visibleToothCodes.map((toothCode) => {
                                    const tooth = AFFINITY_TEETH[toothCode];
                                    if (!tooth) return null;
                                    return (
                                        <g
                                            key={toothCode}
                                            id={`tooth-${toothCode}`}
                                            onPointerDown={(event) => handlePointerDown(event, toothCode)}
                                            onPointerEnter={() => handlePointerEnter(toothCode)}
                                            className={getToothClassName(toothCode)}
                                            data-tooth-code={toothCode}
                                        >
                                            <path className="tooth-outline" d={tooth.d} />
                                        </g>
                                    );
                                })
                                : visibleQuadrants.map((quadrant) => (
                                    <g key={quadrant.prefix} transform={quadrant.transform}>
                                        {ODONTOGRAM_TOOTH_PATHS.map((tooth) => {
                                            const toothCode = `${quadrant.prefix}${tooth.name}`;
                                            return (
                                                <g
                                                    key={toothCode}
                                                    onPointerDown={(event) => handlePointerDown(event, toothCode)}
                                                    onPointerEnter={() => handlePointerEnter(toothCode)}
                                                    className={getToothClassName(toothCode)}
                                                    data-tooth-code={toothCode}
                                                >
                                                    <path className="tooth-outline" d={tooth.outlinePath} />
                                                    <path className="tooth-fill" d={tooth.shadowPath} />
                                                    {Array.isArray(tooth.lineHighlightPath)
                                                        ? tooth.lineHighlightPath.map((segment) => (
                                                            <path className="tooth-groove" key={`${toothCode}-${segment}`} d={segment} />
                                                        ))
                                                        : <path className="tooth-groove" d={tooth.lineHighlightPath} />}
                                                </g>
                                            );
                                        })}
                                    </g>
                                ))}

                            {visibleToothCodes.map((toothCode) => {
                                const center = toothCenters[toothCode];
                                if (!center) return null;
                                const isSelected = selectedSet.has(toothCode);
                                const labelPoint = toothLabels?.[toothCode] || {
                                    x: center.x,
                                    y: isMinimal ? center.y - 18 : center.y + 4
                                };
                                return (
                                    <g key={`label-${toothCode}`} pointerEvents="none">
                                        {isMinimal && isSelected ? (
                                            <circle
                                                className="tooth-selected-dot"
                                                cx={center.x}
                                                cy={center.y}
                                                r={9}
                                            />
                                        ) : null}
                                        <text
                                            x={labelPoint.x}
                                            y={labelPoint.y}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            className={`tooth-code${isSelected ? ' is-selected' : ''}`}
                                        >
                                            {toothCode}
                                        </text>
                                    </g>
                                );
                            })}

                        </svg>
                    </div>
                    {bridgeHint && !showHeader && <p className="odontograma-inline-hint">{bridgeHint}</p>}
                </section>

                {showSidePanel && (
                    <aside className="odontograma-side">
                        <article className="odontograma-stat">
                            <span>Piezas seleccionadas</span>
                            <strong>{currentTeeth.length}</strong>
                            <p>{currentTeeth.length ? currentTeeth.join(', ') : 'Aun sin seleccion'}</p>
                            <p className="odontograma-help-text">
                                {isBridge
                                    ? 'Arrastra para definir el tramo. Luego haz clic en una pieza del tramo para alternar pilar o pontico.'
                                    : 'Click para una pieza, arrastra para varias.'}
                            </p>
                        </article>

                        {selection?.es_puente && (
                            <article className="odontograma-stat">
                                <span>Tramos configurados</span>
                                {Array.isArray(selection.tramos_detalle) && selection.tramos_detalle.length > 0 ? (
                                    selection.tramos_detalle.map((tramo, idx) => (
                                        <div key={tramo.id || idx} style={{ marginBottom: '0.4rem' }}>
                                            {tramo.tipo === 'puente' ? (
                                                <>
                                                    <strong>Puente {tramo.piezas[0]} - {tramo.piezas[tramo.piezas.length - 1]}</strong>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem' }}>
                                                        Pilares: {tramo.pilares.join(', ') || '—'}
                                                        {tramo.ponticos.length > 0 ? ` | Pónticos: ${tramo.ponticos.join(', ')}` : ''}
                                                    </p>
                                                </>
                                            ) : (
                                                <strong>Unitaria: {tramo.piezas.join(', ')}</strong>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <strong>{selection.pieza_inicio} - {selection.pieza_fin}</strong>
                                        <p>
                                            Pilares: {bridgeParts.pilares.join(', ') || '—'}
                                            {bridgeParts.ponticos.length > 0 ? ` | Pónticos: ${bridgeParts.ponticos.join(', ')}` : ''}
                                        </p>
                                    </>
                                )}
                                <p className="odontograma-help-text">El puente debe conservar al menos 2 pilares activos.</p>
                            </article>
                        )}

                        {isVeneer && (
                            <article className="odontograma-stat warning">
                                <span>Validacion de carilla</span>
                                <strong>Molares bloqueados</strong>
                                <p>Las piezas posteriores (16-18, 26-28, 36-38, 46-48) no estan disponibles.</p>
                            </article>
                        )}

                        <article className="odontograma-legend">
                            <div><i className="legend-dot selected"></i> Seleccionada</div>
                            {isBridge && <div><i className="legend-dot pillar"></i> Pilar</div>}
                            {isBridge && <div><i className="legend-dot pontic"></i> Pontico</div>}
                            <div><i className="legend-dot disabled"></i> Deshabilitada</div>
                            {isBridge && <p className="odontograma-legend-note">Pilar soporta el puente y pontico reemplaza la pieza intermedia.</p>}
                        </article>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default OdontogramaInteractive;
