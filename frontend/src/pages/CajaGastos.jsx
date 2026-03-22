import React, { useEffect, useMemo, useState } from 'react';
import { useFinanceCatalogsQuery } from '../modules/finance/queries/useFinanceCatalogsQuery.js';
import { useFinanceMovementsQuery } from '../modules/finance/queries/useFinanceMovementsQuery.js';
import { useCreateFinanceMovementMutation } from '../modules/finance/mutations/useCreateFinanceMovementMutation.js';

const CajaGastos = () => {
    const [movSearch, setMovSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [movForm, setMovForm] = useState({
        tipo_fondo: 'banco',
        cuenta_id: '',
        fecha_movimiento: new Date().toISOString().slice(0, 10),
        monto: '',
        grupo_gasto: 'operativo',
        categoria_gasto: 'alquiler',
        descripcion: ''
    });

    const catalogosQuery = useFinanceCatalogsQuery();
    const movementsFilters = useMemo(() => ({
        tipo: 'egreso',
        limit: '60',
        search: movSearch
    }), [movSearch]);
    const movimientosQuery = useFinanceMovementsQuery({ filters: movementsFilters });
    const createMovementMutation = useCreateFinanceMovementMutation();

    const catalogos = {
        cuentas: Array.isArray(catalogosQuery.data?.cuentas) ? catalogosQuery.data.cuentas : [],
        categorias_gasto: catalogosQuery.data?.categorias_gasto || { operativo: [], costo_directo: [], otro: [] }
    };
    const movimientos = movimientosQuery.data || [];
    const loadingMovimientos = (catalogosQuery.isLoading || movimientosQuery.isLoading) && movimientos.length === 0;
    const savingMovimiento = createMovementMutation.isPending;

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
        try {
            await createMovementMutation.mutateAsync({
                tipo: 'egreso',
                tipo_fondo: movForm.tipo_fondo,
                cuenta_id: movForm.cuenta_id ? parseInt(movForm.cuenta_id, 10) : null,
                fecha_movimiento: movForm.fecha_movimiento,
                monto: parseFloat(movForm.monto),
                grupo_gasto: movForm.grupo_gasto,
                categoria_gasto: movForm.categoria_gasto,
                descripcion: movForm.descripcion || null
            });

            setMovForm((prev) => ({ ...prev, monto: '', descripcion: '' }));
        } catch (err) {
            alert(err.message || 'No se pudo registrar el gasto');
            return;
        }
    };

    const applyMovementSearch = () => {
        setMovSearch(searchInput.trim());
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
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyMovementSearch()}
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
