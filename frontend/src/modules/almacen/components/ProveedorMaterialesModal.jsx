import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../../components/Modal.jsx';
import CustomSelect from '../../../components/CustomSelect.jsx';
import { useAuth } from '../../../state/AuthContext.jsx';
import { API_URL } from '../../../config.js';
import toast from 'react-hot-toast';

export const ProveedorMaterialesModal = ({
    isOpen,
    onClose,
    proveedorId,
    materialesInventario = [],
    onUpdated
}) => {
    const { getHeaders } = useAuth();
    const [loading, setLoading] = useState(false);
    const [proveedor, setProveedor] = useState(null);
    const [items, setItems] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingItemId, setEditingItemId] = useState(null);

    const initialItemForm = {
        material_id: '',
        descripcion_item: '',
        codigo_catalogo: '',
        ultimo_precio: '',
        moneda: 'PEN',
        fecha_ultimo_precio: new Date().toISOString().slice(0, 10),
        tiempo_entrega_dias: 1,
        es_proveedor_habitual: false,
        notas: '',
    };
    const [itemForm, setItemForm] = useState(initialItemForm);

    const loadProveedorData = useCallback(async () => {
        if (!proveedorId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/proveedores/${proveedorId}`, {
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('No se pudo cargar la información del proveedor');
            const data = await res.json();
            setProveedor(data);
            setItems(data.materiales || []);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [proveedorId, getHeaders]);

    useEffect(() => {
        if (isOpen && proveedorId) {
            loadProveedorData();
            setShowAddForm(false);
            setEditingItemId(null);
            setItemForm(initialItemForm);
        }
    }, [isOpen, proveedorId, loadProveedorData]);

    const handleSelectMaterial = (materialId) => {
        const mat = materialesInventario.find(m => String(m.id) === String(materialId));
        setItemForm(prev => ({
            ...prev,
            material_id: materialId,
            descripcion_item: mat ? mat.nombre : prev.descripcion_item
        }));
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!itemForm.descripcion_item.trim() && !itemForm.material_id) {
            toast.error('Selecciona un material o escribe una descripción del ítem');
            return;
        }
        if (itemForm.ultimo_precio === '' || Number(itemForm.ultimo_precio) < 0) {
            toast.error('Ingresa un último precio válido');
            return;
        }

        try {
            const url = editingItemId
                ? `${API_URL}/proveedores/${proveedorId}/materiales/${editingItemId}`
                : `${API_URL}/proveedores/${proveedorId}/materiales`;
            const method = editingItemId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemForm)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al guardar el ítem');
            }

            toast.success(editingItemId ? 'Precio actualizado' : 'Insumo vinculado con éxito');
            setShowAddForm(false);
            setEditingItemId(null);
            setItemForm(initialItemForm);
            loadProveedorData();
            onUpdated?.();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleEditItem = (item) => {
        setEditingItemId(item.id);
        setItemForm({
            material_id: item.material_id ? String(item.material_id) : '',
            descripcion_item: item.descripcion_item || '',
            codigo_catalogo: item.codigo_catalogo || '',
            ultimo_precio: item.ultimo_precio || '',
            moneda: item.moneda || 'PEN',
            fecha_ultimo_precio: item.fecha_ultimo_precio ? String(item.fecha_ultimo_precio).slice(0, 10) : new Date().toISOString().slice(0, 10),
            tiempo_entrega_dias: item.tiempo_entrega_dias || 1,
            es_proveedor_habitual: Boolean(item.es_proveedor_habitual),
            notas: item.notas || '',
        });
        setShowAddForm(true);
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('¿Seguro que deseas desvincular este ítem del proveedor?')) return;
        try {
            const res = await fetch(`${API_URL}/proveedores/${proveedorId}/materiales/${itemId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Error al desvincular el ítem');
            toast.success('Ítem desvinculado');
            loadProveedorData();
            onUpdated?.();
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title={`Catálogo de Insumos y Precios: ${proveedor?.razon_social || 'Proveedor'}`}
            subtitle={proveedor ? `${proveedor.tipo_documento}: ${proveedor.numero_documento || 'Sin doc'} • ${proveedor.contacto_nombre ? 'Contacto: ' + proveedor.contacto_nombre + ' • ' : ''}Tel: ${proveedor.telefono || '—'}` : 'Cargando...'}
            icon="bi bi-tags-fill"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Resumen del proveedor */}
                {proveedor && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        background: 'var(--color-bg-alt, #f8fafc)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                    }}>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Especialidad</span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                {proveedor.tipo_proveedor === 'materiales' ? '📦 Insumos / Stock' : proveedor.tipo_proveedor === 'servicios' ? '🛠️ Servicios / Soporte' : '🔄 Mixto'}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Condición de Pago</span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                {proveedor.condicion_pago?.replace('_', ' ') || 'Contado'}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Ubicación</span>
                            <span style={{ fontWeight: 600 }}>
                                {proveedor.ciudad || 'Arequipa'}{proveedor.direccion ? ` - ${proveedor.direccion}` : ''}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Total Ítems Vinculados</span>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Botón para abrir formulario de adición */}
                {!showAddForm && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                            <i className="bi bi-box-seam text-primary" style={{ marginRight: '6px' }}></i>
                            Lista de Insumos y Últimos Precios
                        </h4>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                                setEditingItemId(null);
                                setItemForm(initialItemForm);
                                setShowAddForm(true);
                            }}
                        >
                            <i className="bi bi-plus-lg"></i> Vincular Nuevo Insumo / Precio
                        </button>
                    </div>
                )}

                {/* Formulario desplegable para agregar/editar ítem */}
                {showAddForm && (
                    <div style={{
                        padding: '1.25rem',
                        background: 'var(--color-bg-card, #ffffff)',
                        border: '1px solid var(--color-primary)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h5 style={{ margin: 0, fontWeight: 700, color: 'var(--color-primary)' }}>
                                <i className={`bi ${editingItemId ? 'bi-pencil-square' : 'bi-plus-circle'}`} style={{ marginRight: '6px' }}></i>
                                {editingItemId ? 'Editar Precio de Ítem' : 'Vincular Insumo o Servicio con Precio'}
                            </h5>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setEditingItemId(null);
                                }}
                            >
                                <i className="bi bi-x-lg"></i> Cancelar
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>
                                        Material de Inventario (Opcional)
                                    </label>
                                    <CustomSelect
                                        value={itemForm.material_id}
                                        onChange={(e, val) => handleSelectMaterial(val !== undefined ? val : e.target.value)}
                                        placeholder="-- No vincular a material físico (o servicio) --"
                                        searchable={materialesInventario.length > 5}
                                        options={[
                                            { value: '', label: '-- No vincular a material físico (o servicio) --' },
                                            ...materialesInventario.map(m => ({
                                                value: String(m.id),
                                                label: `${m.nombre} (${m.unidad || 'unidad'}) - Stock: ${m.stock_actual}`
                                            }))
                                        ]}
                                    />
                                    <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem' }}>
                                        Vincularlo permite cruzar alertas de bajo stock con este proveedor.
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>
                                        Descripción / Nombre del Ítem <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. Disco Zirconia Multicapa 98mm 16mm"
                                        value={itemForm.descripcion_item}
                                        onChange={(e) => setItemForm({ ...itemForm, descripcion_item: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>
                                        Último Precio <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="0.00"
                                        value={itemForm.ultimo_precio}
                                        onChange={(e) => setItemForm({ ...itemForm, ultimo_precio: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Moneda</label>
                                    <CustomSelect
                                        value={itemForm.moneda}
                                        onChange={(e, val) => setItemForm({ ...itemForm, moneda: val !== undefined ? val : e.target.value })}
                                        options={[
                                            { value: 'PEN', label: 'Soles (PEN S/)' },
                                            { value: 'USD', label: 'Dólares (USD $)' }
                                        ]}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>SKU / Código Proveedor</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej. ZIRC-9816"
                                        value={itemForm.codigo_catalogo}
                                        onChange={(e) => setItemForm({ ...itemForm, codigo_catalogo: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Fecha Cotización / Compra</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={itemForm.fecha_ultimo_precio}
                                        onChange={(e) => setItemForm({ ...itemForm, fecha_ultimo_precio: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 600 }}>Entrega (días)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="form-input"
                                        placeholder="1"
                                        value={itemForm.tiempo_entrega_dias}
                                        onChange={(e) => setItemForm({ ...itemForm, tiempo_entrega_dias: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="es_habitual_chk"
                                    checked={itemForm.es_proveedor_habitual}
                                    onChange={(e) => setItemForm({ ...itemForm, es_proveedor_habitual: e.target.checked })}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="es_habitual_chk" style={{ fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Es proveedor habitual preferido para este insumo
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingItemId(null);
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary btn-sm">
                                    <i className="bi bi-check-lg"></i> {editingItemId ? 'Actualizar Precio' : 'Guardar en Catálogo'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tabla de insumos vinculados */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                        <div className="spinner-border text-primary" role="status"></div>
                        <p style={{ marginTop: '0.5rem' }}>Cargando catálogo del proveedor...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2.5rem 1rem',
                        border: '1px dashed var(--color-border, #cbd5e1)',
                        borderRadius: '8px',
                        color: 'var(--color-text-secondary)'
                    }}>
                        <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}></i>
                        <p style={{ margin: 0, fontWeight: 600 }}>Aún no hay insumos o precios registrados para este proveedor.</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                            Haz clic en <strong>Vincular Nuevo Insumo / Precio</strong> para registrar los costos de compra pactados.
                        </p>
                    </div>
                ) : (
                    <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Ítem / Material</th>
                                    <th>SKU / Catálogo</th>
                                    <th style={{ textAlign: 'right' }}>Último Precio</th>
                                    <th>Fecha Cotización</th>
                                    <th>Entrega</th>
                                    <th>Preferencia</th>
                                    <th style={{ textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>
                                                {item.descripcion_item || item.material_nombre || 'Sin descripción'}
                                            </div>
                                            {item.material_nombre && item.descripcion_item !== item.material_nombre && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                    <i className="bi bi-link-45deg"></i> Vinculado a: {item.material_nombre} ({item.material_unidad})
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <code style={{ fontSize: '0.8rem', background: 'var(--color-bg-alt)', padding: '2px 5px', borderRadius: '4px' }}>
                                                {item.codigo_catalogo || '—'}
                                            </code>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: item.moneda === 'USD' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                                                color: item.moneda === 'USD' ? '#059669' : '#0284c7',
                                                fontSize: '0.85rem',
                                                marginRight: '4px'
                                            }}>
                                                {item.moneda === 'USD' ? '$' : 'S/'}
                                            </span>
                                            {Number(item.ultimo_precio).toFixed(2)}
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem' }}>
                                                {item.fecha_ultimo_precio ? String(item.fecha_ultimo_precio).slice(0, 10) : '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem' }}>
                                                {item.tiempo_entrega_dias ? `${item.tiempo_entrega_dias} d` : '—'}
                                            </span>
                                        </td>
                                        <td>
                                            {item.es_proveedor_habitual ? (
                                                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                                                    ⭐ Habitual
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                                                    Alternativo
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    title="Editar precio o datos"
                                                    onClick={() => handleEditItem(item)}
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    title="Desvincular ítem"
                                                    style={{ color: '#ef4444' }}
                                                    onClick={() => handleDeleteItem(item.id)}
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ProveedorMaterialesModal;
