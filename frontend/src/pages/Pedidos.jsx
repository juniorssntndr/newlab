import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Aprobación',
    en_produccion: 'Producción', terminado: 'Terminado', enviado: 'Enviado'
};

const Pedidos = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const params = new URLSearchParams();
        if (filtroEstado) params.set('estado', filtroEstado);
        if (search) params.set('search', search);

        fetch(`/api/pedidos?${params}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setPedidos(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [filtroEstado, search]);

    const estados = ['', 'pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

    const formatDateShort = (value) => {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>{user?.tipo === 'cliente' ? 'Mis Pedidos' : 'Pedidos'}</h1>
                    <p>Gestión y seguimiento de trabajos dentales</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/pedidos/nuevo')}>
                    <i className="bi bi-plus-lg"></i> Nuevo Pedido
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
                        <i className="bi bi-search"></i>
                        <input className="form-input" placeholder="Buscar por código o paciente..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                        {estados.map(e => (
                            <button key={e} className={`btn btn-sm ${filtroEstado === e ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setFiltroEstado(e)}>
                                {e ? statusLabels[e] : 'Todos'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Orders list */}
            <div className="card">
                {loading ? (
                    <div>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                ) : pedidos.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-clipboard2 empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin pedidos</h3>
                        <p className="empty-state-text">Crea tu primer pedido para comenzar</p>
                        <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}
                            onClick={() => navigate('/pedidos/nuevo')}>
                            <i className="bi bi-plus-lg"></i> Crear Pedido
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th><th>Paciente</th><th>Clínica</th><th>Estado</th><th>Fecha</th><th>Entrega</th><th>Total</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidos.map(p => (
                                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/pedidos/${p.id}`)}>
                                        <td><strong style={{ fontFamily: 'var(--font-mono)' }}>{p.codigo}</strong></td>
                                        <td>{p.paciente_nombre}</td>
                                        <td>{p.clinica_nombre}</td>
                                        <td><span className={`badge badge-dot badge-${p.estado}`}>{statusLabels[p.estado]}</span></td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(p.fecha || p.created_at)}</td>
                                        <td style={{ fontSize: '0.8125rem' }}>{formatDateShort(p.fecha_entrega)}</td>
                                        <td><strong>S/. {parseFloat(p.subtotal ?? p.total).toFixed(2)}</strong></td>
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
                            {pedidos.map(p => (
                                <div key={p.id} className="mobile-card" onClick={() => navigate(`/pedidos/${p.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{p.codigo}</div>
                                        <span className={`badge badge-dot badge-${p.estado}`}>{statusLabels[p.estado]}</span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field"><span className="mobile-field-label">Paciente</span><span className="mobile-field-value">{p.paciente_nombre}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Clinica</span><span className="mobile-field-value">{p.clinica_nombre}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Fecha</span><span className="mobile-field-value">{formatDateShort(p.fecha || p.created_at)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Entrega</span><span className="mobile-field-value">{formatDateShort(p.fecha_entrega)}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Total</span><span className="mobile-field-value"><strong>S/. {parseFloat(p.subtotal ?? p.total).toFixed(2)}</strong></span></div>
                                    </div>
                                    <div className="mobile-card-actions">
                                        <button className="btn btn-ghost btn-sm">Ver detalle <i className="bi bi-chevron-right"></i></button>
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

export default Pedidos;
