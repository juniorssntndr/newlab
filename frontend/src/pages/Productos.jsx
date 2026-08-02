import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';
import { resolveImageUrl, resolveProductImageUrl } from '../utils/resolveImageUrl.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ProductCatalogCard from '../components/orders/ProductCatalogCard.jsx';

const tipoLabels = { fija: 'Prótesis Fija', implante: 'Sobre Implantes', removible: 'Removible (PPR)', especialidad: 'Especialidades' };
const tipoColors = { fija: '#0891B2', implante: '#8B5CF6', removible: '#F59E0B', especialidad: '#10B981' };

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
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const fileInputRef = useRef(null);

    const fetchData = () => {
        const params = new URLSearchParams();
        params.set('activo', 'true');
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
        setImagePreviewUrl(resolveProductImageUrl(p));
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

        const deletedId = editing.id;

        try {
            setSaving(true);
            setFormError('');
            const res = await fetch(`${API_URL}/productos/${deletedId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setFormError(data.error || 'No se pudo eliminar el producto');
                setDeleteConfirmOpen(false);
                return;
            }

            setProductos((prev) => prev.filter((p) => p.id !== deletedId));
            setDeleteConfirmOpen(false);
            setModalOpen(false);
            setEditing(null);
            fetchData();
        } catch (error) {
            console.error(error);
            setFormError('No se pudo eliminar. Verifica tu conexión.');
            setDeleteConfirmOpen(false);
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
                    <div className="productos-filter-chips" role="group" aria-label="Filtrar por tipo">
                        <button
                            type="button"
                            className={`btn btn-sm pedidos-filter-chip${!filtroTipo ? ' is-active' : ''}`}
                            onClick={() => setFiltroTipo('')}
                        >
                            Todos
                        </button>
                        {Object.entries(tipoLabels).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                className={`btn btn-sm pedidos-filter-chip${filtroTipo === key ? ' is-active' : ''}`}
                                onClick={() => setFiltroTipo(filtroTipo === key ? '' : key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Products grid by type */}
            {loading ? (
                <div className="catalog-products-grid">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton catalog-product-skeleton" />)}</div>
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
                    <div key={tipo} className="catalog-group productos-group">
                        <div
                            className="catalog-group-header"
                            style={{ '--tipo-accent': tipoColors[tipo] || 'var(--color-primary)' }}
                        >
                            <div
                                className="catalog-group-accent"
                                style={{ background: tipoColors[tipo] || undefined }}
                            />
                            <h2 className="catalog-group-title">{tipoLabels[tipo] || tipo}</h2>
                            <span className="catalog-group-count">
                                {prods.length} producto{prods.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="catalog-products-grid">
                            {prods.map(p => (
                                <ProductCatalogCard
                                    key={p.id}
                                    producto={p}
                                    className={p.visible ? '' : 'is-hidden'}
                                    ctaLabel="Editar producto"
                                    ctaIcon="bi-pencil"
                                    onOrder={() => openEdit(p)}
                                    mediaOverlay={(
                                        <div
                                            className="productos-card-visibility-chip"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <label className="switch productos-card-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={!!p.visible}
                                                    onChange={(e) => toggleVisibility(e, p)}
                                                    aria-label={p.visible ? 'Ocultar producto' : 'Mostrar producto'}
                                                />
                                                <span className="slider round" />
                                            </label>
                                            <span className="productos-card-visibility-text">
                                                {p.visible ? 'Visible' : 'Oculto'}
                                            </span>
                                        </div>
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}

            <Modal open={modalOpen} onClose={() => { if (!saving && !deleteConfirmOpen) setModalOpen(false); }}
                title={editing ? 'Editar Producto' : 'Nuevo Producto'}
                footer={<>
                    {editing && (
                        <button
                            type="button"
                            className="btn btn-secondary productos-modal-delete-btn"
                            onClick={() => setDeleteConfirmOpen(true)}
                            disabled={saving}
                        >
                            <i className="bi bi-trash"></i> Eliminar
                        </button>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving || deleteConfirmOpen}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={save} disabled={saving || deleteConfirmOpen}>
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

            <ConfirmDialog
                open={deleteConfirmOpen}
                onClose={() => { if (!saving) setDeleteConfirmOpen(false); }}
                onConfirm={removeProducto}
                confirming={saving}
                variant="danger"
                title="Eliminar producto"
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                message={(
                    <>
                        <p>
                            ¿Eliminar <strong>{editing?.nombre}</strong>?
                        </p>
                        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            Dejará de aparecer en el catálogo y en nuevos pedidos. Los pedidos históricos no se modifican.
                        </p>
                    </>
                )}
            />
        </div>
    );
};

export default Productos;
