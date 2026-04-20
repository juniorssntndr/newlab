import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';

const materialTemplates = {
    digital: [
        { nombre: 'Digital - Disco Zirconia Multicapa', categoria: 'disco', color: 'A2', unidad: 'disco', stock_minimo: 5 },
        { nombre: 'Digital - Bloque PMMA CAD/CAM', categoria: 'bloque', color: 'A2', unidad: 'bloque', stock_minimo: 8 },
        { nombre: 'Digital - Resina Modelos 3D', categoria: 'resina', color: 'beige', unidad: 'litro', stock_minimo: 4 },
        { nombre: 'Digital - Resina Guía Quirúrgica', categoria: 'resina', color: 'transparente', unidad: 'litro', stock_minimo: 3 },
        { nombre: 'Digital - Fresa Carburo', categoria: 'fresa', color: '', unidad: 'unidad', stock_minimo: 20 },
        { nombre: 'Digital - Film FEP Impresora', categoria: 'consumible', color: 'transparente', unidad: 'unidad', stock_minimo: 3 }
    ],
    analogico: [
        { nombre: 'Analogico - Aleación Cr-Co', unidad: 'kg', stock_minimo: 8 },
        { nombre: 'Analogico - Yeso Tipo IV', unidad: 'kg', stock_minimo: 20 },
        { nombre: 'Analogico - Revestimiento Fosfático', unidad: 'kg', stock_minimo: 10 },
        { nombre: 'Analogico - Acrílico Termocurable', unidad: 'kg', stock_minimo: 6 },
        { nombre: 'Analogico - Cerámica Feldespática', unidad: 'kit', stock_minimo: 4 },
        { nombre: 'Analogico - Arenado Óxido Aluminio 50um', unidad: 'kg', stock_minimo: 12 }
    ]
};

const units = [
    { value: 'unidad', label: 'Unidad (unidad)' },
    { value: 'disco', label: 'Disco' },
    { value: 'bloque', label: 'Bloque' },
    { value: 'litro', label: 'Litro' },
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'frasco', label: 'Frasco' },
    { value: 'kit', label: 'Kit' },
    { value: 'barra', label: 'Barra' },
    { value: 'caja', label: 'Caja' }
];

