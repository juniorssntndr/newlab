import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';

const tipoLabels = { fija: 'Prótesis Fija', implante: 'Sobre Implantes', removible: 'Removible (PPR)', especialidad: 'Especialidades' };
const tipoColors = { fija: '#0891B2', implante: '#8B5CF6', removible: '#F59E0B', especialidad: '#10B981' };
const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    return `${API_URL}${imageUrl}`;
};

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
    const [form, setForm] = useState({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_id: '', tiempo_estimado_dias: 5, visible: true, image: null, image_url: '' });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const fileInputRef = useRef(null);

    const fetchData = () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        Promise.all([
            fetch(`${API_URL}/productos?${params}`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/categorias`, { headers: getHeaders() }).then(r => r.json()),
            fetch(`${API_URL}/inventory`, { headers: getHeaders() }).then(r => r.json())
        ]).then(([prods, cats, mats]) => {
            setProductos(Array.isArray(prods) ? prods : []);
            setCategorias(Array.isArray(cats) ? cats : []);
            setMateriales(Array.isArray(mats) ? mats : []);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [search]);

    const openNew = () => {
        setEditing(null);
        setForm({ nombre: '', descripcion: '', categoria_id: '', precio_base: '', material_id: '', tiempo_estimado_dias: 5, visible: true, image: null, image_url: '' });
        setFormError('');
        setImagePreviewUrl('');
        setModalOpen(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({
            nombre: p.nombre,
            descripcion: p.descripcion || '',
            categoria_id: p.categoria_id ? String(p.categoria_id) : '',
            precio_base: p.precio_base,
            material_id: p.material_id ? String(p.material_id) : '',
            tiempo_estimado_dias: p.tiempo_estimado_dias || 5,
            visible: p.visible,
            image: null,
            image_url: p.image_url || ''
        });
        setFormError('');
        setImagePreviewUrl(resolveImageUrl(p.image_url));
        setModalOpen(true);
    };

    const handleImageChange = (file) => {
        if (!file) {
            setForm((prev) => ({ ...prev, image: null }));
            setImagePreviewUrl(resolveImageUrl(form.image_url));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setImagePreviewUrl(String(reader.result || ''));
        };
        reader.readAsDataURL(file);

        setForm((prev) => ({ ...prev, image: file }));
    };

    const createMaterial = async () => {
        const nombre = window.prompt('Nombre del material (ej. Zirconia HT):');
        if (!nombre || !nombre.trim()) return;
        const unidad = window.prompt('Unidad (ej. disco, bloque, kg, unid):', 'unid') || 'unid';

        try {
            setSaving(true);
            const res = await fetch(`${API_URL}/inventory`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre: nombre.trim(),
                    unidad: unidad.trim() || 'unid',
                    stock_actual: 0,
                    stock_minimo: 5
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setFormError(data.error || 'No se pudo crear el material');
                return;
            }

            const material = await res.json();
            setMateriales((prev) => [...prev, material].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setForm((prev) => ({ ...prev, material_id: String(material.id) }));
        } catch (error) {
            console.error(error);
            setFormError('Error creando material');
        } finally {
            setSaving(false);
        }
    };

    const save = async () => {
        if (saving) return;
        if (!form.nombre?.trim()) {
            setFormError('El nombre es requerido');
            return;
        }

        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/productos/${editing.id}` : `${API_URL}/productos`;

        const formData = new FormData();
        formData.append('nombre', form.nombre.trim());
        formData.append('descripcion', form.descripcion);
        formData.append('categoria_id', form.categoria_id);
        formData.append('precio_base', String(form.precio_base || '0').trim());
        formData.append('material_id', form.material_id);
        formData.append('tiempo_estimado_dias', form.tiempo_estimado_dias);
        formData.append('visible', form.visible);
        if (form.image) {
            formData.append('image', form.image);
        }

        try {
            setSaving(true);
            setFormError('');
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': getHeaders().Authorization }, // Content-Type must be undefined for FormData
                body: formData
            });
            if (res.ok) {
                setModalOpen(false);
                fetchData();
            } else {
                const data = await res.json().catch(() => ({}));
                setFormError(data.error || 'Error al guardar');
            }
        } catch (error) {
            console.error(error);
            setFormError('No se pudo guardar. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    const removeProducto = async () => {
        if (!editing || saving) return;
        const accepted = window.confirm(`¿Eliminar el producto "${editing.nombre}"?`);
        if (!accepted) return;

        try {
            setSaving(true);
            setFormError('');
            const res = await fetch(`${API_URL}/productos/${editing.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setFormError(data.error || 'No se pudo eliminar el producto');
                return;
            }

            setModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            setFormError('No se pudo eliminar. Verifica tu conexión.');
        } finally {
            setSaving(false);
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
                                                <img src={resolveImageUrl(p.image_url)} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

            <Modal open={modalOpen} onClose={() => { if (!saving) setModalOpen(false); }}
                title={editing ? 'Editar Producto' : 'Nuevo Producto'}
                footer={<>
                    {editing && (
                        <button className="btn btn-secondary" style={{ borderColor: '#dc2626', color: '#dc2626' }} onClick={removeProducto} disabled={saving}>
                            <i className="bi bi-trash"></i> Eliminar
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        <i className="bi bi-check-lg"></i> {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
                    </button>
                </>}>
                {formError && (
                    <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
                        <i className="bi bi-exclamation-circle"></i> {formError}
                    </div>
                )}
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
                            {categorias.map(c => <option key={c.id} value={String(c.id)}>{c.nombre} ({tipoLabels[c.tipo]})</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Precio Base (S/.)</label>
                        <input className="form-input" type="number" step="0.01" value={form.precio_base} onChange={e => setForm({ ...form, precio_base: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Material</label>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={createMaterial} disabled={saving}>
                                <i className="bi bi-plus-lg"></i> Crear material
                            </button>
                        </div>
                        <select className="form-select" value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })}>
                            <option value="">Ninguno / Por defecto</option>
                            {materiales.map(m => <option key={m.id} value={String(m.id)}>{m.nombre} (Stock: {m.stock_actual} {m.unidad})</option>)}
                        </select>
                        {materiales.length === 0 && (
                            <small style={{ color: 'var(--color-text-secondary)' }}>
                                No hay materiales en inventario. Crea uno para asignarlo al producto.
                            </small>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Imagen</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => handleImageChange(e.target.files?.[0])}
                        />
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: 10,
                            padding: 'var(--space-3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-3)',
                            minHeight: 76
                        }}>
                            {imagePreviewUrl ? (
                                <img src={imagePreviewUrl} alt="Preview producto" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 56, height: 56, borderRadius: 8, border: '1px dashed var(--color-border)', display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)' }}>
                                    <i className="bi bi-image"></i>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => fileInputRef.current?.click()}>
                                    <i className="bi bi-pencil"></i> {imagePreviewUrl ? 'Cambiar imagen' : 'Subir imagen'}
                                </button>
                                {form.image && <small style={{ color: 'var(--color-text-secondary)' }}>{form.image.name}</small>}
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tiempo estimado (días)</label>
                        <input className="form-input" type="number" value={form.tiempo_estimado_dias} onChange={e => setForm({ ...form, tiempo_estimado_dias: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '28px' }}>
                        <label style={{ margin: 0 }}>Visible</label>
                        <label className="switch" style={{ margin: 0 }}>
                            <input type="checkbox" checked={!!form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} />
                            <span className="slider round"></span>
                        </label>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Productos;
