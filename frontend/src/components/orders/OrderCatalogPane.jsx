import React from 'react';
import { formatDentalSelection } from '../../utils/odontograma.js';

const OrderCatalogPane = ({
    categorias,
    productos,
    items,
    selectedItemId,
    onAddProduct,
    onSelectItem,
    onRemoveItem
}) => {
    return (
        <section className="order-composer-catalog-pane">
            <article className="card order-composer-catalog-card">
                <div className="card-header">
                    <h3 className="card-title">Catalogo</h3>
                </div>
                <div className="order-composer-catalog-list">
                    {categorias.map((categoria) => {
                        const itemsCategoria = productos.filter((producto) => producto.categoria_id === categoria.id);
                        if (itemsCategoria.length === 0) return null;

                        return (
                            <div className="order-composer-catalog-group" key={categoria.id}>
                                <p className="order-composer-catalog-group-title">{categoria.nombre}</p>
                                {itemsCategoria.map((producto) => (
                                    <div className="order-composer-catalog-item" key={producto.id}>
                                        <div>
                                            <p className="order-composer-catalog-item-name">{producto.nombre}</p>
                                            <p className="order-composer-catalog-item-price">S/. {Number(producto.precio_base || 0).toFixed(2)}</p>
                                        </div>
                                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onAddProduct(producto)}>
                                            <i className="bi bi-plus-circle"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </article>

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
        </section>
    );
};

export default OrderCatalogPane;
