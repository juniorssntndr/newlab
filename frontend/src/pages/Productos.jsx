import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';

const tipoLabels = { fija: 'Prótesis Fija', implante: 'Sobre Implantes', removible: 'Removible (PPR)', especialidad: 'Especialidades' };
const tipoColors = { fija: '#0891B2', implante: '#8B5CF6', removible: '#F59E0B', especialidad: '#10B981' };

const Productos = () => {
    const { getHeaders } = useAuth();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_default: '', tiempo_estimado_dias: 5 });

    const fetchData = () => {
        const params = new URLSearchParams();
        if (filtroCategoria) params.set('categoria_id', filtroCategoria);
        if (search) params.set('search', search);

        Promise.all([
            fetch(`${API_URL}/productos?${params}`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/categorias`, { headers: getHeaders() }).then(r => r.json())
        ]).then(([prods, cats]) => {
            setProductos(prods);
            setCategorias(cats);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [filtroCategoria, search]);

    const openNew = () => {
        setEditing(null);
        setForm({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_default: '', tiempo_estimado_dias: 5 });
        setModalOpen(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({ nombre: p.nombre, descripcion: p.descripcion || '', categoria_id: p.categoria_id || '', precio_base: p.precio_base, material_default: p.material_default || '', tiempo_estimado_dias: p.tiempo_estimado_dias || 5 });
        setModalOpen(true);
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/productos/${editing.id}` : `${API_URL}/productos`;
        await fetch(url, { method, headers: getHeaders(), body: JSON.stringify({ ...form, precio_base: parseFloat(form.precio_base) || 0 }) });
        setModalOpen(false);
        fetchData();
    };

    // Group by category type
    const grouped = {};
    productos.forEach(p => {
        const tipo = p.categoria_tipo || 'otros';
        if (!grouped[tipo]) grouped[tipo] = [];
        grouped[tipo].push(p);
    });

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Catálogo de Productos</h1>
                    <p>Servicios y trabajos del laboratorio</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <i className="bi bi-plus-lg"></i> Nuevo Producto
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                        <i className="bi bi-search"></i>
                        <input className="form-input" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className={`btn ${!filtroCategoria ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                            onClick={() => setFiltroCategoria('')}>Todos</button>
                        {Object.entries(tipoLabels).map(([key, label]) => (
                            <button key={key} className={`btn ${filtroCategoria && categorias.find(c => c.id == filtroCategoria)?.tipo === key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                onClick={() => {
                                    const cat = categorias.find(c => c.tipo === key);
                                    setFiltroCategoria(cat ? '' : ''); // reset, use tipo filter instead
                                }} style={{ borderLeftColor: tipoColors[key], borderLeftWidth: 3 }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Products grid by type */}
            {loading ? (
                <div className="grid grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12 }} />)}</div>
            ) : productos.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <i className="bi bi-box-seam empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin productos registrados</h3>
                        <p className="empty-state-text">Agrega productos para poder crear pedidos</p>
                    </div>
                </div>
            ) : (
                Object.entries(grouped).map(([tipo, prods]) => (
                    <div key={tipo} style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ width: 4, height: 20, borderRadius: 2, background: tipoColors[tipo] || '#6B7280', display: 'inline-block' }}></span>
                            {tipoLabels[tipo] || tipo}
                            <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>({prods.length})</span>
                        </h3>
                        <div className="grid grid-cols-3">
                            {prods.map(p => (
                                <div key={p.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => openEdit(p)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontSize: '0.9375rem', marginBottom: 'var(--space-1)' }}>{p.nombre}</h4>
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                                                {p.categoria_nombre}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                                S/. {parseFloat(p.precio_base).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {p.material_default && (
                                            <span className="badge" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                <i className="bi bi-diamond" style={{ fontSize: '0.625rem' }}></i> {p.material_default}
                                            </span>
                                        )}
                                        <span className="badge" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                            <i className="bi bi-clock" style={{ fontSize: '0.625rem' }}></i> {p.tiempo_estimado_dias} días
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            <Modal open={modalOpen} onClose={() => setModalOpen(false)}
                title={editing ? 'Editar Producto' : 'Nuevo Producto'}
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save}><i className="bi bi-check-lg"></i> {editing ? 'Guardar' : 'Crear'}</button>
                </>}>
                <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea className="form-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div className="grid grid-cols-2">
                    <div className="form-group">
                        <label className="form-label">Categoría</label>
                        <select className="form-select" value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({tipoLabels[c.tipo]})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Precio Base (S/.)</label>
                        <input className="form-input" type="number" step="0.01" value={form.precio_base} onChange={e => setForm({ ...form, precio_base: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Material por defecto</label>
                        <input className="form-input" value={form.material_default} onChange={e => setForm({ ...form, material_default: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tiempo estimado (días)</label>
                        <input className="form-input" type="number" value={form.tiempo_estimado_dias} onChange={e => setForm({ ...form, tiempo_estimado_dias: e.target.value })} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Productos;
