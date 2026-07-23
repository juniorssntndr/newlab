import React from 'react';
import Modal from '../Modal.jsx';

const fmt = (n) => `S/. ${(parseFloat(n) || 0).toFixed(2)}`;

/**
 * BillingConfirmModal — muestra un resumen del comprobante a emitir y pide
 * confirmación explícita antes de enviar a SUNAT.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onConfirm     () => void
 *   tipoComprobante  '01' | '03'
 *   receptorName  string
 *   receptorDoc   string
 *   entorno       string  (e.g. 'beta', 'producción')
 *   base          number  (base gravada sin IGV)
 *   igv           number
 *   total         number
 *   confirming    boolean — deshabilita botones mientras la mutation está en vuelo
 */
const BillingConfirmModal = ({
    open,
    onClose,
    onConfirm,
    tipoComprobante = '03',
    receptorName = '',
    receptorDoc = '',
    entorno = 'beta',
    base,
    igv,
    total,
    confirming = false,
}) => {
    const esBoleta = tipoComprobante !== '01';
    const tipoLabel = esBoleta ? 'Boleta Electrónica' : 'Factura Electrónica';
    const accentColor = esBoleta ? '#10b981' : 'var(--color-primary)';

    return (
        <Modal
            open={open}
            onClose={confirming ? undefined : onClose}
            title="Confirmar emisión"
            footer={
                <>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onClose}
                        disabled={confirming}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onConfirm}
                        disabled={confirming}
                    >
                        {confirming ? (
                            <>
                                <span
                                    className="spinner"
                                    style={{ width: '1rem', height: '1rem', borderWidth: '2px', display: 'inline-block' }}
                                    aria-hidden="true"
                                />
                                {' '}Enviando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-send-check-fill" aria-hidden="true" />
                                {' '}Confirmar y emitir
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Tipo de comprobante */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    borderLeft: `4px solid ${accentColor}`,
                    background: 'var(--color-bg-alt)',
                    borderRadius: '0 8px 8px 0',
                }}>
                    <i className="bi bi-receipt" aria-hidden="true" style={{ color: accentColor, fontSize: '1.25rem' }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{tipoLabel}</span>
                    {entorno && (
                        <span style={{
                            marginLeft: 'auto',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            borderRadius: '999px',
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                        }}>
                            {entorno}
                        </span>
                    )}
                </div>

                {/* Datos del receptor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Receptor</span>
                        <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{receptorName || '—'}</span>
                    </div>
                    {receptorDoc && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{esBoleta ? 'DNI / Doc.' : 'RUC'}</span>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{receptorDoc}</span>
                        </div>
                    )}
                </div>

                {/* Totales */}
                <div style={{
                    borderTop: '1px solid var(--color-border)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '0.875rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        <span>Base gravada</span>
                        <span>{fmt(base)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        <span>IGV (18%)</span>
                        <span>{fmt(igv)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, marginTop: '0.25rem' }}>
                        <span>Total</span>
                        <span style={{ color: accentColor }}>{fmt(total)}</span>
                    </div>
                </div>

                {/* Aviso */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-start',
                    background: 'rgba(59,130,246,0.07)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.82rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.45,
                }}>
                    <i className="bi bi-info-circle-fill" aria-hidden="true" style={{ color: 'var(--color-primary)', marginTop: '1px', flexShrink: 0 }} />
                    <span>
                        Al confirmar se enviará el comprobante a SUNAT y se reservará un correlativo.
                        Esta acción no se puede deshacer inmediatamente.
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default BillingConfirmModal;
