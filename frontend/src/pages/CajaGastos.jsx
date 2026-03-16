import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';

const CajaGastos = () => {
    const { getHeaders } = useAuth();
    const [movimientos, setMovimientos] = useState([]);
    const [catalogos, setCatalogos] = useState({ cuentas: [], categorias_gasto: { operativo: [], costo_directo: [] } });
    const [loadingMovimientos, setLoadingMovimientos] = useState(true);
    const [movSearch, setMovSearch] = useState('');
    const [savingMovimiento, setSavingMovimiento] = useState(false);
    const [movForm, setMovForm] = useState({
        tipo_fondo: 'banco',
        cuenta_id: '',
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        monto: '',
        grupo_gasto: 'operativo',
        categoria_gasto: 'alquiler',
        descripcion: ''
    });

    useEffect(() => {
        setLoadingMovimientos(true);
        Promise.all([
            fetch(`${API_URL}/finanzas/catalogos`, { headers: getHeaders() }).then((r) => r.json()),
            fetch(`${API_URL}/finanzas/movimientos?tipo=egreso&limit=60`, { headers: getHeaders() }).then((r) => r.json())
        ])
            .then(([catData, movData]) => {
                const categorias = catData?.categorias_gasto || { operativo: [], costo_directo: [], otro: [] };
                setCatalogos({
                    cuentas: Array.isArray(catData?.cuentas) ? catData.cuentas : [],
                    categorias_gasto: categorias
                });
                const cuentaDefault = Array.isArray(catData?.cuentas) && catData.cuentas.length > 0 ? String(catData.cuentas[0].id) : '';
                setMovForm((prev) => ({ ...prev, cuenta_id: prev.cuenta_id || cuentaDefault }));
                setMovimientos(Array.isArray(movData) ? movData : []);
                setLoadingMovimientos(false);
            })
            .catch(() => setLoadingMovimientos(false));
    }, [getHeaders]);

    const loadMovimientos = () => {
        setLoadingMovimientos(true);
        const params = new URLSearchParams();
        params.set('tipo', 'egreso');
        params.set('limit', '100');
        if (movSearch) params.set('search', movSearch);
        fetch(`${API_URL}/finanzas/movimientos?${params.toString()}`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => {
                setMovimientos(Array.isArray(data) ? data : []);
                setLoadingMovimientos(false);
            })
            .catch(() => setLoadingMovimientos(false));
    };

    const categoriasByGroup = catalogos?.categorias_gasto || { operativo: [], costo_directo: [], otro: [] };
    const currentCategorias = categoriasByGroup[movForm.grupo_gasto] || [];
    const cuentasFiltradas = (catalogos.cuentas || []).filter((cuenta) => cuenta.tipo_cuenta === movForm.tipo_fondo);

    useEffect(() => {
        if (cuentasFiltradas.length === 0) {
            setMovForm((prev) => ({ ...prev, cuenta_id: '' }));
            return;
        }
        const exists = cuentasFiltradas.some((cuenta) => String(cuenta.id) === String(movForm.cuenta_id));
        if (!exists) {
            setMovForm((prev) => ({ ...prev, cuenta_id: String(cuentasFiltradas[0].id) }));
        }
    }, [movForm.tipo_fondo, movForm.cuenta_id, cuentasFiltradas]);

    const handleCreateMovimiento = async (e) => {
        e.preventDefault();
        if (!movForm.monto || parseFloat(movForm.monto) <= 0) return;
        setSavingMovimiento(true);
        try {
            const res = await fetch(`${API_URL}/finanzas/movimientos`, {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'egreso',
                    tipo_fondo: movForm.tipo_fondo,
                    cuenta_id: movForm.cuenta_id ? parseInt(movForm.cuenta_id, 10) : null,
                    fecha_movimiento: movForm.fecha_movimiento,
                    monto: parseFloat(movForm.monto),
                    grupo_gasto: movForm.grupo_gasto,
                    categoria_gasto: movForm.categoria_gasto,
                    descripcion: movForm.descripcion || null
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'No se pudo registrar el gasto');
            }

            setMovForm((prev) => ({ ...prev, monto: '', descripcion: '' }));
            loadMovimientos();
        } catch (err) {
            alert(err.message || 'No se pudo registrar el gasto');
            setSavingMovimiento(false);
            return;
        }
        setSavingMovimiento(false);
    };

    const formatDateShort = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    const formatCurrency = (value) => {
        const number = parseFloat(value || 0);
        if (Number.isNaN(number)) return 'S/. 0.00';
        return `S/. ${number.toFixed(2)}`;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Caja y Gastos</h1>
                    <p>Registro de egresos y control de tesorería del laboratorio</p>
                </div>
            </div>

            <div className="grid grid-cols-3" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card col-span-1">
                    <div className="card-header">
                        <h3 className="card-title">Registrar gasto</h3>
                    </div>
                    <form onSubmit={handleCreateMovimiento}>
                        <div className="form-group">
                            <label className="form-label">Sale de</label>
                            <select
                                className="form-select"
                                value={movForm.tipo_fondo}
                                onChange={(e) => setMovForm({ ...movForm, tipo_fondo: e.target.value })}
                            >
                                <option value="banco">Banco</option>
                                <option value="caja">Caja (efectivo)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cuenta</label>
                            <select
                                className="form-select"
                                value={movForm.cuenta_id}
                                onChange={(e) => setMovForm({ ...movForm, cuenta_id: e.target.value })}
                            >
                                {cuentasFiltradas.map((cuenta) => (
                                    <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input
                                className="form-input"
                                type="date"
                                value={movForm.fecha_movimiento}
                                onChange={(e) => setMovForm({ ...movForm, fecha_movimiento: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Monto (S/.)</label>
                            <input
                                className="form-input"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={movForm.monto}
                                onChange={(e) => setMovForm({ ...movForm, monto: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Grupo</label>
                            <select
                                className="form-select"
                                value={movForm.grupo_gasto}
                                onChange={(e) => {
                                    const nextGrupo = e.target.value;
                                    const nextCategorias = categoriasByGroup[nextGrupo] || [];
                                    setMovForm({ ...movForm, grupo_gasto: nextGrupo, categoria_gasto: nextCategorias[0] || '' });
                                }}
                            >
                                <option value="operativo">Gasto operativo</option>
                                <option value="costo_directo">Costo directo</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Categoría</label>
                            <select
                                className="form-select"
                                value={movForm.categoria_gasto}
                                onChange={(e) => setMovForm({ ...movForm, categoria_gasto: e.target.value })}
                            >
                                {currentCategorias.length === 0 ? (
                                    <option value="otros">otros</option>
                                ) : currentCategorias.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Descripción</label>
                            <textarea
                                className="form-input"
                                value={movForm.descripcion}
                                onChange={(e) => setMovForm({ ...movForm, descripcion: e.target.value })}
                                placeholder="Detalle del gasto"
                            ></textarea>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={savingMovimiento}>
                            {savingMovimiento ? 'Guardando...' : 'Registrar gasto'}
                        </button>
                    </form>
                </div>

                <div className="card col-span-2">
                    <div className="card-header">
                        <h3 className="card-title">Gastos recientes</h3>
                        <div className="search-box" style={{ maxWidth: 280 }}>
                            <i className="bi bi-search"></i>
                            <input
                                className="form-input"
                                placeholder="Buscar categoría o descripción"
                                value={movSearch}
                                onChange={(e) => setMovSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadMovimientos()}
                            />
                        </div>
                    </div>
                    {loadingMovimientos ? (
                        <div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 58, marginBottom: 8, borderRadius: 8 }} />)}</div>
                    ) : movimientos.length === 0 ? (
                        <div className="empty-state">
                            <i className="bi bi-wallet2 empty-state-icon"></i>
                            <h3 className="empty-state-title">Sin gastos registrados</h3>
                            <p className="empty-state-text">Registra el primer gasto para activar el control de liquidez.</p>
                        </div>
                    ) : (
                        <div className="data-table-wrapper" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Cuenta</th>
                                        <th>Sale de</th>
                                        <th>Grupo</th>
                                        <th>Categoría</th>
                                        <th>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.map((mov) => (
                                        <tr key={mov.id}>
                                            <td>{formatDateShort(mov.fecha_movimiento)}</td>
                                            <td>{mov.cuenta_nombre || '-'}</td>
                                            <td>{mov.tipo_fondo === 'caja' ? 'Caja' : 'Banco'}</td>
                                            <td>{(mov.grupo_gasto || '-').replace('_', ' ')}</td>
                                            <td>{mov.categoria_gasto || '-'}</td>
                                            <td><strong>{formatCurrency(mov.monto)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CajaGastos;
