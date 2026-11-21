import React, { useState } from 'react';
import Modal from '../Modal.jsx';
import { resolveImageUrl } from '../../utils/resolveImageUrl.js';

export default function ReceiptPreviewModal({
    open,
    onClose,
    receiptUrl,
    movement = null
}) {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    if (!open || !receiptUrl) return null;

    const fullUrl = resolveImageUrl(receiptUrl);
    const isPdf = receiptUrl.toLowerCase().endsWith('.pdf') || receiptUrl.includes('application/pdf');

    const handleReset = () => {
        setZoom(1);
        setRotation(0);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title={movement?.sustento_numero ? `Comprobante: ${movement.sustento_numero}` : "Comprobante de Sustento"}
            kicker="AFINIX LAB • Rendición de Cuentas y Auditoría"
            subtitle={movement ? `${movement.tipo === 'egreso' ? 'Egreso / Gasto' : 'Ingreso / Cobro'} • S/. ${Number(movement.monto || 0).toFixed(2)}` : "Visualizador digital de comprobantes"}
            icon="bi-file-earmark-image"
            size="lg"
            footer={(
                <div className="modal-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isPdf && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                                    title="Acercar zoom"
                                >
                                    <i className="bi bi-zoom-in"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                                    title="Alejar zoom"
                                >
                                    <i className="bi bi-zoom-out"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setRotation(r => (r + 90) % 360)}
                                    title="Girar 90°"
                                >
                                    <i className="bi bi-arrow-clockwise"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={handleReset}
                                    title="Restablecer tamaño"
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    Reset
                                </button>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            download
                        >
                            <i className="bi bi-box-arrow-up-right" style={{ marginRight: '4px' }}></i> Abrir original
                        </a>
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleClose}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        >
            <div className="receipt-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {movement && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '10px',
                        padding: '10px 14px',
                        background: 'var(--color-bg-alt, #f8fafc)',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        fontSize: '0.8rem'
                    }}>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.72rem' }}>Beneficiario / Emisor</span>
                            <strong>{movement.beneficiario || movement.sustento_emisor_razon_social || 'No especificado'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.72rem' }}>Fecha del Movimiento</span>
                            <strong>{movement.fecha_movimiento ? String(movement.fecha_movimiento).slice(0, 10) : '—'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.72rem' }}>Categoría</span>
                            <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{movement.categoria_gasto || 'General'}</span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.72rem' }}>Monto Auditado</span>
                            <strong style={{ color: movement.tipo === 'egreso' ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #10b981)', fontSize: '0.95rem' }}>
                                {movement.tipo === 'egreso' ? '-' : '+'}S/. {Number(movement.monto || 0).toFixed(2)}
                            </strong>
                        </div>
                    </div>
                )}

                <div style={{
                    width: '100%',
                    minHeight: '380px',
                    maxHeight: '65vh',
                    background: '#090d16',
                    borderRadius: '8px',
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    position: 'relative'
                }}>
                    {isPdf ? (
                        <iframe
                            src={fullUrl}
                            title="Documento PDF"
                            style={{ width: '100%', height: '500px', border: 'none', borderRadius: '6px' }}
                        />
                    ) : (
                        <img
                            src={fullUrl}
                            alt="Comprobante de sustento"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '60vh',
                                objectFit: 'contain',
                                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                transition: 'transform 0.15s ease',
                                borderRadius: '4px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}
                        />
                    )}
                </div>
            </div>
        </Modal>
    );
}