const Almacen = () => {
    const { getHeaders } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [materiales, setMateriales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [restoringId, setRestoringId] = useState(null);
    const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState(null);
    const [form, setForm] = useState({
        nombre: '',
        flujo: 'digital',
        categoria: 'resina',
        color: '',
        unidad: 'unidad',
        stock_actual: 0,
        stock_minimo: 5,
        alerta_bajo_stock: true,
        notas: ''
    });
    const [search, setSearch] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [materialView, setMaterialView] = useState('activos');

    const fetchMateriales = () => {
        setLoading(true);
        fetch(`${API_URL}/inventory?estado=todos`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                setMateriales(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchMateriales(); }, []);

    const openNew = () => {
        setEditing(null);
        setForm({
            nombre: '',
            flujo: 'digital',
            categoria: 'resina',
            color: '',
            unidad: 'unidad',
            stock_actual: 0,
            stock_minimo: 5,
            alerta_bajo_stock: true,
            notas: ''
        });
        setModalOpen(true);
    };

    const openEdit = (m) => {
        setEditing(m);
        setForm({
            nombre: m.nombre,
            flujo: m.flujo || ((m.nombre || '').toLowerCase().startsWith('analogico') ? 'analogico' : 'digital'),
            categoria: m.categoria || 'consumible',
            color: m.color || '',
            stock_actual: m.stock_actual,
            stock_minimo: m.stock_minimo,
            unidad: m.unidad,
            alerta_bajo_stock: m.alerta_bajo_stock !== false,
            notas: m.notas || ''
        });
        setModalOpen(true);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('newMaterial') !== '1') return;
        const flow = params.get('flow') === 'analogico' ? 'analogico' : 'digital';
        setEditing(null);
        setForm({
            nombre: '',
            flujo: flow,
            categoria: 'resina',
            color: '',
            unidad: 'unidad',
            stock_actual: 0,
            stock_minimo: 5,
            alerta_bajo_stock: true,
            notas: ''
        });
        setModalOpen(true);
    }, [location.search]);

    const applyTemplate = (tpl) => {
        setForm((prev) => ({
            ...prev,
            nombre: tpl.nombre,
            categoria: tpl.categoria,
            color: tpl.color,
            unidad: tpl.unidad,
            stock_minimo: tpl.stock_minimo
        }));
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/inventory/${editing.id}` : `${API_URL}/inventory`;

        try {
            if (!form.nombre.trim()) {
                alert('Ingresa un nombre de material');
                return;
            }
            const res = await fetch(url, {
                method,
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: form.nombre.trim(),
                    flujo: form.flujo,
                    categoria: form.categoria,
                    color: form.color || null,
                    stock_actual: Number(form.stock_actual) || 0,
                    stock_minimo: Number(form.stock_minimo) || 0,
                    unidad: form.unidad,
                    alerta_bajo_stock: !!form.alerta_bajo_stock,
                    notas: form.notas || null
                })
            });
            if (res.ok) {
                const saved = await res.json();
                setModalOpen(false);
                fetchMateriales();

                const params = new URLSearchParams(location.search);
                const returnTo = params.get('returnTo');
                if (!editing && returnTo === '/productos') {
                    navigate(`/productos?materialCreated=${saved.id}`);
                }
            } else {
                alert('Error al guardar material');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const confirmRemoveMaterial = async () => {
        const material = confirmDeleteMaterial;
        if (!material) return;
        setDeletingId(material.id);

        try {
            const res = await fetch(`${API_URL}/inventory/${material.id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo eliminar el material');
            }

            if (editing?.id === material.id) {
                setModalOpen(false);
                setEditing(null);
            }

            setConfirmDeleteMaterial(null);
            fetchMateriales();
        } catch (error) {
            alert(error.message || 'Error al eliminar material');
        } finally {
            setDeletingId(null);
        }
    };

    const restoreMaterial = async (material) => {
        setRestoringId(material.id);

        try {
            const res = await fetch(`${API_URL}/inventory/${material.id}/restore`, {
                method: 'PATCH',
                headers: getHeaders()
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'No se pudo restaurar el material');
            }

            fetchMateriales();
        } catch (error) {
            alert(error.message || 'Error al restaurar material');
        } finally {
            setRestoringId(null);
        }
    };

    const activeMaterials = materiales.filter((m) => m.activo !== false);
    const inactiveMaterials = materiales.filter((m) => m.activo === false);

    const filteredMateriales = materiales.filter(m => {
        const matchesView = materialView === 'todos'
            ? true
            : materialView === 'inactivos'
                ? m.activo === false
                : m.activo !== false;
        const nombre = (m.nombre || '').toLowerCase();
        const matchesSearch = !search || nombre.includes(search.toLowerCase());
        const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
        const matchesEstado = !filtroEstado || (filtroEstado === 'low' ? lowStock : !lowStock);
        return matchesView && matchesSearch && matchesEstado;
    });

    const totalMateriales = activeMaterials.length;
    const totalInactive = inactiveMaterials.length;
    const totalLowStock = activeMaterials.filter(m => m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo)).length;
    const totalStock = activeMaterials.reduce((acc, m) => acc + (parseFloat(m.stock_actual) || 0), 0);
    const totalUnidades = new Set(materiales.map(m => m.unidad)).size;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Almacén e Inventario</h1>
                    <p>Gestión de materiales y stock</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <i className="bi bi-plus-lg"></i> Nuevo Material
                </button>
            </div>

            <div className="grid grid-cols-4" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card kpi-card">
                    <div className="kpi-icon" style={{ background: 'rgba(8,145,178,0.1)', color: 'var(--color-primary)' }}>
                        <i className="bi bi-box-seam"></i>
                    </div>
                    <div className="kpi-value">{totalMateriales}</div>
                    <div className="kpi-label">Materiales</div>
                </div>
                <div className="card kpi-card">
                    <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' }}>
                        <i className="bi bi-exclamation-triangle"></i>
                    </div>
                    <div className="kpi-value">{totalLowStock}</div>
                    <div className="kpi-label">Bajo stock</div>
                </div>
                <div className="card kpi-card">
                    <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--color-success)' }}>
                        <i className="bi bi-archive"></i>
                    </div>
                    <div className="kpi-value">{totalStock.toFixed(2)}</div>
                    <div className="kpi-label">Stock total</div>
                </div>
                <div className="card kpi-card">
                    <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--color-info)' }}>
                        <i className="bi bi-arrow-counterclockwise"></i>
                    </div>
                    <div className="kpi-value">{totalInactive}</div>
                    <div className="kpi-label">Inactivos</div>
                </div>
            </div>

            <div className="card">
                <div className="inventory-toolbar">
                    <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder="Buscar material..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="inventory-filters">
                        <button className={`btn btn-sm ${materialView === 'activos' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMaterialView('activos')}>
                            Activos
                        </button>
                        <button className={`btn btn-sm ${materialView === 'inactivos' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMaterialView('inactivos')}>
                            Inactivos
                        </button>
                        <button className={`btn btn-sm ${materialView === 'todos' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setMaterialView('todos')}>
                            Todos
                        </button>
                        <button className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFiltroEstado('')}>
                            Stock: todos
                        </button>
                        <button className={`btn btn-sm ${filtroEstado === 'low' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFiltroEstado(filtroEstado === 'low' ? '' : 'low')}>
                            Bajo stock
                        </button>
                        <button className={`btn btn-sm ${filtroEstado === 'ok' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFiltroEstado(filtroEstado === 'ok' ? '' : 'ok')}>
                            Normal
                        </button>
                    </div>
                </div>

                <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th>Flujo</th>
                                <th>Categoría</th>
                                <th>Color</th>
                                <th>Stock actual</th>
                                <th>Mínimo</th>
                                <th>Unidad</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" className="text-center">Cargando...</td></tr>
                            ) : filteredMateriales.length === 0 ? (
                                <tr><td colSpan="9" className="text-center">No hay materiales registrados</td></tr>
                            ) : (
                                filteredMateriales.map(m => {
                                    const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
                                    const maxValue = parseFloat(m.stock_minimo) || 0;
                                    const percent = maxValue > 0 ? Math.min((parseFloat(m.stock_actual) / maxValue) * 100, 100) : 100;
                                    return (
                                        <tr key={m.id} className={`${lowStock ? 'inventory-row-low' : ''} ${m.activo === false ? 'inventory-row-inactive' : ''}`.trim()}>
                                            <td>
                                                <div className="inventory-name">{m.nombre}</div>
                                            </td>
                                            <td><span className="unit-pill">{m.flujo || '-'}</span></td>
                                            <td>{m.categoria || '-'}</td>
                                            <td>{m.color || '-'}</td>
                                            <td>
                                                <div className="inventory-stock-value" style={{ color: lowStock ? 'var(--color-error)' : 'inherit' }}>
                                                    {m.stock_actual}
                                                </div>
                                                <div className="stock-bar">
                                                    <span className={`stock-bar-fill ${lowStock ? 'is-low' : ''}`} style={{ width: `${percent}%` }}></span>
                                                </div>
                                            </td>
                                            <td>{m.stock_minimo}</td>
                                            <td><span className="unit-pill">{m.unidad}</span></td>
                                            <td>
                                                {m.activo === false ? (
                                                    <span className="badge badge-inactive">Inactivo</span>
                                                ) : lowStock ? (
                                                    <span className="badge badge-error">Bajo stock</span>
                                                ) : (
                                                    <span className="badge badge-success">Normal</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Editar material" aria-label={`Editar ${m.nombre}`}>
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    {m.activo === false ? (
                                                        <button
                                                            className="btn btn-ghost btn-sm btn-icon"
                                                            onClick={() => restoreMaterial(m)}
                                                            title="Restaurar material"
                                                            aria-label={`Restaurar ${m.nombre}`}
                                                            disabled={restoringId === m.id}
                                                        >
                                                            <i className="bi bi-arrow-counterclockwise"></i>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-ghost btn-sm btn-icon"
                                                            onClick={() => setConfirmDeleteMaterial(m)}
                                                            title="Eliminar material"
                                                            aria-label={`Eliminar ${m.nombre}`}
                                                            disabled={deletingId === m.id}
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mobile-cards mobile-only" style={{ marginTop: 'var(--space-4)' }}>
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)
                    ) : filteredMateriales.length === 0 ? (
                        <div className="mobile-card">
                            <div className="mobile-field-value">No hay materiales registrados</div>
                        </div>
                    ) : (
                        filteredMateriales.map(m => {
                            const lowStock = m.alerta_bajo_stock !== false && parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
                            return (
                                <div key={m.id} className="mobile-card">
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{m.nombre}</div>
                                        {m.activo === false ? (
                                            <span className="badge badge-inactive">Inactivo</span>
                                        ) : lowStock ? (
                                            <span className="badge badge-error">Bajo stock</span>
                                        ) : (
                                            <span className="badge badge-success">Normal</span>
                                        )}
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field"><span className="mobile-field-label">Flujo</span><span className="mobile-field-value">{m.flujo || '-'}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Categoría</span><span className="mobile-field-value">{m.categoria || '-'}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Color</span><span className="mobile-field-value">{m.color || '-'}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Stock actual</span><span className="mobile-field-value">{m.stock_actual}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Stock minimo</span><span className="mobile-field-value">{m.stock_minimo}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Unidad</span><span className="mobile-field-value">{m.unidad}</span></div>
                                    </div>
                                    <div className="mobile-card-actions">
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                                            Editar <i className="bi bi-pencil"></i>
                                        </button>
                                        {m.activo === false ? (
                                            <button className="btn btn-ghost btn-sm" onClick={() => restoreMaterial(m)} disabled={restoringId === m.id}>
                                                Restaurar <i className="bi bi-arrow-counterclockwise"></i>
                                            </button>
                                        ) : (
                                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteMaterial(m)} disabled={deletingId === m.id}>
                                                Eliminar <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)}
                title={editing ? 'Editar Material' : 'Nuevo Material'}
                footer={<>
                    <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save}><i className="bi bi-check-lg"></i> Guardar</button>
                </>}>
                <div className="form-group">
                    <label className="form-label">Nombre del Material</label>
                    <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Flujo de trabajo</label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                        <button
                            type="button"
                            className={`btn btn-sm ${form.flujo === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setForm({ ...form, flujo: 'digital' })}
                        >
                            Digital
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${form.flujo === 'analogico' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setForm({ ...form, flujo: 'analogico' })}
                        >
                            Analógico
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {materialTemplates[form.flujo].map((tpl) => (
                            <button
                                key={tpl.nombre}
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => applyTemplate(tpl)}
                            >
                                {tpl.nombre.replace(/^Digital - |^Analogico - /, '')}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-3">
                    <div className="form-group">
                        <label className="form-label">Categoría</label>
                        <select className="form-select" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                            <option value="disco">Disco</option>
                            <option value="bloque">Bloque</option>
                            <option value="resina">Resina</option>
                            <option value="fresa">Fresa</option>
                            <option value="consumible">Consumible</option>
                            <option value="liquido">Líquido</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Color</label>
                        <input className="form-input" placeholder="A1, A2, Transparente, Rosa..." value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Stock Actual</label>
                        <input className="form-input" type="number" step="0.01" value={form.stock_actual} onChange={e => setForm({ ...form, stock_actual: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Stock Mínimo</label>
                        <input className="form-input" type="number" step="0.01" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Unidad</label>
                        <select className="form-select" value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}>
                            {units.map((unit) => (
                                <option key={unit.value} value={unit.value}>{unit.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ margin: 0 }}>Alerta bajo stock</label>
                    <label className="switch" style={{ margin: 0 }}>
                        <input type="checkbox" checked={!!form.alerta_bajo_stock} onChange={e => setForm({ ...form, alerta_bajo_stock: e.target.checked })} />
                        <span className="slider round"></span>
                    </label>
                </div>
                <div className="form-group">
                    <label className="form-label">Notas</label>
                    <textarea className="form-textarea" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Compatibilidad, tono, observaciones técnicas..." />
                </div>
            </Modal>

            <Modal
                open={!!confirmDeleteMaterial}
                onClose={() => setConfirmDeleteMaterial(null)}
                title="Eliminar material"
                size="lg"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setConfirmDeleteMaterial(null)} disabled={!!deletingId}>Cancelar</button>
                        <button className="btn btn-danger" onClick={confirmRemoveMaterial} disabled={!!deletingId}>
                            <i className="bi bi-trash"></i> Confirmar eliminación
                        </button>
                    </>
                }
            >
                <p style={{ margin: 0, color: 'var(--color-text)' }}>
                    ¿Eliminar el material <strong>{confirmDeleteMaterial?.nombre}</strong>? Se ocultará del inventario activo,
                    pero podrá restaurarse más adelante desde la vista de inactivos.
                </p>
            </Modal>
        </div>
    );
};

export default Almacen;
