import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';
import { resolveImageUrl, resolveProductImageUrl } from '../utils/resolveImageUrl.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ProductCatalogCard from '../components/orders/ProductCatalogCard.jsx';
import CustomSelect from '../components/CustomSelect.jsx';

const Productos = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [filtroCategoria, setFiltroCategoria] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Product Modal & Form
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        nombre: '',
        descripcion: '',
        categoria_id: '',
        precio_base: '',
        material_id: '',
        tiempo_estimado_dias: 5,
        visible: true,
        admite_puente: false,
        modo_odontograma: 'unitario',
        image: null,
        image_url: ''
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const fileInputRef = useRef(null);

    // On-the-fly category creation inside Product modal
    const [showInlineCat, setShowInlineCat] = useState(false);
    const [inlineCatName, setInlineCatName] = useState('');
    const [inlineCatError, setInlineCatError] = useState('');
    const [savingInlineCat, setSavingInlineCat] = useState(false);

    // Manage Categories Modal
    const [catModalOpen, setCatModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCatId, setEditingCatId] = useState(null);
    const [editingCatName, setEditingCatName] = useState('');
    const [catModalError, setCatModalError] = useState('');
    const [catActionLoading, setCatActionLoading] = useState(false);
    const [catToDelete, setCatToDelete] = useState(null);

    const refreshCategorias = async () => {
        try {
            const res = await fetch(`${API_URL}/categorias`, { headers: getHeaders() });
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setCategorias(list);
            return list;
        } catch (error) {
            console.error(error);
            return [];
        }
    };

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
        setForm({
            nombre: '',
            descripcion: '',
            categoria_id: '',
            precio_base: '',
            material_id: '',
            tiempo_estimado_dias: 5,
            visible: true,
            admite_puente: false,
            modo_odontograma: 'unitario',
            image: null,
            image_url: ''
        });
        setFormError('');
        setImagePreviewUrl('');
        setShowInlineCat(false);
        setInlineCatName('');
        setInlineCatError('');
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
            admite_puente: Boolean(p.admite_puente),
            modo_odontograma: p.modo_odontograma || (p.admite_puente ? 'puente' : 'unitario'),
            image: null,
            image_url: p.image_url || ''
        });
        setFormError('');
        setImagePreviewUrl(resolveProductImageUrl(p));
        setShowInlineCat(false);
        setInlineCatName('');
        setInlineCatError('');
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

    // Create category on the fly in product form
    const handleCreateInlineCat = async () => {
        const name = inlineCatName.trim();
        if (!name) return;

        try {
            setSavingInlineCat(true);
            setInlineCatError('');
            const res = await fetch(`${API_URL}/categorias`, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: name })
            });
            const data = await res.json();
            if (!res.ok) {
                setInlineCatError(data.error || 'Error al crear la categoría');
                return;
            }
            await refreshCategorias();
            setForm(prev => ({ ...prev, categoria_id: String(data.id) }));
            setShowInlineCat(false);
            setInlineCatName('');
        } catch (err) {
            setInlineCatError('No se pudo conectar con el servidor');
        } finally {
            setSavingInlineCat(false);
        }
    };

    // Category modal handlers
    const handleAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;

        try {
            setCatActionLoading(true);
            setCatModalError('');
            const res = await fetch(`${API_URL}/categorias`, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: name })
            });
            const data = await res.json();
            if (!res.ok) {
                setCatModalError(data.error || 'Error al crear categoría');
                return;
            }
            setNewCategoryName('');
            await refreshCategorias();
        } catch (err) {
            setCatModalError('Error al comunicarse con el servidor');
        } finally {
            setCatActionLoading(false);
        }
    };

    const handleSaveEditCategory = async (id) => {
        const name = editingCatName.trim();
        if (!name) return;

        try {
            setCatActionLoading(true);
            setCatModalError('');
            const res = await fetch(`${API_URL}/categorias/${id}`, {
                method: 'PUT',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: name })
            });
            const data = await res.json();
            if (!res.ok) {
                setCatModalError(data.error || 'Error al actualizar categoría');
                return;
            }
            setEditingCatId(null);
            setEditingCatName('');
            await refreshCategorias();
            fetchData();
        } catch (err) {
            setCatModalError('Error al comunicarse con el servidor');
        } finally {
            setCatActionLoading(false);
        }
    };

    const handleDeleteCategory = async (cat) => {
        try {
            setCatActionLoading(true);
            setCatModalError('');
            const res = await fetch(`${API_URL}/categorias/${cat.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            const data = await res.json();
            if (!res.ok) {
                setCatModalError(data.error || 'No se pudo eliminar la categoría');
                return;
            }
            setCatToDelete(null);
            if (filtroCategoria === String(cat.id)) {
                setFiltroCategoria('all');
            }
            await refreshCategorias();
        } catch (err) {
            setCatModalError('Error al comunicarse con el servidor');
        } finally {
            setCatActionLoading(false);
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
        formData.append('admite_puente', form.modo_odontograma === 'puente');
        formData.append('modo_odontograma', form.modo_odontograma || 'unitario');
        if (form.image) {
            formData.append('image', form.image);
        }

        try {
            setSaving(true);
            setFormError('');
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': getHeaders().Authorization },
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

    const productCountByCat = useMemo(() => {
        const counts = {};
        productos.forEach(p => {
            if (p.categoria_id) {
                counts[p.categoria_id] = (counts[p.categoria_id] || 0) + 1;
            }
        });
        return counts;
    }, [productos]);

    // Group products dynamically by Category
    const grouped = useMemo(() => {
        const map = new Map();
        categorias.forEach(c => {
            if (filtroCategoria !== 'all' && String(filtroCategoria) !== String(c.id)) return;
            map.set(String(c.id), { id: String(c.id), nombre: c.nombre, productos: [] });
        });

        const uncategorized = { id: 'uncategorized', nombre: 'Sin categoría', productos: [] };

        productos.forEach(p => {
            if (filtroCategoria !== 'all' && String(filtroCategoria) !== String(p.categoria_id)) return;
            const catId = p.categoria_id ? String(p.categoria_id) : null;
            if (catId && map.has(catId)) {
                map.get(catId).productos.push(p);
            } else if (catId) {
                const name = p.categoria_nombre || 'Categoría';
                map.set(catId, { id: catId, nombre: name, productos: [p] });
            } else {
                uncategorized.productos.push(p);
            }
        });

        const list = Array.from(map.values()).filter(g => g.productos.length > 0);
        if (uncategorized.productos.length > 0 && (filtroCategoria === 'all' || filtroCategoria === 'uncategorized')) {
            list.push(uncategorized);
        }
        return list;
    }, [productos, categorias, filtroCategoria]);

    const toggleVisibility = async (e, p) => {
        e.stopPropagation();
        try {
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
        <div className="animate-fade-in page-container">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>
                        <i className="bi bi-box-seam text-primary" aria-hidden="true"></i> Catálogo de Productos
                    </h1>
                    <p>Servicios y trabajos del laboratorio</p>
                </div>
                <div className="productos-header-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setCatModalOpen(true);
                            setCatModalError('');
                            setEditingCatId(null);
                            setEditingCatName('');
                            setNewCategoryName('');
                        }}
                    >
                        <i className="bi bi-tags"></i>
                        <span className="productos-btn-label-desktop">Gestionar Categorías</span>
                        <span className="productos-btn-label-mobile">Categorías</span>
                    </button>
                    <button className="btn btn-primary" onClick={openNew}>
                        <i className="bi bi-plus-lg"></i>
                        <span>Nuevo Producto</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card productos-filters-card">
                <div className="productos-filters-row">
                    <div className="search-box productos-search-box">
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="productos-filter-chips-scroller">
                        <div className="productos-filter-chips" role="group" aria-label="Filtrar por categoría">
                            <button
                                type="button"
                                className={`btn btn-sm pedidos-filter-chip${filtroCategoria === 'all' ? ' is-active' : ''}`}
                                onClick={(e) => {
                                    setFiltroCategoria('all');
                                    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                            >
                                Todos
                            </button>
                            {categorias.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className={`btn btn-sm pedidos-filter-chip${String(filtroCategoria) === String(c.id) ? ' is-active' : ''}`}
                                    onClick={(e) => {
                                        setFiltroCategoria(String(filtroCategoria) === String(c.id) ? 'all' : String(c.id));
                                        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                    }}
                                >
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Products grid by Category */}
            {loading ? (
                <div className="catalog-products-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton catalog-product-skeleton" />)}
                </div>
            ) : productos.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <i className="bi bi-box-seam empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin productos registrados</h3>
                        <p className="empty-state-text">Agrega productos para poder crear pedidos</p>
                    </div>
                </div>
            ) : grouped.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <i className="bi bi-search empty-state-icon"></i>
                        <h3 className="empty-state-title">No se encontraron productos</h3>
                        <p className="empty-state-text">Intenta ajustar los filtros de búsqueda o categoría</p>
                    </div>
                </div>
            ) : (
                grouped.map(group => (
                    <div key={group.id} className="catalog-group productos-group">
                        <div className="catalog-group-header">
                            <div className="catalog-group-accent" />
                            <h2 className="catalog-group-title">{group.nombre}</h2>
                            <span className="catalog-group-count">
                                {group.productos.length} producto{group.productos.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="catalog-products-grid">
                            {group.productos.map(p => (
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

            {/* Product Modal */}
            <Modal
                open={modalOpen}
                onClose={() => { if (!saving && !deleteConfirmOpen) setModalOpen(false); }}
                icon="bi-box-seam-fill"
                kicker="Catálogo Técnico Dental"
                title={editing ? 'Editar Producto' : 'Nuevo Producto'}
                subtitle="Configuración comercial, tiempo de fabricación y reglas técnicas"
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
                        <i className="bi bi-check-lg"></i> {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Producto'}
                    </button>
                </>}
            >
                {formError && (
                    <div className="alert alert-error productos-modal-alert">
                        <i className="bi bi-exclamation-circle"></i> {formError}
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Nombre del Producto *</label>
                        <div className="form-input-box has-lead">
                            <i className="bi bi-tag-fill input-icon-lead"></i>
                            <input
                                className="form-input"
                                value={form.nombre}
                                onChange={e => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej. Corona Zirconia Monolítica"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Descripción Técnica</label>
                        <textarea
                            className="form-textarea"
                            value={form.descripcion}
                            onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Indicaciones, traslucidez, características del material..."
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>Categoría</label>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', color: 'var(--color-primary)' }}
                                    onClick={() => {
                                        setShowInlineCat(!showInlineCat);
                                        setInlineCatName('');
                                        setInlineCatError('');
                                    }}
                                    disabled={saving}
                                >
                                    <i className="bi bi-plus-circle"></i> Nueva
                                </button>
                            </div>
                            {showInlineCat && (
                                <div style={{
                                    marginBottom: '0.6rem',
                                    padding: '0.5rem',
                                    background: 'var(--color-surface-hover, rgba(0,0,0,0.03))',
                                    borderRadius: 'var(--border-radius-sm)',
                                    border: '1px dashed var(--color-border)'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="form-input form-input-sm"
                                            placeholder="Nombre de la categoría..."
                                            value={inlineCatName}
                                            onChange={(e) => setInlineCatName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleCreateInlineCat();
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={handleCreateInlineCat}
                                            disabled={savingInlineCat || !inlineCatName.trim()}
                                        >
                                            {savingInlineCat ? '...' : 'Crear'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => {
                                                setShowInlineCat(false);
                                                setInlineCatName('');
                                                setInlineCatError('');
                                            }}
                                        >
                                            <i className="bi bi-x"></i>
                                        </button>
                                    </div>
                                    {inlineCatError && (
                                        <small style={{ color: 'var(--color-danger, #ef4444)', display: 'block', marginTop: '0.3rem' }}>
                                            {inlineCatError}
                                        </small>
                                    )}
                                </div>
                            )}
                            <CustomSelect
                                value={form.categoria_id}
                                onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                                placeholder="Seleccionar categoría..."
                                searchable={categorias.length > 5}
                                options={[
                                    { value: '', label: 'Seleccionar categoría...' },
                                    ...categorias.map(c => ({ value: String(c.id), label: c.nombre }))
                                ]}
                            />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Precio Base Oficial</label>
                            <div className="form-input-box has-prefix">
                                <span className="input-badge-prefix">S/.</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={form.precio_base}
                                    onChange={e => setForm({ ...form, precio_base: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <div className="productos-material-header" style={{ marginBottom: '0.35rem' }}>
                                <label className="form-label productos-material-label" style={{ marginBottom: 0 }}>Material Asociado</label>
                                <button
                                    className="btn btn-ghost btn-xs"
                                    type="button"
                                    onClick={createMaterial}
                                    disabled={saving}
                                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', color: 'var(--color-primary)' }}
                                >
                                    <i className="bi bi-plus-circle"></i> Crear
                                </button>
                            </div>
                            <CustomSelect
                                value={form.material_id}
                                onChange={e => setForm({ ...form, material_id: e.target.value })}
                                placeholder="Ninguno / Por defecto"
                                searchable={materiales.length > 5}
                                options={[
                                    { value: '', label: 'Ninguno / Por defecto' },
                                    ...materiales.map(m => ({
                                        value: String(m.id),
                                        label: `${m.nombre} (Stock: ${m.stock_actual} ${m.unidad})`
                                    }))
                                ]}
                            />
                            {materiales.length === 0 && (
                                <small className="productos-material-empty">
                                    No hay materiales en inventario. Crea uno para asignarlo al producto.
                                </small>
                            )}
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Tiempo Estimado</label>
                            <div className="form-input-box has-lead has-suffix">
                                <i className="bi bi-clock-history input-icon-lead"></i>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={form.tiempo_estimado_dias}
                                    onChange={e => setForm({ ...form, tiempo_estimado_dias: e.target.value })}
                                    placeholder="2"
                                />
                                <span className="input-badge-suffix">días hab.</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Imagen Referencial</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="productos-hidden-file-input"
                            onChange={e => handleImageChange(e.target.files?.[0])}
                        />
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            background: 'var(--color-bg-alt, #f8fafc)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                {imagePreviewUrl ? (
                                    <img
                                        src={imagePreviewUrl}
                                        alt="Preview producto"
                                        style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--color-border)', background: '#fff' }}
                                    />
                                ) : (
                                    <div style={{ width: '46px', height: '46px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '1.25rem' }}>
                                        <i className="bi bi-image"></i>
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                        {form.image ? form.image.name : imagePreviewUrl ? 'Imagen actual del catálogo' : 'Sin imagen asignada'}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                                        Formatos recomendados: JPG o PNG
                                    </div>
                                </div>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                style={{ flexShrink: 0 }}
                            >
                                <i className="bi bi-camera"></i> {imagePreviewUrl ? 'Cambiar' : 'Subir'}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                        <div className="form-option-row">
                            <div className="form-option-content">
                                <div className="form-option-icon">
                                    <i className="bi bi-eye-fill"></i>
                                </div>
                                <div>
                                    <h4 className="form-option-title">Visible en Catálogo</h4>
                                    <p className="form-option-desc">Disponible para órdenes directas de clínicas</p>
                                </div>
                            </div>
                            <label className="switch" style={{ margin: 0 }}>
                                <input type="checkbox" checked={!!form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="form-group" style={{ margin: '0.5rem 0' }}>
                            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="bi bi-diagram-3-fill" style={{ color: 'var(--color-primary, #2563eb)' }}></i>
                                Modo de Odontograma y Selección Clínica
                            </label>
                            <CustomSelect
                                value={form.modo_odontograma || 'unitario'}
                                onChange={e => {
                                    const nextModo = e.target.value;
                                    setForm({
                                        ...form,
                                        modo_odontograma: nextModo,
                                        admite_puente: nextModo === 'puente'
                                    });
                                }}
                                options={[
                                    { value: 'unitario', label: 'Corona / Unitario (Pieza a pieza, 1 clic)' },
                                    { value: 'puente', label: 'Puente Fijo (Arrastre de tramos, pilares y pónticos)' },
                                    { value: 'carilla', label: 'Carillas (Sector anterior, premolares y molares)' },
                                    { value: 'arcada', label: 'Arcada Completa (Férulas, Prótesis Totales — cobro por arcada)' },
                                    { value: 'guia_quirurgica', label: 'Guía Quirúrgica (Sitios de implantes, hasta 5 por arcada)' },
                                    { value: 'ninguno', label: 'Sin Odontograma (Accesorios, modelos de estudio)' }
                                ]}
                            />
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '6px', marginBottom: 0 }}>
                                {form.modo_odontograma === 'puente' && 'Permite arrastrar tramos entre piezas del mismo arco, calculando pilares y pónticos.'}
                                {form.modo_odontograma === 'carilla' && 'Permite seleccionar cualquier pieza dental individual sin restricción en molares.'}
                                {form.modo_odontograma === 'arcada' && 'Permite marcar la arcada completa (Superior/Inferior). La cantidad se cobra por arcada (1 o 2), no por diente.'}
                                {form.modo_odontograma === 'guia_quirurgica' && 'Marca sitios de perforación de implantes. Hasta 5 implantes por arcada se cobran como 1 guía.'}
                                {form.modo_odontograma === 'unitario' && 'Selección tradicional diente por diente. La cantidad equivale al total de piezas seleccionadas.'}
                                {form.modo_odontograma === 'ninguno' && 'Omite el odontograma interactivo en el pedido.'}
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Manage Categories Modal */}
            <Modal
                open={catModalOpen}
                onClose={() => { if (!catActionLoading) setCatModalOpen(false); }}
                title="Gestionar Categorías"
                kicker="Catálogo • Clasificación"
                subtitle="Gestión de familias y categorías de trabajos protésicos"
                icon="bi-grid"
                footer={(
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setCatModalOpen(false)}
                        disabled={catActionLoading}
                    >
                        Cerrar
                    </button>
                )}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                        Administra las categorías de trabajos del laboratorio. Los cambios se reflejarán de inmediato en el catálogo y los pedidos.
                    </p>

                    {/* New Category Input */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="form-input-box has-lead" style={{ flex: 1 }}>
                            <i className="bi bi-folder-plus form-input-lead" aria-hidden="true" />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Nombre de la nueva categoría (ej. Férulas, Guías)..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCategory();
                                    }
                                }}
                                disabled={catActionLoading}
                                autoFocus
                            />
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleAddCategory}
                            disabled={catActionLoading || !newCategoryName.trim()}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            <i className="bi bi-plus-lg"></i> Agregar
                        </button>
                    </div>

                    {catModalError && (
                        <div className="alert alert-error" style={{ margin: 0 }}>
                            <i className="bi bi-exclamation-circle"></i> {catModalError}
                        </div>
                    )}

                    {/* Category List */}
                    <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {categorias.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1rem' }}>
                                No hay categorías registradas.
                            </p>
                        ) : (
                            categorias.map(c => {
                                const isEditing = editingCatId === c.id;
                                const count = productCountByCat[c.id] || 0;

                                return (
                                    <div
                                        key={c.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.65rem 0.85rem',
                                            borderRadius: 'var(--border-radius-sm)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-surface)'
                                        }}
                                    >
                                        {isEditing ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    className="form-input form-input-sm"
                                                    value={editingCatName}
                                                    onChange={(e) => setEditingCatName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveEditCategory(c.id);
                                                        }
                                                    }}
                                                    autoFocus
                                                    disabled={catActionLoading}
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleSaveEditCategory(c.id)}
                                                    disabled={catActionLoading || !editingCatName.trim()}
                                                    title="Guardar nombre"
                                                >
                                                    <i className="bi bi-check-lg"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setEditingCatId(null);
                                                        setEditingCatName('');
                                                    }}
                                                    disabled={catActionLoading}
                                                    title="Cancelar"
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                        ({count} producto{count !== 1 ? 's' : ''})
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => {
                                                            setEditingCatId(c.id);
                                                            setEditingCatName(c.nombre);
                                                            setCatModalError('');
                                                        }}
                                                        disabled={catActionLoading}
                                                        title="Editar nombre"
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ color: 'var(--color-danger, #ef4444)' }}
                                                        onClick={() => {
                                                            setCatModalError('');
                                                            setCatToDelete(c);
                                                        }}
                                                        disabled={catActionLoading}
                                                        title="Eliminar categoría"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

            {/* Confirm Category Delete */}
            <ConfirmDialog
                open={Boolean(catToDelete)}
                onClose={() => { if (!catActionLoading) setCatToDelete(null); }}
                onConfirm={() => catToDelete && handleDeleteCategory(catToDelete)}
                confirming={catActionLoading}
                variant="danger"
                title="Eliminar categoría"
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                message={(
                    <>
                        <p>
                            ¿Eliminar la categoría <strong>{catToDelete?.nombre}</strong>?
                        </p>
                        <p style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            Solo se puede eliminar si no tiene productos asignados actualmente.
                        </p>
                    </>
                )}
            />

            {/* Confirm Product Delete */}
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
