import React, { useEffect, useId, useState } from 'react';
import Modal from './Modal';
import FormDatePicker from './FormDatePicker.jsx';
import { toast } from 'react-hot-toast';
import { useFinanceAccountStateQuery } from '../modules/finance/queries/useFinanceAccountStateQuery.js';
import { useRegisterBulkPaymentMutation } from '../modules/finance/mutations/useRegisterBulkPaymentMutation.js';
import '../styles/modal-pago-masivo.css';

const formatCurrency = (value) => {
    const number = parseFloat(value || 0);
    if (Number.isNaN(number)) return 'S/. 0.00';
    return `S/. ${number.toFixed(2)}`;
};

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(date);
};

export const ModalPagoMasivo = ({ clinica, open, onClose, onPaymentSuccess }) => {
    const montoId = useId();
    const metodoId = useId();
    const referenciaId = useId();
    const fechaId = useId();

    const [montoTotal, setMontoTotal] = useState('');
    const [metodo, setMetodo] = useState('transferencia');
    const [referencia, setReferencia] = useState('');
    const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
    const [notas] = useState('Abono automático por pago masivo');

    const estadoCuentaQuery = useFinanceAccountStateQuery(clinica?.id, { enabled: open && Boolean(clinica?.id) });
    const registerBulkPaymentMutation = useRegisterBulkPaymentMutation();

    const estadoCuenta = estadoCuentaQuery.data || null;
    const loading = estadoCuentaQuery.isFetching && !estadoCuenta;
    const submitting = registerBulkPaymentMutation.isPending;

    useEffect(() => {
        if (!open) {
            setMontoTotal('');
            setReferencia('');
            setMetodo('transferencia');
            setFechaPago(new Date().toISOString().split('T')[0]);
        }
    }, [open]);

    useEffect(() => {
        if (open && estadoCuenta) {
            setMontoTotal(estadoCuenta.saldo_total_pendiente > 0 ? estadoCuenta.saldo_total_pendiente : '');
        }
    }, [open, estadoCuenta]);

    useEffect(() => {
        if (open && estadoCuentaQuery.isError) {
            toast.error(estadoCuentaQuery.error?.message || 'Error al cargar estado de cuenta');
        }
    }, [open, estadoCuentaQuery.isError, estadoCuentaQuery.error]);

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

        try {
            const result = await registerBulkPaymentMutation.mutateAsync({
                clinica_id: clinica.id,
                monto_total: montoNum,
                metodo,
                referencia,
                fecha_pago: fechaPago,
                notas
            });

            toast.success(`Pago masivo registrado. Se cancelaron/abonaron ${result.pagos_registrados.length} pedidos.`, { duration: 4000 });
            if (onPaymentSuccess) onPaymentSuccess();
            onClose();
        } catch (error) {
            toast.error(error?.message || 'Error al procesar pago masivo');
        }
    };

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
    const hasDebt = Boolean(estadoCuenta && estadoCuenta.saldo_total_pendiente > 0);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Estado de Cuenta: ${clinica?.nombre}`}
            size="2xl"
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !estadoCuenta || !hasDebt || !montoTotal}
                    >
                        {submitting ? 'Procesando...' : 'Registrar Pago Global'}
                    </button>
                </>
            }
        >
            {loading || !estadoCuenta ? (
                <div className="bulk-pay-loading">
                    <div className="spinner" aria-hidden="true" />
                </div>
            ) : (
                <div className="bulk-pay-layout">
                    <section className="bulk-pay-statement" aria-label="Pedidos pendientes">
                        <div className="bulk-pay-summary">
                            <div>
                                <p className="bulk-pay-summary-label">
                                    <i className="bi bi-exclamation-circle" aria-hidden="true" />
                                    Deuda total pendiente
                                </p>
                                <p className={`bulk-pay-summary-amount${hasDebt ? ' is-debt' : ''}`}>
                                    {formatCurrency(estadoCuenta.saldo_total_pendiente)}
                                </p>
                            </div>
                            <div className="bulk-pay-summary-meta">
                                <span className="badge badge-warning">
                                    {estadoCuenta.pedidos_pendientes.length} pedidos sin cancelar
                                </span>
                            </div>
                        </div>

                        {estadoCuenta.pedidos_pendientes.length > 0 ? (
                            <div className="data-table-wrapper bulk-pay-table-shell">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Pedido</th>
                                            <th>Fecha</th>
                                            <th className="bulk-pay-num">Total</th>
                                            <th className="bulk-pay-num">Saldo deudor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estadoCuenta.pedidos_pendientes.map((pd) => (
                                            <tr key={pd.id}>
                                                <td className="bulk-pay-code"><strong>{pd.codigo}</strong></td>
                                                <td>{formatDate(pd.created_at)}</td>
                                                <td className="bulk-pay-num">{formatCurrency(pd.total)}</td>
                                                <td className="bulk-pay-num is-debt">{formatCurrency(pd.saldo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bulk-pay-empty">
                                <i className="bi bi-check-circle bulk-pay-empty-icon" aria-hidden="true" />
                                <p className="bulk-pay-empty-text">Esta clínica no tiene deudas pendientes.</p>
                            </div>
                        )}
                    </section>

                    <section className="bulk-pay-form" aria-label="Registrar cobranza">
                        <h3 className="bulk-pay-form-title">
                            <i className="bi bi-wallet2" aria-hidden="true" />
                            Registrar cobranza
                        </h3>

                        <div className="bulk-pay-fields">
                            <div className="form-group">
                                <label className="form-label" htmlFor={montoId}>
                                    Monto a abonar <span className="bulk-pay-required" aria-hidden="true">*</span>
                                </label>
                                <div className="bulk-pay-amount-wrap">
                                    <span className="bulk-pay-amount-prefix">S/.</span>
                                    <input
                                        id={montoId}
                                        type="number"
                                        className="form-input bulk-pay-amount-input"
                                        value={montoTotal}
                                        onChange={(e) => setMontoTotal(e.target.value)}
                                        min="0.1"
                                        step="0.1"
                                        placeholder="0.00"
                                        disabled={!hasDebt}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {simulacion ? (
                                <div className="bulk-pay-cascade" role="status">
                                    <p className="bulk-pay-cascade-title">
                                        <i className="bi bi-info-circle" aria-hidden="true" />
                                        Asignación en cascada
                                    </p>
                                    <p className="bulk-pay-cascade-body">
                                        Este pago cancelará/abonará automáticamente{' '}
                                        <strong>{simulacion.pedidosAfectados} pedidos</strong>
                                        {' '}(del más antiguo al más nuevo).
                                    </p>
                                    {simulacion.ultimoPedidoParcial ? (
                                        <p className="bulk-pay-cascade-note">
                                            El pedido {simulacion.ultimoPedidoParcial.codigo} quedará con saldo de{' '}
                                            {formatCurrency(simulacion.ultimoPedidoParcial.saldoNuevo)}.
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="form-group">
                                <label className="form-label" htmlFor={metodoId}>
                                    Método de pago <span className="bulk-pay-required" aria-hidden="true">*</span>
                                </label>
                                <select
                                    id={metodoId}
                                    className="form-select"
                                    value={metodo}
                                    onChange={(e) => setMetodo(e.target.value)}
                                >
                                    <option value="transferencia">Transferencia Bancaria</option>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta (POS)</option>
                                    <option value="yape_plin">Yape / Plin</option>
                                </select>
                            </div>

                            <div className="bulk-pay-fields-row">
                                <div className="form-group">
                                    <label className="form-label" htmlFor={referenciaId}>
                                        Nº Ref. / Operación
                                    </label>
                                    <input
                                        id={referenciaId}
                                        className="form-input"
                                        value={referencia}
                                        onChange={(e) => setReferencia(e.target.value)}
                                        placeholder="Ej: OP-987654"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor={fechaId}>
                                        Fecha de pago
                                    </label>
                                    <FormDatePicker
                                        id={fechaId}
                                        value={fechaPago}
                                        onChange={setFechaPago}
                                        aria-label="Fecha de pago"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </Modal>
    );
};
