import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';

const tipoLabels = { fija: 'Prótesis Fija', implante: 'Sobre Implantes', removible: 'Removible (PPR)', especialidad: 'Especialidades' };
const tipoColors = { fija: '#0891B2', implante: '#8B5CF6', removible: '#F59E0B', especialidad: '#10B981' };
const BACKEND_BASE = API_URL.endsWith('/api')
    ? API_URL.slice(0, -4)
    : API_URL.startsWith('http') ? API_URL : '';

const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    return `${BACKEND_BASE}${imageUrl}`;
};

const Productos = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
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

    const createMaterial = () => {
        navigate('/almacen?newMaterial=1&flow=digital&returnTo=/productos');
        setModalOpen(false);
        setFormError('');
    };

    const refreshMateriales = async () => {
        try {
            const res = await fetch(`${API_URL}/inventory`, { headers: getHeaders() });
            const data = await res.json();
            setMateriales(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (!modalOpen) return;
        refreshMateriales();
    }, [modalOpen]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const createdMaterial = params.get('materialCreated');
        if (!createdMaterial) return;

        refreshMateriales().then(() => {
            setForm((prev) => ({ ...prev, material_id: createdMaterial }));
            window.history.replaceState({}, '', window.location.pathname);
        });
    }, []);

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
            <div className="card productos-filters-card">
                <div className="productos-filters-row">
                    <div className="search-box productos-search-box">
                        <i className="bi bi-search"></i>
                        <input className="form-input" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="productos-filter-chips">
                        <button className={`btn ${!filtroTipo ? 'btn-primary' : 'btn-secondary'} btn-sm productos-filter-chip`}
                            onClick={() => setFiltroTipo('')}>Todos</button>
                        {Object.entries(tipoLabels).map(([key, label]) => (
                            <button key={key} className={`btn ${filtroTipo === key ? 'btn-primary' : 'btn-secondary'} btn-sm productos-filter-chip`}
                                onClick={() => setFiltroTipo(filtroTipo === key ? '' : key)}
                                style={{ '--tipo-accent': tipoColors[key] }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Products grid by type */}
            {loading ? (
                <div className="grid grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="skeleton productos-skeleton-card" />)}</div>
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
                    <div key={tipo} className="productos-group">
                        <div className="productos-group-header" style={{ '--tipo-accent': tipoColors[tipo] || 'var(--color-primary)' }}>
                            <div className="productos-group-accent" />
                            <h2 className="productos-group-title">{tipoLabels[tipo] || tipo}</h2>
                            <span className="productos-group-count">
                                {prods.length} producto{prods.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="productos-grid">
                            {prods.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => openEdit(p)}
                                    className={`productos-card ${p.visible ? '' : 'is-hidden'}`.trim()}
                                >
                                    {/* Image area */}
                                    <div className="productos-card-media">
                                        {p.image_url ? (
                                            <img
                                                src={resolveImageUrl(p.image_url)}
                                                alt={p.nombre}
                                                className="productos-card-image"
                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <i className="bi bi-gem productos-card-media-icon" />
                                        )}
                                        {/* Category chip */}
                                        {p.categoria_nombre && (
                                            <span className="productos-card-category-chip">
                                                {p.categoria_nombre}
                                            </span>
                                        )}
                                        {/* Visibility toggle — stopPropagation so card click still opens edit */}
                                        <div
                                            onClick={e => e.stopPropagation()}
                                            className="productos-card-visibility-chip"
                                        >
                                            <label className="switch productos-card-switch">
                                                <input type="checkbox" checked={!!p.visible} onChange={(e) => toggleVisibility(e, p)} />
                                                <span className="slider round" />
                                            </label>
                                            <span className="productos-card-visibility-text">
                                                {p.visible ? 'Visible' : 'Oculto'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="productos-card-content">
                                        <h4 className="productos-card-title">
                                            {p.nombre}
                                        </h4>
                                        {p.material_nombre && (
                                            <p className="productos-card-material">
                                                <i className="bi bi-layers" />
                                                {p.material_nombre}
                                            </p>
                                        )}
                                        {p.descripcion && (
                                            <p className="productos-card-description">
                                                {p.descripcion}
                                            </p>
                                        )}
                                        <div className="productos-card-footer">
                                            <div className="productos-card-price">
                                                S/. {parseFloat(p.precio_base).toFixed(2)}
                                            </div>
                                            <div className="productos-card-time">
                                                <i className="bi bi-clock" />
                                                {p.tiempo_estimado_dias} días
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
                        <button className="btn btn-secondary productos-modal-delete-btn" onClick={removeProducto} disabled={saving}>
                            <i className="bi bi-trash"></i> Eliminar
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        <i className="bi bi-check-lg"></i> {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
                    </button>
                </>}>
                {formError && (
                    <div className="alert alert-error productos-modal-alert">
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
                        <div className="productos-material-header">
                            <label className="form-label productos-material-label">Material</label>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={createMaterial} disabled={saving}>
                                <i className="bi bi-plus-lg"></i> Crear material
                            </button>
                        </div>
                        <select className="form-select" value={form.material_id} onChange={e => setForm({ ...form, material_id: e.target.value })}>
                            <option value="">Ninguno / Por defecto</option>
                            {materiales.map(m => <option key={m.id} value={String(m.id)}>{m.nombre} (Stock: {m.stock_actual} {m.unidad})</option>)}
                        </select>
                        {materiales.length === 0 && (
                            <small className="productos-material-empty">
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
                            className="productos-hidden-file-input"
                            onChange={e => handleImageChange(e.target.files?.[0])}
                        />
                        <div className="productos-image-picker">
                            {imagePreviewUrl ? (
                                <img src={imagePreviewUrl} alt="Preview producto" className="productos-image-preview" />
                            ) : (
                                <div className="productos-image-placeholder">
                                    <i className="bi bi-image"></i>
                                </div>
                            )}
                            <div className="productos-image-picker-actions">
                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => fileInputRef.current?.click()}>
                                    <i className="bi bi-pencil"></i> {imagePreviewUrl ? 'Cambiar imagen' : 'Subir imagen'}
                                </button>
                                {form.image && <small className="productos-image-name">{form.image.name}</small>}
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tiempo estimado (días)</label>
                        <input className="form-input" type="number" value={form.tiempo_estimado_dias} onChange={e => setForm({ ...form, tiempo_estimado_dias: e.target.value })} />
                    </div>
                    <div className="form-group productos-visible-toggle-group">
                        <label className="productos-visible-label">Visible</label>
                        <label className="switch productos-visible-switch">
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
