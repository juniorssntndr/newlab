import React, { useMemo, useState } from 'react';
import {
    ARCH_ORDER,
    sortTeethByArchOrder,
    buildBridgeRange,
    buildItemSelection,
    isBridgeProduct,
    isVeneerProduct,
    isMolarTooth,
    getBridgeParts
} from '../utils/odontograma.js';
import { ODONTOGRAM_TOOTH_PATHS, ODONTOGRAM_QUADRANTS, buildToothCenters } from './odontogramaShapes.js';

const OdontogramaInteractive = ({
    product,
    selection,
    onChange,
    title = 'Odontograma Interactivo',
    showSidePanel = true,
    showProductPill = true,
    showHeader = true
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragSelectValue, setDragSelectValue] = useState(true);
    const [bridgeAnchor, setBridgeAnchor] = useState(null);
    const [bridgeHint, setBridgeHint] = useState('');
    const toothCenters = useMemo(() => buildToothCenters(), []);

    const currentTeeth = useMemo(() => sortTeethByArchOrder(selection?.piezas_dentales || []), [selection?.piezas_dentales]);
    const selectedSet = useMemo(() => new Set(currentTeeth), [currentTeeth]);

    const isBridge = isBridgeProduct(product);
    const isVeneer = isVeneerProduct(product);
    const bridgeParts = getBridgeParts(selection);
    const disabledTeeth = useMemo(
        () => new Set(isVeneer ? ARCH_ORDER.filter((tooth) => isMolarTooth(tooth)) : []),
        [isVeneer]
    );

    React.useEffect(() => {
        const stopDragging = () => {
            setIsDragging(false);
            setDragSelectValue(true);
            setBridgeAnchor(null);
        };

        window.addEventListener('pointerup', stopDragging, { passive: true });
        window.addEventListener('pointercancel', stopDragging, { passive: true });

        return () => {
            window.removeEventListener('pointerup', stopDragging);
            window.removeEventListener('pointercancel', stopDragging);
        };
    }, []);

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
        commitSelection(range);
    };

    const handlePointerDown = (event, tooth) => {
        event.preventDefault();
        if (disabledTeeth.has(tooth)) return;

        if (isBridge) {
            const isSingleSelected = currentTeeth.length === 1 && currentTeeth[0] === tooth;
            if (isSingleSelected) {
                commitSelection([]);
                setBridgeAnchor(null);
                return;
            }
            setBridgeAnchor(tooth);
            setIsDragging(true);
            applyBridgeRange(tooth, tooth);
            return;
        }

        const shouldSelect = !selectedSet.has(tooth);
        setDragSelectValue(shouldSelect);
        setIsDragging(true);
        handleNormalToggle(tooth, shouldSelect);
    };

    const handlePointerEnter = (tooth) => {
        if (!isDragging || disabledTeeth.has(tooth)) return;

        if (isBridge && bridgeAnchor) {
            applyBridgeRange(bridgeAnchor, tooth);
            return;
        }

        if (!isBridge) {
            handleNormalToggle(tooth, dragSelectValue);
        }
    };

    const handlePointerMove = (event) => {
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

    const bridgePoints = useMemo(() => {
        if (!selection?.es_puente || currentTeeth.length < 2) return null;
        
        const validPoints = currentTeeth
            .map(tooth => toothCenters[tooth])
            .filter(Boolean);
            
        if (validPoints.length < 2) return null;
        
        return validPoints.map(p => `${p.x},${p.y}`).join(' ');
    }, [selection?.es_puente, currentTeeth, toothCenters]);

    return (
        <div className="odontograma-shell">
            {showHeader && (
                <div className="odontograma-header">
                    <div>
                        <h4>{title}</h4>
                        <p>Modo sello activo. Haz clic o arrastra (o desliza con el dedo) sobre las piezas para asignar el producto.</p>
                        {bridgeHint && <p className="odontograma-hint">{bridgeHint}</p>}
                    </div>
                    {showProductPill && <span className="odontograma-product-pill">{product?.nombre || 'Producto seleccionado'}</span>}
                </div>
            )}

            <div className={`odontograma-bento ${showSidePanel ? '' : 'odontograma-bento-single'}`.trim()}>
                <section className="odontograma-panel">
                    <div className="odontograma-stage">
                        <svg
                            viewBox="12 0 372 694"
                            preserveAspectRatio="xMidYMid meet"
                            className="odontograma-svg"
                            role="img"
                            aria-label="Mapa dental FDI"
                            onPointerMove={handlePointerMove}
                        >
                            <defs>
                                <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>

                            {bridgePoints && (
                                <polyline
                                    points={bridgePoints}
                                    className="bridge-connector"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    filter="url(#softGlow)"
                                />
                            )}

                            {ODONTOGRAM_QUADRANTS.map((quadrant) => (
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

                            {ARCH_ORDER.map((toothCode) => {
                                const center = toothCenters[toothCode];
                                if (!center) return null;
                                return (
                                    <text key={`label-${toothCode}`} x={center.x} y={center.y + 4} textAnchor="middle" className="tooth-code">
                                        {toothCode}
                                    </text>
                                );
                            })}

                            {selection?.es_puente && ARCH_ORDER.map((toothCode) => {
                                const center = toothCenters[toothCode];
                                if (!center) return null;
                                if (bridgeParts.pilares.includes(toothCode)) {
                                    return (
                                        <text key={`role-p-${toothCode}`} x={center.x} y={center.y - 17} textAnchor="middle" className="bridge-role-label pillar">
                                            P
                                        </text>
                                    );
                                }
                                if (bridgeParts.ponticos.includes(toothCode)) {
                                    return (
                                        <text key={`role-pt-${toothCode}`} x={center.x} y={center.y - 17} textAnchor="middle" className="bridge-role-label pontic">
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
                                    ? 'Puente: extremos = pilares, intermedios = ponticos.'
                                    : 'Click para una pieza, arrastra para varias.'}
                            </p>
                        </article>

                        {selection?.es_puente && (
                            <article className="odontograma-stat">
                                <span>Puente detectado</span>
                                <strong>{selection.pieza_inicio} - {selection.pieza_fin}</strong>
                                <p>
                                    Pilares: {bridgeParts.pilares.join(' y ') || '—'}
                                    {bridgeParts.ponticos.length > 0 ? ` | Ponticos: ${bridgeParts.ponticos.join(', ')}` : ''}
                                </p>
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
