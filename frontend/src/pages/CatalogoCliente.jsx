import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';

// Derive backend base for local /uploads/ paths (strips trailing /api segment)
const BACKEND_BASE = API_URL.endsWith('/api')
    ? API_URL.slice(0, -4)
    : API_URL.startsWith('http') ? API_URL : '';

const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    // Local path like /uploads/... — serve from backend origin
    return `${BACKEND_BASE}${imageUrl}`;
};

const CatalogoCliente = () => {
    const { getHeaders } = useAuth();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCat, setSelectedCat] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/productos?visible=true&activo=true`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/categorias`, { headers: getHeaders() }).then(r => r.json()),
        ])
            .then(([prods, cats]) => {
                setProductos(Array.isArray(prods) ? prods : []);
                setCategorias(Array.isArray(cats) ? cats : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        return productos.filter(p => {
            const matchCat = selectedCat === 'all' || String(p.categoria_id) === String(selectedCat);
            const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
                (p.descripcion || '').toLowerCase().includes(search.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [productos, selectedCat, search]);

    // Group by category for display
    const grouped = useMemo(() => {
        if (selectedCat !== 'all') {
            return [{ nombre: categorias.find(c => String(c.id) === String(selectedCat))?.nombre || 'Categoría', items: filtered }];
        }
        const map = {};
        filtered.forEach(p => {
            const key = p.categoria_nombre || 'Sin categoría';
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return Object.entries(map).map(([nombre, items]) => ({ nombre, items }));
    }, [filtered, selectedCat, categorias]);

    const Skeleton = () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ borderRadius: '16px', height: '280px' }} />
            ))}
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Catálogo de Servicios</h1>
                    <p>Todos los trabajos y restauraciones que ofrecemos</p>
                </div>
            </div>

            {/* Search and filter bar */}
            <div style={{
                display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
                marginBottom: '1.5rem'
            }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
                    <i className="bi bi-search" style={{
                        position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--color-text-secondary)', pointerEvents: 'none'
                    }} />
                    <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setSelectedCat('all')}
                        className={`btn ${selectedCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '999px' }}
                    >
                        Todos
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCat(String(cat.id))}
                            className={`btn ${String(selectedCat) === String(cat.id) ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', borderRadius: '999px' }}
                        >
                            {cat.nombre}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Skeleton />
            ) : filtered.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    <i className="bi bi-box-seam" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block' }} />
                    <h3>No se encontraron productos</h3>
                    <p>Intenta buscar con otros términos o selecciona otra categoría.</p>
                </div>
            ) : (
                grouped.map(group => (
                    <div key={group.nombre} style={{ marginBottom: '2.5rem' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            marginBottom: '1.25rem', paddingBottom: '0.75rem',
                            borderBottom: '2px solid var(--color-border)'
                        }}>
                            <div style={{
                                width: '4px', height: '24px', borderRadius: '2px',
                                background: 'var(--color-primary)'
                            }} />
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>{group.nombre}</h2>
                            <span style={{
                                background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)',
                                borderRadius: '999px', padding: '0.1rem 0.6rem',
                                fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '500'
                            }}>
                                {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {group.items.map(producto => (
                                <ProductCard key={producto.id} producto={producto} />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

const ProductCard = ({ producto }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            className="card"
            style={{
                padding: 0, overflow: 'hidden', borderRadius: '16px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
            }}
        >
            {/* Image / placeholder */}
            <div style={{
                height: '160px', overflow: 'hidden',
                background: 'linear-gradient(135deg, var(--color-bg-alt) 0%, var(--color-surface) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative'
            }}>
                {producto.image_url && !imgError ? (
                    <img
                        src={resolveImageUrl(producto.image_url)}
                        alt={producto.nombre}
                        onError={() => setImgError(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <i className="bi bi-gem" style={{ fontSize: '2.5rem', opacity: 0.4 }} />
                    </div>
                )}
                {/* Category badge */}
                {producto.categoria_nombre && (
                    <span style={{
                        position: 'absolute', top: '0.75rem', right: '0.75rem',
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        color: '#fff', fontSize: '0.7rem', fontWeight: '600',
                        padding: '0.2rem 0.6rem', borderRadius: '999px'
                    }}>
                        {producto.categoria_nombre}
                    </span>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: '700' }}>
                    {producto.nombre}
                </h3>
                {producto.material_nombre && (
                    <p style={{
                        margin: '0 0 0.5rem 0', fontSize: '0.8rem',
                        color: 'var(--color-primary)', fontWeight: '600',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                        <i className="bi bi-layers" style={{ fontSize: '0.75rem' }} />
                        {producto.material_nombre}
                    </p>
                )}
                {producto.descripcion && (
                    <p style={{
                        margin: '0 0 1rem 0', fontSize: '0.825rem',
                        color: 'var(--color-text-secondary)', lineHeight: '1.4',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                        {producto.descripcion}
                    </p>
                )}

                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)'
                }}>
                    <div>
                        {producto.precio_base > 0 && (
                            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                S/. {Number(producto.precio_base).toFixed(2)}
                            </div>
                        )}
                    </div>
                    {producto.tiempo_estimado_dias && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.78rem', color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg-alt)', padding: '0.2rem 0.6rem',
                            borderRadius: '999px', border: '1px solid var(--color-border)'
                        }}>
                            <i className="bi bi-clock" />
                            {producto.tiempo_estimado_dias} día{producto.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CatalogoCliente;
