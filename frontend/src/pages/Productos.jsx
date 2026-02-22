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
    const [materiales, setMateriales] = useState([]);
    const [filtroTipo, setFiltroTipo] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_id: '', tiempo_estimado_dias: 5, visible: true, image: null });

    const fetchData = () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        // We fetch all and filter by type locally for smoother UX, or we could pass type to backend

        Promise.all([
            fetch(`${API_URL}/productos?${params}`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/categorias`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/inventory`, { headers: getHeaders() }).then(r => r.json())
        ]).then(([prods, cats, mats]) => {
            setProductos(prods);
            setCategorias(cats);
            setMateriales(mats);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [search]);

    const openNew = () => {
        setEditing(null);
        setForm({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_id: '', tiempo_estimado_dias: 5, visible: true, image: null });
        setModalOpen(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({
            nombre: p.nombre,
            descripcion: p.descripcion || '',
            categoria_id: p.categoria_id || '',
            precio_base: p.precio_base,
            material_id: p.material_id || '',
            tiempo_estimado_dias: p.tiempo_estimado_dias || 5,
            visible: p.visible,
            image: null // Don't preload image file, just URL is in 'p'
        });
        setModalOpen(true);
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/productos/${editing.id}` : `${API_URL}/productos`;

        const formData = new FormData();
        formData.append('nombre', form.nombre);
        formData.append('descripcion', form.descripcion);
        formData.append('categoria_id', form.categoria_id);
        formData.append('precio_base', parseFloat(form.precio_base) || 0);
        formData.append('material_id', form.material_id);
        formData.append('tiempo_estimado_dias', form.tiempo_estimado_dias);
        formData.append('visible', form.visible);
        if (form.image) {
            formData.append('image', form.image);
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': getHeaders().Authorization }, // Content-Type must be undefined for FormData
                body: formData
            });
            if (res.ok) {
                setModalOpen(false);
                fetchData();
            } else {
                alert('Error al guardar');
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Group by category type
    const grouped = {};
    productos.forEach(p => {
        const tipo = p.categoria_tipo || 'otros';
        if (filtroTipo && tipo !== filtroTipo) return; // Client-side filter
        if (!grouped[tipo]) grouped[tipo] = [];
        grouped[tipo].push(p);
    });

    const toggleVisibility = async (e, p) => {
        e.stopPropagation();
        try {
            const formData = new FormData();
            formData.append('activo', !p.activo); // Using 'activo' for global soft delete, or 'visible' if that was the table column
            // Wait, implementation plan said 'visible'. Backend code I wrote uses 'visible' and 'activo'. 
            // Query param supports both. 
            // Let's use 'visible' for "Interruptor de visibilidad" as requested.
            // But wait, the previous code had 'activo'. 
            // Let's toggle 'visible'.
            // Actually, backend PUT accepts 'visible'.

            // NOTE: FormData not needed for simple JSON update if I didn't change backend to REQUIRE multipart. 
            // My backend change: `upload.single('image')` determines if it expects multipart.
            // Multer middleware usually handles multipart/form-data. If I send JSON, multer might skip or error depending on config.
            // Safest to use FormData since I added upload middleware to PUT.

            const fd = new FormData();
            fd.append('visible', !p.visible);

            await fetch(`${API_URL}/productos/${p.id}`, {
                method: 'PUT',
                headers: { 'Authorization': getHeaders().Authorization },
                body: fd
            });
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

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
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <button className={`btn ${!filtroTipo ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                            onClick={() => setFiltroTipo('')}>Todos</button>
                        {Object.entries(tipoLabels).map(([key, label]) => (
                            <button key={key} className={`btn ${filtroTipo === key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                onClick={() => setFiltroTipo(filtroTipo === key ? '' : key)}
                                style={{ borderLeftColor: tipoColors[key], borderLeftWidth: 3 }}>
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
                                <div key={p.id} className="card card-hover" style={{ cursor: 'pointer', opacity: p.visible ? 1 : 0.6 }} onClick={() => openEdit(p)}>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        {p.image_url && (
                                            <div style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                                                <img src={`${API_URL}${p.image_url}`} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
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
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                                                {p.material_nombre && (
                                                    <span className="badge" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                        <i className="bi bi-diamond" style={{ fontSize: '0.625rem' }}></i> {p.material_nombre}
                                                    </span>
                                                )}
                                                <span className="badge" style={{ background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                    <i className="bi bi-clock" style={{ fontSize: '0.625rem' }}></i> {p.tiempo_estimado_dias} días
                                                </span>
                                                <div style={{ marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
                                                    <label className="switch">
                                                        <input type="checkbox" checked={!!p.visible} onChange={(e) => toggleVisibility(e, p)} />
                                                        <span className="slider round"></span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
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
                        <label className="form-label">Material</label>
                        <select className="form-select" value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })}>
                            <option value="">Ninguno / Por defecto</option>
                            {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre} (Stock: {m.stock_actual} {m.unidad})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Imagen</label>
                        <input className="form-input" type="file" accept="image/*" onChange={e => setForm({ ...form, image: e.target.files[0] })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tiempo estimado (días)</label>
                        <input className="form-input" type="number" value={form.tiempo_estimado_dias} onChange={e => setForm({ ...form, tiempo_estimado_dias: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '28px' }}>
                        <label style={{ margin: 0 }}>Visible</label>
                        <input type="checkbox" checked={form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} style={{ width: 20, height: 20 }} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Productos;
