import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { apiClient } from '../services/http/apiClient.js';
import ProductCatalogCard from '../components/orders/ProductCatalogCard.jsx';

const Skeleton = () => (
    <div className="catalog-products-grid">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton catalog-product-skeleton" />
        ))}
    </div>
);

export default function CatalogoCliente() {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const [prods, cats] = await Promise.all([
                    apiClient('/productos', {
                        headers: getHeaders(),
                        query: { activo: true, visible: true },
                    }),
                    apiClient('/categorias', { headers: getHeaders() }),
                ]);
                if (cancelled) return;
                setProductos(Array.isArray(prods) ? prods : []);
                setCategorias(Array.isArray(cats) ? cats : []);
            } catch {
                if (!cancelled) {
                    setProductos([]);
                    setCategorias([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [getHeaders]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return productos.filter((p) => {
            if (p.activo === false || p.visible === false) return false;
            const matchCat = selectedCat === 'all' || String(p.categoria_id) === String(selectedCat);
            if (!matchCat) return false;
            if (!q) return true;
            const haystack = [p.nombre, p.descripcion, p.material_nombre, p.categoria_nombre]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [productos, selectedCat, search]);

    const grouped = useMemo(() => {
        if (selectedCat !== 'all') {
            return [{
                nombre: categorias.find((c) => String(c.id) === String(selectedCat))?.nombre || 'Categoría',
                items: filtered,
            }];
        }
        const map = {};
        filtered.forEach((p) => {
            const key = p.categoria_nombre || 'Sin categoría';
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return Object.entries(map).map(([nombre, items]) => ({ nombre, items }));
    }, [filtered, selectedCat, categorias]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Catálogo de Servicios</h1>
                    <p>Elige un tratamiento y continúa al pedido</p>
                </div>
            </div>

            <div className="catalog-search-filter-container">
                <div className="catalog-search-wrapper">
                    <i className="bi bi-search catalog-search-icon" aria-hidden="true" />
                    <input
                        type="search"
                        className="form-input catalog-search-input"
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Buscar productos"
                    />
                </div>
                <div className="catalog-filters-scrollable" role="group" aria-label="Filtrar por categoría">
                    <button
                        type="button"
                        onClick={() => setSelectedCat('all')}
                        className={`btn ${selectedCat === 'all' ? 'btn-primary' : 'btn-ghost'} catalog-filter-chip`}
                    >
                        Todos
                    </button>
                    {categorias.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCat(String(cat.id))}
                            className={`btn ${String(selectedCat) === String(cat.id) ? 'btn-primary' : 'btn-ghost'} catalog-filter-chip`}
                        >
                            {cat.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton />
            ) : filtered.length === 0 ? (
                <div className="catalog-empty-state">
                    <i className="bi bi-box-seam catalog-empty-state-icon" aria-hidden="true" />
                    <h3>No se encontraron productos</h3>
                    <p>Intenta buscar con otros términos o selecciona otra categoría.</p>
                </div>
            ) : (
                grouped.map((group) => (
                    <div key={group.nombre} className="catalog-group">
                        <div className="catalog-group-header">
                            <div className="catalog-group-accent" />
                            <h2 className="catalog-group-title">{group.nombre}</h2>
                            <span className="catalog-group-count">
                                {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="catalog-products-grid">
                            {group.items.map((producto) => (
                                <ProductCatalogCard
                                    key={producto.id}
                                    producto={producto}
                                    onOrder={() => navigate(`/pedidos/nuevo?productoId=${producto.id}`)}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
