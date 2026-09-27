import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import '../../styles/agent-inspector.css';

/**
 * Extrae el nombre del componente React a través de las propiedades internas de React Fiber
 */
function getReactComponentInfo(domNode) {
    if (!domNode) return null;
    try {
        const fiberKey = Object.keys(domNode).find(
            (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
        );
        if (!fiberKey) return null;

        let fiber = domNode[fiberKey];
        const components = [];

        while (fiber) {
            if (fiber.type) {
                let name = null;
                if (typeof fiber.type === 'function') {
                    name = fiber.type.displayName || fiber.type.name;
                } else if (typeof fiber.type === 'object' && fiber.type !== null) {
                    name =
                        fiber.type.displayName ||
                        fiber.type.name ||
                        (fiber.type.render && (fiber.type.render.displayName || fiber.type.render.name));
                }

                if (
                    typeof name === 'string' &&
                    name.length > 0 &&
                    !name.startsWith('_') &&
                    !['Anonymous', 'Context', 'Provider', 'Consumer', 'MotionComponent', 'Fragment'].includes(name)
                ) {
                    if (!components.includes(name)) {
                        components.push(name);
                    }
                }
            }
            fiber = fiber.return;
        }

        return components.length > 0 ? components : null;
    } catch {
        return null;
    }
}

/**
 * Genera un selector CSS limpio y legible para un elemento DOM
 */
function getElementSelector(el) {
    if (!el || el === document.body) return 'body';
    let label = el.tagName.toLowerCase();
    if (el.id) {
        label += `#${el.id}`;
    } else if (el.className && typeof el.className === 'string') {
        const classes = el.className
            .split(/\s+/)
            .filter((c) => c && !c.startsWith('is-') && !c.startsWith('agent-') && !c.includes('active'))
            .slice(0, 2);
        if (classes.length > 0) {
            label += `.${classes.join('.')}`;
        }
    }
    return label;
}

/**
 * Construye la cadena de jerarquía de ancestros y componentes desde el elemento seleccionado hacia arriba
 */
function buildHierarchy(targetEl) {
    const rawChain = [];
    let curr = targetEl;

    while (curr && curr !== document.body && curr !== document.documentElement) {
        // Ignoramos los propios elementos del inspector
        if (curr.closest('.agent-inspector-trigger') || curr.closest('.agent-inspector-dock') || curr.closest('.agent-inspector-overlay-root')) {
            break;
        }

        const reactNames = getReactComponentInfo(curr);
        const domSelector = getElementSelector(curr);
        const rect = curr.getBoundingClientRect();
        const textSnippet = (curr.innerText || curr.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

        // Elegimos un nombre significativo: Si es un componente custom (ej. HeroCarousel), lo usamos;
        // si es un wrapper genérico (motion.div o div), mostramos el selector CSS de clase.
        let displayName = domSelector;
        let mainReactComponent = null;

        if (reactNames && reactNames.length > 0) {
            const meaningfulReact = reactNames.find((n) => !n.startsWith('motion.') && n !== 'Component' && n !== 'Fragment');
            if (meaningfulReact) {
                displayName = `<${meaningfulReact} />`;
                mainReactComponent = meaningfulReact;
            } else if (reactNames[0]) {
                mainReactComponent = reactNames[0];
            }
        }

        rawChain.push({
            domNode: curr,
            name: displayName,
            reactComponent: mainReactComponent,
            domSelector,
            rect,
            textSnippet
        });

        curr = curr.parentElement;
    }

    const reversed = rawChain.reverse();
    // Filtramos duplicados consecutivos con el mismo nombre
    const cleaned = [];
    for (let i = 0; i < reversed.length; i++) {
        const item = reversed[i];
        if (cleaned.length === 0 || cleaned[cleaned.length - 1].name !== item.name || i === reversed.length - 1) {
            cleaned.push(item);
        }
    }

    return cleaned.length > 0 ? cleaned : reversed;
}

export default function AgentInspector() {
    const [isActive, setIsActive] = useState(false);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hoverRect, setHoverRect] = useState(null);
    const [hoverLabel, setHoverLabel] = useState('');

    const [selectedHierarchy, setSelectedHierarchy] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [previewNode, setPreviewNode] = useState(null);

    // Activar / Desactivar con atajo Alt + C o Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                setIsActive((prev) => !prev);
                setSelectedHierarchy(null);
            }
            if (e.key === 'Escape' && (isActive || selectedHierarchy)) {
                setIsActive(false);
                setSelectedHierarchy(null);
                setHoveredNode(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, selectedHierarchy]);

    // Manejo de mouseover y clic durante el modo de inspección
    useEffect(() => {
        if (!isActive || selectedHierarchy) return;

        const handleMouseMove = (e) => {
            const target = e.target;
            if (!target || target.closest('.agent-inspector-trigger') || target.closest('.agent-inspector-dock') || target.closest('.agent-inspector-overlay-root')) {
                setHoveredNode(null);
                return;
            }

            const rect = target.getBoundingClientRect();
            const reactInfo = getReactComponentInfo(target);
            const selector = getElementSelector(target);
            const label = reactInfo && reactInfo[0] ? `<${reactInfo[0]}> (${selector})` : selector;

            setHoveredNode(target);
            setHoverRect(rect);
            setHoverLabel(`${label} [${Math.round(rect.width)} × ${Math.round(rect.height)}px]`);
        };

        const handleClick = (e) => {
            const target = e.target;
            if (!target || target.closest('.agent-inspector-trigger') || target.closest('.agent-inspector-dock') || target.closest('.agent-inspector-overlay-root')) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const chain = buildHierarchy(target);
            if (chain.length > 0) {
                setSelectedHierarchy(chain);
                setSelectedIndex(chain.length - 1);
                setHoveredNode(null);
                setPreviewNode(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, true);
        window.addEventListener('click', handleClick, true);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove, true);
            window.removeEventListener('click', handleClick, true);
        };
    }, [isActive, selectedHierarchy]);

    // Elemento actualmente activo para copiar o resaltar
    const activeItem = selectedHierarchy && selectedIndex >= 0 ? selectedHierarchy[selectedIndex] : null;
    const activeDisplayNode = previewNode || (activeItem ? activeItem.domNode : hoveredNode);
    const activeDisplayRect = activeDisplayNode ? activeDisplayNode.getBoundingClientRect() : hoverRect;

    const handleCopyContext = useCallback(() => {
        if (!activeItem) return;

        const { name, reactComponent, domSelector, textSnippet, domNode } = activeItem;
        const rect = domNode.getBoundingClientRect();
        const hierarchyPath = selectedHierarchy.map((item) => item.name).join(' ➔ ');

        const markdownContext = [
            `### 🎯 Contexto de Componente Seleccionado:`,
            `- **Componente / Contenedor:** \`${name}\``,
            reactComponent ? `- **React Component:** \`<${reactComponent} />\`` : null,
            `- **Selector DOM:** \`${domSelector}\``,
            `- **Jerarquía:** \`${hierarchyPath}\``,
            `- **Dimensiones:** \`${Math.round(rect.width)}px × ${Math.round(rect.height)}px\``,
            textSnippet ? `- **Texto / Contenido:** "${textSnippet}"` : null,
            ``,
            `**Instrucción para el agente:**`,
            `> [Escribe aquí el cambio que deseas realizar en este componente/contenedor]`
        ]
            .filter(Boolean)
            .join('\n');

        navigator.clipboard.writeText(markdownContext).then(() => {
            toast.success('¡Contexto copiado al portapapeles! Pegalo en el chat con tu pedido.', {
                duration: 4000,
                position: 'bottom-center',
                style: {
                    background: '#0f172a',
                    color: '#ffffff',
                    border: '1px solid #0072e3',
                    fontSize: '0.85rem'
                }
            });
        });
    }, [activeItem, selectedHierarchy]);

    return (
        <>
            {/* Botón flotante para activar el inspector */}
            <button
                type="button"
                className={`agent-inspector-trigger ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                    setIsActive(!isActive);
                    setSelectedHierarchy(null);
                    setHoveredNode(null);
                    setPreviewNode(null);
                }}
                title="Inspeccionar componentes para pasar contexto a la IA (Alt + C)"
                aria-label="Inspector de componentes para IA"
            >
                <i className={`bi ${isActive ? 'bi-crosshair2' : 'bi-bounding-box-circles'}`} aria-hidden="true" />
                <span>{isActive ? 'Inspector Activo' : 'Inspeccionar UI'}</span>
                <kbd>Alt+C</kbd>
            </button>

            {/* Overlay de Resaltado Visual */}
            {(isActive || selectedHierarchy) && activeDisplayRect && (
                <div className="agent-inspector-overlay-root">
                    <div
                        className={`agent-inspector-highlight ${previewNode ? 'is-parent' : ''}`}
                        style={{
                            top: `${activeDisplayRect.top}px`,
                            left: `${activeDisplayRect.left}px`,
                            width: `${activeDisplayRect.width}px`,
                            height: `${activeDisplayRect.height}px`
                        }}
                    >
                        <div className="agent-inspector-badge">
                            <span>{previewNode ? `<${previewNode.tagName.toLowerCase()}>` : (hoverLabel || (activeItem ? activeItem.name : ''))}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel flotante de Jerarquía / Breadcrumbs de Contenedores */}
            {selectedHierarchy && activeItem && (
                <aside
                    className="agent-inspector-dock"
                    role="region"
                    aria-label="Detalles de jerarquía del componente"
                >
                    <div className="agent-inspector-dock-header">
                        <div className="agent-inspector-dock-title">
                            <i className="bi bi-layers-half" aria-hidden="true" />
                            <span>Jerarquía de Contenedores y Componentes</span>
                        </div>
                        <button
                            type="button"
                            className="agent-inspector-dock-close"
                            onClick={() => {
                                setSelectedHierarchy(null);
                                setIsActive(false);
                            }}
                            title="Cerrar inspector (Esc)"
                        >
                            &times;
                        </button>
                    </div>

                    <div className="agent-inspector-breadcrumbs-label">
                        Selecciona el nivel o contenedor que deseas modificar:
                    </div>

                    <div className="agent-inspector-breadcrumbs">
                        {selectedHierarchy.map((item, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <React.Fragment key={idx}>
                                    <button
                                        type="button"
                                        className={`agent-inspector-crumb ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setSelectedIndex(idx);
                                            setPreviewNode(null);
                                        }}
                                        onMouseEnter={() => setPreviewNode(item.domNode)}
                                        onMouseLeave={() => setPreviewNode(null)}
                                        title={`Clic para seleccionar contenedor ${item.name}`}
                                    >
                                        <i className={`bi ${item.reactComponent ? 'bi-filetype-jsx' : 'bi-box'}`} aria-hidden="true" />
                                        <span>{item.name}</span>
                                    </button>
                                    {idx < selectedHierarchy.length - 1 && (
                                        <span className="agent-inspector-crumb-sep">&rsaquo;</span>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    <div className="agent-inspector-details">
                        <div className="agent-inspector-detail-row">
                            <span className="agent-inspector-detail-key">Objetivo:</span>
                            <span className="agent-inspector-detail-val" style={{ color: '#60a5fa', fontWeight: 600 }}>
                                {activeItem.name}
                            </span>
                        </div>
                        <div className="agent-inspector-detail-row">
                            <span className="agent-inspector-detail-key">Selector DOM:</span>
                            <span className="agent-inspector-detail-val">{activeItem.domSelector}</span>
                        </div>
                        <div className="agent-inspector-detail-row">
                            <span className="agent-inspector-detail-key">Tamaño:</span>
                            <span className="agent-inspector-detail-val">
                                {Math.round(activeItem.rect.width)}px de ancho × {Math.round(activeItem.rect.height)}px de alto
                            </span>
                        </div>
                        {activeItem.textSnippet && (
                            <div className="agent-inspector-detail-row">
                                <span className="agent-inspector-detail-key">Contenido:</span>
                                <span className="agent-inspector-detail-val">"{activeItem.textSnippet}"</span>
                            </div>
                        )}
                    </div>

                    <div className="agent-inspector-actions">
                        <button
                            type="button"
                            className="btn-agent-reinspect"
                            onClick={() => {
                                setSelectedHierarchy(null);
                                setIsActive(true);
                            }}
                        >
                            <i className="bi bi-arrow-repeat" aria-hidden="true" />
                            Seleccionar otro
                        </button>
                        <button
                            type="button"
                            className="btn-agent-copy"
                            onClick={handleCopyContext}
                        >
                            <i className="bi bi-clipboard-check" aria-hidden="true" />
                            Copiar contexto para Agente
                        </button>
                    </div>
                </aside>
            )}
        </>
    );
}
