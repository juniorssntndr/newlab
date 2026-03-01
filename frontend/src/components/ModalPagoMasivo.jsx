import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import { API_URL } from '../config';
import Modal from './Modal';
import { toast } from 'react-hot-toast';

export const ModalPagoMasivo = ({ clinica, open, onClose, onPaymentSuccess }) => {
    const { getHeaders } = useAuth();
    const [estadoCuenta, setEstadoCuenta] = useState(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [montoTotal, setMontoTotal] = useState('');
    const [metodo, setMetodo] = useState('transferencia');
    const [referencia, setReferencia] = useState('');
    const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
    const [notas, setNotas] = useState('Abono automático por pago masivo');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && clinica) {
            fetchEstadoCuenta();
        } else {
            // Reset form when closed
            setMontoTotal('');
            setReferencia('');
            setEstadoCuenta(null);
        }
    }, [open, clinica]);

    const fetchEstadoCuenta = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/finanzas/estado-cuenta/${clinica.id}`, {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setEstadoCuenta(data);
                // Pre-fill total amount with exact debt
                setMontoTotal(data.saldo_total_pendiente > 0 ? data.saldo_total_pendiente : '');
            } else {
                toast.error('Error al cargar estado de cuenta');
            }
        } catch (error) {
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const montoNum = parseFloat(montoTotal);
        if (isNaN(montoNum) || montoNum <= 0) {
            toast.error('Ingrese un monto válido mayor a 0');
            return;
        }

        if (estadoCuenta && montoNum > estadoCuenta.saldo_total_pendiente) {
            toast.error('El monto no puede superar la deuda total pendiente');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/finanzas/pagos-masivos`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    clinica_id: clinica.id,
                    monto_total: montoNum,
                    metodo,
                    referencia,
                    fecha_pago: fechaPago,
                    notas
                })
            });

            if (res.ok) {
                const result = await res.json();
                toast.success(`Pago masivo registrado. Se cancelaron/abonaron ${result.pagos_registrados.length} pedidos.`, { duration: 4000 });
                if (onPaymentSuccess) onPaymentSuccess();
                onClose();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Error al procesar pago masivo');
            }
        } catch (error) {
            toast.error('Error de conexión');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate simulation preview
    const getSimulationPreview = () => {
        if (!estadoCuenta || !estadoCuenta.pedidos_pendientes || estadoCuenta.pedidos_pendientes.length === 0) return null;

        const montoInput = parseFloat(montoTotal) || 0;
        if (montoInput <= 0) return null;

        let restante = montoInput;
        let pedidosAfectados = 0;
        let ultimoPedidoParcial = null;

        for (const pd of estadoCuenta.pedidos_pendientes) {
            if (restante <= 0) break;
            const aPagar = Math.min(pd.saldo, restante);
            restante -= aPagar;
            pedidosAfectados++;

            if (aPagar < pd.saldo) {
                ultimoPedidoParcial = { codigo: pd.codigo, saldoAnterior: pd.saldo, saldoNuevo: pd.saldo - aPagar };
            }
        }

        return { pedidosAfectados, ultimoPedidoParcial };
    };

    const simulacion = getSimulationPreview();

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Estado de Cuenta: ${clinica?.nombre}`}
            size="2xl" // Expanded width for the 2-column grid
            footer={
                <>
                    <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !estadoCuenta || estadoCuenta.saldo_total_pendiente <= 0 || !montoTotal}
                    >
                        {submitting ? 'Procesando...' : 'Registrar Pago Global'}
                    </button>
                </>
            }
        >
            {loading || !estadoCuenta ? (
                <div className="flex justify-center p-8">
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="modal-grid-layout">

                    {/* LEFT COLUMN: Account Statement Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                            <div>
                                <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', fontWeight: 500 }}>Deuda Total Pendiente</h3>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-danger)' }}>
                                    S/. {estadoCuenta.saldo_total_pendiente.toFixed(2)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="badge badge-warning">{estadoCuenta.pedidos_pendientes.length} pedidos sin cancelar</span>
                            </div>
                        </div>

                        {estadoCuenta.pedidos_pendientes.length > 0 ? (
                            <div className="data-table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th>Pedido</th>
                                            <th>Fecha</th>
                                            <th className="text-right">Total</th>
                                            <th className="text-right">Saldo Deudor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estadoCuenta.pedidos_pendientes.map(pd => (
                                            <tr key={pd.id}>
                                                <td className="font-mono text-sm"><strong>{pd.codigo}</strong></td>
                                                <td>{new Date(pd.created_at).toLocaleDateString()}</td>
                                                <td className="text-right">S/. {pd.total.toFixed(2)}</td>
                                                <td className="text-right font-bold" style={{ color: 'var(--color-danger)' }}>
                                                    S/. {pd.saldo.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-state p-8">
                                <i className="bi bi-check-circle text-success text-3xl"></i>
                                <p className="mt-2 text-secondary">Esta clínica no tiene deudas pendientes.</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Mass Payment Form */}
                    <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', position: 'sticky', top: 0 }}>
                        <h3 style={{ marginBottom: '1.5rem', fontWeight: '700', fontSize: '1.125rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="bi bi-wallet-fill" style={{ color: 'var(--color-primary)' }}></i> Registrar Cobranza
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="bi bi-cash-coin" style={{ color: 'var(--color-primary)' }}></i> Monto a abonar <span style={{ color: 'red' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>S/.</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ paddingLeft: '2.5rem', fontWeight: 'bold', fontSize: '1.125rem' }}
                                        value={montoTotal}
                                        onChange={e => setMontoTotal(e.target.value)}
                                        min="0.1"
                                        step="0.1"
                                        placeholder="0.00"
                                        disabled={estadoCuenta.saldo_total_pendiente <= 0}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* PREVIEW SIMULATION CARD */}
                            {simulacion && (
                                <div style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.08)', border: '1px solid rgba(var(--color-primary-rgb), 0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                                    <div style={{ fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <i className="bi bi-info-circle"></i> Asignación en Cascada
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                                        Este pago cancelará/abonará automáticamente <strong style={{ color: 'var(--color-primary)' }}>{simulacion.pedidosAfectados} pedidos</strong> (del más antiguo al más nuevo).
                                    </p>
                                    {simulacion.ultimoPedidoParcial && (
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                                            * El pedido {simulacion.ultimoPedidoParcial.codigo} quedará con saldo de S/. {simulacion.ultimoPedidoParcial.saldoNuevo.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="bi bi-bank" style={{ color: 'var(--color-primary)' }}></i> Método de Pago <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select className="form-select" value={metodo} onChange={e => setMetodo(e.target.value)}>
                                    <option value="transferencia">Transferencia Bancaria</option>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta (POS)</option>
                                    <option value="yape_plin">Yape / Plin</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="bi bi-hash" style={{ color: 'var(--color-text-tertiary)' }}></i> Nº Ref. / Operación
                                </label>
                                <input className="form-input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ej: OP-987654" />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="bi bi-calendar3" style={{ color: 'var(--color-text-tertiary)' }}></i> Fecha de Pago
                                </label>
                                <input type="date" className="form-input" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </Modal>
    );
};
