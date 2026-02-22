import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';

const statusLabels = {
    por_cancelar: 'Por cancelar',
    pago_parcial: 'Pago parcial',
    cancelado: 'Cancelado'
};

const Finanzas = () => {
    const { getHeaders } = useAuth();
    const navigate = useNavigate();
    const [finanzas, setFinanzas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const params = new URLSearchParams();
        if (filtroEstado) params.set('estado_pago', filtroEstado);
        if (search) params.set('search', search);

        fetch(`${API_URL}/finanzas?${params}`, { headers: getHeaders() })
            .then((r) => r.json())
            .then((data) => { setFinanzas(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [filtroEstado, search]);

    const estados = ['', 'por_cancelar', 'pago_parcial', 'cancelado'];

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
                    <h1>Finanzas</h1>
                    <p>Seguimiento de pagos y comprobantes por pedido</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder="Buscar por código o paciente..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {estados.map((estado) => (
                            <button
                                key={estado}
                                className={`btn btn-sm ${filtroEstado === estado ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setFiltroEstado(estado)}
                            >
                                {estado ? statusLabels[estado] : 'Todos'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                ) : finanzas.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-cash-stack empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin registros financieros</h3>
                        <p className="empty-state-text">Los pagos aparecerán aquí cuando se registren</p>
                    </div>
                ) : (
                    <>
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Paciente</th>
                                    <th>Clínica</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th>Total</th>
                                    <th>Pagado</th>
                                    <th>Saldo</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {finanzas.map((f) => (
                                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finanzas/${f.id}`)}>
                                        <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{f.codigo}</strong></td>
                                        <td>{f.paciente_nombre}</td>
                                        <td>{f.clinica_nombre}</td>
                                        <td><span className={`badge badge-dot badge-${f.estado_pago}`}>{statusLabels[f.estado_pago]}</span></td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(f.fecha || f.created_at)}</td>
                                        <td><strong>{formatCurrency(f.total)}</strong></td>
                                        <td>{formatCurrency(f.monto_pagado)}</td>
                                        <td>{formatCurrency(f.saldo)}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm btn-icon" title="Ver detalle">
                                                <i className="bi bi-chevron-right"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                        <div className="mobile-cards mobile-only">
                            {finanzas.map((f) => (
                                <div key={f.id} className="mobile-card" onClick={() => navigate(`/finanzas/${f.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{f.codigo}</div>
                                        <span className={`badge badge-dot badge-${f.estado_pago}`}>{statusLabels[f.estado_pago]}</span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field"><span className="mobile-field-label">Paciente</span><span className="mobile-field-value">{f.paciente_nombre}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Clinica</span><span className="mobile-field-value">{f.clinica_nombre}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Fecha</span><span className="mobile-field-value">{formatDateShort(f.fecha || f.created_at)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Total</span><span className="mobile-field-value"><strong>{formatCurrency(f.total)}</strong></span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Pagado</span><span className="mobile-field-value">{formatCurrency(f.monto_pagado)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Saldo</span><span className="mobile-field-value">{formatCurrency(f.saldo)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Finanzas;
