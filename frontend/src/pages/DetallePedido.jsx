import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useParams, useNavigate } from 'react-router-dom';

const statusLabels = {
    pendiente: 'Pendiente', en_diseno: 'En Diseño', esperando_aprobacion: 'Esperando Aprobación',
    en_produccion: 'En Producción', terminado: 'Terminado', enviado: 'Enviado'
};
const statusFlow = ['pendiente', 'en_diseno', 'esperando_aprobacion', 'en_produccion', 'terminado', 'enviado'];

const DetallePedido = () => {
    const { id } = useParams();
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchPedido = () => {
        fetch(`/api/pedidos/${id}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setPedido(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchPedido(); }, [id]);

    const changeStatus = async (newStatus) => {
        setUpdating(true);
        try {
            await fetch(`/api/pedidos/${id}/estado`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ estado: newStatus })
            });
            fetchPedido();
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return (
        <div>
            <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        </div>
    );

    if (!pedido) return (
        <div className="card">
            <div className="empty-state">
                <i className="bi bi-exclamation-triangle empty-state-icon"></i>
                <h3 className="empty-state-title">Pedido no encontrado</h3>
                <button className="btn btn-primary" onClick={() => navigate('/pedidos')}>Volver a pedidos</button>
            </div>
        </div>
    );

    const currentIdx = statusFlow.indexOf(pedido.estado);
    const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;
    const isLab = user?.tipo !== 'cliente';
    const isApproval = pedido.estado === 'esperando_aprobacion';

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            {pedido.codigo}
                            <span className={`badge badge-dot badge-${pedido.estado}`}>{statusLabels[pedido.estado]}</span>
                        </h1>
                        <p>Pedido para {pedido.paciente_nombre}</p>
                    </div>
                </div>
                {isLab && nextStatus && (
                    <button className="btn btn-accent" onClick={() => changeStatus(nextStatus)} disabled={updating}>
                        {updating ? 'Actualizando...' : `Avanzar a: ${statusLabels[nextStatus]}`}
                        <i className="bi bi-arrow-right"></i>
                    </button>
                )}
                {!isLab && isApproval && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-accent" onClick={() => changeStatus('en_produccion')} disabled={updating}>
                            <i className="bi bi-check-lg"></i> Aprobar Diseño
                        </button>
                    </div>
                )}
            </div>

            {/* Status timeline */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0' }}>
                    {statusFlow.map((s, i) => (
                        <React.Fragment key={s}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%', margin: '0 auto var(--space-2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.75rem', fontWeight: 700,
                                    background: i <= currentIdx ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                                    color: i <= currentIdx ? '#fff' : 'var(--color-text-secondary)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {i < currentIdx ? <i className="bi bi-check"></i> : i + 1}
                                </div>
                                <div style={{ fontSize: '0.6875rem', fontWeight: i === currentIdx ? 700 : 400, color: i === currentIdx ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                    {statusLabels[s]}
                                </div>
                            </div>
                            {i < statusFlow.length - 1 && (
                                <div style={{
                                    flex: 0.5, height: 2, borderRadius: 1,
                                    background: i < currentIdx ? 'var(--color-primary)' : 'var(--color-border)',
                                    transition: 'all 0.3s ease'
                                }} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-3" style={{ gap: 'var(--space-6)' }}>
                {/* Left: Details */}
                <div style={{ gridColumn: 'span 2' }}>
                    {/* Patient Info */}
                    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                        <div className="card-header"><h3 className="card-title">Información</h3></div>
                        <div className="grid grid-cols-2">
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Paciente</span><br /><strong>{pedido.paciente_nombre}</strong></div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Clínica</span><br /><strong>{pedido.clinica_nombre}</strong></div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Fecha</span><br />{pedido.fecha}</div>
                            <div><span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Entrega</span><br /><strong style={{ color: 'var(--color-primary)' }}>{pedido.fecha_entrega || 'Sin definir'}</strong></div>
                        </div>
                        {pedido.observaciones && (
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                                <i className="bi bi-chat-left-text" style={{ marginRight: 8 }}></i>{pedido.observaciones}
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Items del Pedido</h3></div>
                        <div className="data-table-wrapper" style={{ border: 'none' }}>
                            <table className="data-table">
                                <thead><tr><th>Producto</th><th>Pieza</th><th>Color</th><th>Material</th><th>Cant.</th><th>Subtotal</th></tr></thead>
                                <tbody>
                                    {(pedido.items || []).map((item, i) => (
                                        <tr key={i}>
                                            <td><strong>{item.producto_nombre || `Producto #${item.producto_id}`}</strong></td>
                                            <td style={{ fontFamily: 'var(--font-mono)' }}>{item.pieza_dental || '—'}</td>
                                            <td>{item.color || '—'}</td>
                                            <td>{item.material || '—'}</td>
                                            <td>{item.cantidad}</td>
                                            <td><strong>S/. {(item.cantidad * parseFloat(item.precio_unitario)).toFixed(2)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ textAlign: 'right', padding: 'var(--space-4)', fontSize: '1.25rem', fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                            Total: S/. {parseFloat(pedido.total).toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Right: Timeline */}
                <div className="card" style={{ gridColumn: 'span 1' }}>
                    <div className="card-header"><h3 className="card-title">Historial</h3></div>
                    {(pedido.timeline || []).length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <p className="empty-state-text">Sin actividad registrada</p>
                        </div>
                    ) : (
                        <div style={{ position: 'relative', paddingLeft: 20 }}>
                            <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
                            {pedido.timeline.map((t, i) => (
                                <div key={i} style={{ position: 'relative', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)' }}>
                                    <div style={{ position: 'absolute', left: -2, top: 4, width: 12, height: 12, borderRadius: '50%', background: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid var(--color-bg)' }} />
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t.accion}</div>
                                    {t.detalle && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{t.detalle}</div>}
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                                        {new Date(t.created_at).toLocaleString('es-PE')} • {t.usuario_nombre || 'Sistema'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetallePedido;
