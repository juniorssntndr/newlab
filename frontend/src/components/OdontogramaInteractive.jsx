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
    isMolarTooth,
    getBridgeParts
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
    const bridgeParts = getBridgeParts(selection);
    const disabledTeeth = useMemo(
        () => new Set(isVeneer ? ARCH_ORDER.filter((tooth) => isMolarTooth(tooth)) : []),
        [isVeneer]
    );

    const toggleBridgePillar = useCallback((tooth) => {
        if (!isBridge || disabled || disabledTeeth.has(tooth)) return;
        if (!selection?.es_puente || currentTeeth.length < 2 || !selectedSet.has(tooth)) return;

        const currentPillars = normalizeBridgePillars(currentTeeth, selection?.pilares_dentales || []);
        const isActivePillar = currentPillars.includes(tooth);
        let nextPillars;

        if (isActivePillar) {
            nextPillars = currentPillars.filter((value) => value !== tooth);
            if (nextPillars.length < 2) {
                setBridgeHint('El puente debe conservar al menos 2 pilares activos.');
                return;
            }
        } else {
            nextPillars = sortTeethByArchOrder([...currentPillars, tooth]);
        }

        setBridgeHint('');
        onChange(buildItemSelection(currentTeeth, true, nextPillars));
    }, [currentTeeth, disabled, disabledTeeth, isBridge, onChange, selectedSet, selection?.es_puente, selection?.pilares_dentales]);

    React.useEffect(() => {
        const stopDragging = () => {
            if (isBridge && bridgePointerMode === 'toggle' && !bridgeDidDrag && bridgePointerStart) {
                toggleBridgePillar(bridgePointerStart);
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
    }, [bridgeDidDrag, bridgePointerMode, bridgePointerStart, isBridge, toggleBridgePillar]);

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

    const applyBridgeRange = (startTooth, endTooth) => {
        const range = buildBridgeRange(startTooth, endTooth).filter((tooth) => !disabledTeeth.has(tooth));
        if (isBridge && startTooth !== endTooth && range.length <= 1) {
            setBridgeHint('El puente debe marcarse dentro del mismo arco (superior o inferior).');
        } else {
            setBridgeHint('');
        }

        const preservedPillars = normalizeBridgePillars(currentTeeth, selection?.pilares_dentales || [])
            .filter((tooth) => range.includes(tooth));

        const nextPillars = range.length > 1
            ? sortTeethByArchOrder([...preservedPillars, range[0], range[range.length - 1]])
            : [];

        onChange(buildItemSelection(range, true, nextPillars));
    };

    const handlePointerDown = (event, tooth) => {
        event.preventDefault();
        if (disabled) return;
        if (disabledTeeth.has(tooth)) return;

        if (isBridge) {
            const isSingleSelected = !selection?.es_puente && currentTeeth.length === 1 && currentTeeth[0] === tooth;
            if (isSingleSelected) {
                commitSelection([]);
                setBridgeAnchor(null);
                setBridgePointerMode(null);
                setBridgePointerStart(null);
                setBridgeDidDrag(false);
                return;
            }

            setBridgeAnchor(tooth);
            setBridgePointerStart(tooth);
            setBridgeDidDrag(false);
            setIsDragging(true);

            const isInsideCurrentBridge = selection?.es_puente && currentTeeth.length > 1 && selectedSet.has(tooth);
            if (isInsideCurrentBridge) {
                setBridgePointerMode('toggle');
                return;
            }

            setBridgePointerMode('range');
            applyBridgeRange(tooth, tooth);
            return;
        }

        const shouldSelect = !selectedSet.has(tooth);
        setDragSelectValue(shouldSelect);
        setIsDragging(true);
        handleNormalToggle(tooth, shouldSelect);
    };

    const handlePointerEnter = (tooth) => {
        if (disabled || !isDragging || disabledTeeth.has(tooth)) return;

        if (isBridge && bridgeAnchor) {
            if (bridgePointerMode === 'toggle') {
                if (tooth !== bridgePointerStart) {
                    setBridgePointerMode('range');
                    setBridgeDidDrag(true);
                    applyBridgeRange(bridgeAnchor, tooth);
                }
                return;
            }

            if (tooth !== bridgePointerStart) {
                setBridgeDidDrag(true);
            }
            applyBridgeRange(bridgeAnchor, tooth);
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

    const bridgePoints = useMemo(() => {
        if (!selection?.es_puente || currentTeeth.length < 2) return null;

        const validPoints = currentTeeth
            .filter((tooth) => visibleToothSet.has(tooth))
            .map((tooth) => toothCenters[tooth])
            .filter(Boolean);

        if (validPoints.length < 2) return null;

        return validPoints.map((p) => `${p.x},${p.y}`).join(' ');
    }, [selection?.es_puente, currentTeeth, toothCenters, visibleToothSet]);

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

                            {bridgePoints && (
                                <polyline
                                    points={bridgePoints}
                                    className="bridge-connector"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter={isMinimal ? undefined : 'url(#softGlow)'}
                                />
                            )}

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

                            {selection?.es_puente && visibleToothCodes.map((toothCode) => {
                                const center = toothCenters[toothCode];
                                if (!center) return null;
                                const roleY = isMinimal ? center.y - 28 : center.y - 17;
                                if (bridgeParts.pilares.includes(toothCode)) {
                                    return (
                                        <text key={`role-p-${toothCode}`} x={center.x} y={roleY} textAnchor="middle" className="bridge-role-label pillar">
                                            P
                                        </text>
                                    );
                                }
                                if (bridgeParts.ponticos.includes(toothCode)) {
                                    return (
                                        <text key={`role-pt-${toothCode}`} x={center.x} y={roleY} textAnchor="middle" className="bridge-role-label pontic">
                                            Pt
                                        </text>
                                    );
                                }
                                return null;
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
                                <span>Puente detectado</span>
                                <strong>{selection.pieza_inicio} - {selection.pieza_fin}</strong>
                                <p>
                                    Pilares: {bridgeParts.pilares.join(', ') || '—'}
                                    {bridgeParts.ponticos.length > 0 ? ` | Ponticos: ${bridgeParts.ponticos.join(', ')}` : ''}
                                </p>
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
