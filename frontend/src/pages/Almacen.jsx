import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { API_URL } from '../config.js';

const Almacen = () => {
    const { getHeaders } = useAuth();
    const [materiales, setMateriales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', stock_actual: 0, stock_minimo: 5, unidad: 'unid' });
    const [search, setSearch] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');

    const fetchMateriales = () => {
        setLoading(true);
        fetch(`${API_URL}/inventory`, { headers: getHeaders() })
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
        setForm({ nombre: '', stock_actual: 0, stock_minimo: 5, unidad: 'unid' });
        setModalOpen(true);
    };

    const openEdit = (m) => {
        setEditing(m);
        setForm({
            nombre: m.nombre,
            stock_actual: m.stock_actual,
            stock_minimo: m.stock_minimo,
            unidad: m.unidad
        });
        setModalOpen(true);
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_URL}/inventory/${editing.id}` : `${API_URL}/inventory`;

        try {
            const res = await fetch(url, {
                method,
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setModalOpen(false);
                fetchMateriales();
            } else {
                alert('Error al guardar material');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const filteredMateriales = materiales.filter(m => {
        const nombre = (m.nombre || '').toLowerCase();
        const matchesSearch = !search || nombre.includes(search.toLowerCase());
        const lowStock = parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
        const matchesEstado = !filtroEstado || (filtroEstado === 'low' ? lowStock : !lowStock);
        return matchesSearch && matchesEstado;
    });

    const totalMateriales = materiales.length;
    const totalLowStock = materiales.filter(m => parseFloat(m.stock_actual) < parseFloat(m.stock_minimo)).length;
    const totalStock = materiales.reduce((acc, m) => acc + (parseFloat(m.stock_actual) || 0), 0);
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
                        <i className="bi bi-rulers"></i>
                    </div>
                    <div className="kpi-value">{totalUnidades}</div>
                    <div className="kpi-label">Unidades</div>
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
                        <button className={`btn btn-sm ${!filtroEstado ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFiltroEstado('')}>
                            Todos
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

                <div className="data-table-wrapper" style={{ border: 'none' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th>Stock actual</th>
                                <th>Mínimo</th>
                                <th>Unidad</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center">Cargando...</td></tr>
                            ) : filteredMateriales.length === 0 ? (
                                <tr><td colSpan="6" className="text-center">No hay materiales registrados</td></tr>
                            ) : (
                                filteredMateriales.map(m => {
                                    const lowStock = parseFloat(m.stock_actual) < parseFloat(m.stock_minimo);
                                    const maxValue = parseFloat(m.stock_minimo) || 0;
                                    const percent = maxValue > 0 ? Math.min((parseFloat(m.stock_actual) / maxValue) * 100, 100) : 100;
                                    return (
                                        <tr key={m.id} className={lowStock ? 'inventory-row-low' : ''}>
                                            <td>
                                                <div className="inventory-name">{m.nombre}</div>
                                            </td>
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
                                                {lowStock ? (
                                                    <span className="badge badge-error">Bajo stock</span>
                                                ) : (
                                                    <span className="badge badge-success">Normal</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)} title="Editar material">
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
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
                <div className="grid grid-cols-3">
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
                            <option value="unid">Unidad (unid)</option>
                            <option value="g">Gramos (g)</option>
                            <option value="ml">Mililitros (ml)</option>
                            <option value="kg">Kilogramos (kg)</option>
                            <option value="l">Litros (l)</option>
                            <option value="caja">Caja</option>
                            <option value="block">Bloque/Disco</option>
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Almacen;
