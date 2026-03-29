import React, { useMemo, useState } from 'react';
import { formatDentalSelection } from '../../utils/odontograma.js';

const OrderCatalogPane = ({
    categorias,
    productos,
    items,
    selectedItemId,
    onAddProduct,
    onSelectItem,
    onRemoveItem,
    hideOrderItems = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const itemsByProductId = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            const productId = item.product?.id || item.product_id || item.id_producto || item.id;
            if (!map.has(productId)) {
                map.set(productId, item);
            }
        });
        return map;
    }, [items]);

    return (
        <section className="order-composer-catalog-pane">
            <article className="card order-composer-catalog-card nuevo-pedido-catalog-card">
                <div className="card-header">
                    <div>
                        <h3 className="card-title"><i className="bi bi-grid-1x2"></i> Catalogo</h3>
                        <p className="nuevo-pedido-catalog-copy">Busca y agrega productos sin salir del caso.</p>
                    </div>
                </div>

                <div className="nuevo-pedido-catalog-search">
                    <i className="bi bi-search"></i>
                    <input
                        className="form-input nuevo-pedido-catalog-search-input"
                        type="search"
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>

                <div className="order-composer-catalog-list">
                    {categorias.map((categoria) => {
                        const itemsCategoria = productos.filter((producto) => {
                            if (producto.categoria_id !== categoria.id) return false;
                            if (!normalizedSearch) return true;
                            const haystack = `${producto.nombre || ''} ${categoria.nombre || ''}`.toLowerCase();
                            return haystack.includes(normalizedSearch);
                        });
                        if (itemsCategoria.length === 0) return null;

                        return (
                            <div className="order-composer-catalog-group" key={categoria.id}>
                                <p className="order-composer-catalog-group-title">{categoria.nombre}</p>
                                {itemsCategoria.map((producto) => {
                                    const existingItem = itemsByProductId.get(producto.id);
                                    return (
                                        <div className="order-composer-catalog-item nuevo-pedido-catalog-item" key={producto.id}>
                                            <button
                                                type="button"
                                                className="nuevo-pedido-catalog-item-main"
                                                onClick={() => existingItem ? onSelectItem(existingItem.id) : onAddProduct(producto)}
                                            >
                                                <div>
                                                    <p className="order-composer-catalog-item-name">{producto.nombre}</p>
                                                    <p className="order-composer-catalog-item-price">S/. {Number(producto.precio_base || 0).toFixed(2)}</p>
                                                </div>
                                                {existingItem ? <span className="nuevo-pedido-catalog-badge">Agregado</span> : null}
                                            </button>
                                            {existingItem ? (
                                                <button type="button" className="btn btn-ghost btn-sm btn-icon nuevo-pedido-catalog-action is-remove" onClick={() => onRemoveItem(existingItem.id)}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            ) : (
                                                <button type="button" className="btn btn-ghost btn-sm btn-icon nuevo-pedido-catalog-action is-add" onClick={() => onAddProduct(producto)}>
                                                    <i className="bi bi-plus-circle"></i>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {normalizedSearch && !productos.some((producto) => `${producto.nombre || ''}`.toLowerCase().includes(normalizedSearch)) ? (
                        <div className="nuevo-pedido-catalog-empty-search">No encontramos productos para esa busqueda.</div>
                    ) : null}
                </div>
            </article>

            {!hideOrderItems && (
                <article className="card">
                    <div className="card-header">
                        <h3 className="card-title">Items del Pedido ({items.length})</h3>
                    </div>

                    {items.length === 0 ? (
                        <div className="empty-state order-composer-empty-state">
                            <i className="bi bi-cart empty-state-icon"></i>
                            <p className="empty-state-text">Agrega productos del catalogo para comenzar</p>
                        </div>
                    ) : (
                        <div className="order-composer-selected-list">
                            {items.map((item) => {
                                const isSelected = item.id === selectedItemId;
                                return (
                                    <div
                                        className={['order-composer-selected-item', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                                        key={item.id}
                                    >
                                        <button type="button" className="order-composer-selected-content" onClick={() => onSelectItem(item.id)}>
                                            <strong>{item.nombre}</strong>
                                            <span className="order-composer-selected-meta">
                                                {item.cantidad} x S/. {Number(item.precio_unitario || 0).toFixed(2)}
                                            </span>
                                            <span className="order-composer-selected-meta">{formatDentalSelection(item)}</span>
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onRemoveItem(item.id)}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </article>
            )}
        </section>
    );
};

export default OrderCatalogPane;
