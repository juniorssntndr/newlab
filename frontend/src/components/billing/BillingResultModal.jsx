import React, { useState } from 'react';
import Modal from '../Modal.jsx';
import ComprobantePrintModal from './ComprobantePrintModal.jsx';

const STATUS_CONFIG = {
    aceptado: {
        icon: 'bi-check-circle-fill',
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#86efac',
        borderLeft: '#16a34a',
        label: 'Comprobante aceptado',
        sublabel: 'SUNAT procesó el comprobante correctamente.',
    },
    rechazado: {
        icon: 'bi-x-circle-fill',
        color: '#dc2626',
        bg: '#fef2f2',
        border: '#fca5a5',
        borderLeft: '#dc2626',
        label: 'Comprobante rechazado',
        sublabel: 'SUNAT rechazó el comprobante. Revisa los datos e intenta nuevamente.',
    },
    no_confirmado: {
        icon: 'bi-exclamation-triangle-fill',
        color: '#d97706',
        bg: '#fffbeb',
        border: '#fcd34d',
        borderLeft: '#d97706',
        label: 'Estado no confirmado',
        sublabel: 'No se pudo verificar si SUNAT procesó el comprobante. Verifica antes de reintentar.',
    },
    enviando: {
        icon: 'bi-arrow-repeat',
        color: 'var(--color-primary)',
        bg: 'var(--color-bg-alt)',
        border: 'var(--color-border)',
        borderLeft: 'var(--color-primary)',
        label: 'Enviando a SUNAT...',
        sublabel: 'Por favor espera.',
    },
};

/**
 * BillingResultModal — muestra el resultado de la emisión de comprobante.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onRetry?      () => void  — si se provee y status es 'no_confirmado', se muestra botón Reintentar
 *   status        'aceptado' | 'rechazado' | 'no_confirmado' | 'enviando'
 *   serie         string
 *   correlativo   string
 *   cdrCode       string | number
 *   cdrDescription  string
 *   hash          string
 *   pdfUrl        string
 *   xmlUrl        string
 *   cdrUrl        string
 *   requestId?    string
 *   message?      string
 *   comprobanteId? string | number  — si se provee, muestra botón Imprimir
 *   isDemoAsset?  boolean           — si es true, muestra aviso mock en links
 */
const BillingResultModal = ({
    open,
    onClose,
    onRetry,
    status = 'aceptado',
    serie,
    correlativo,
    cdrCode,
    cdrDescription,
    hash,
    pdfUrl,
    xmlUrl,
    cdrUrl,
    requestId,
    message,
    comprobanteId,
    isDemoAsset,
}) => {
    const [printOpen, setPrintOpen] = useState(false);
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.aceptado;
    const serieCorr = [serie, correlativo].filter(Boolean).join('-');
    const hasCdr = cdrCode !== undefined && cdrCode !== null;
    const hasLinks = pdfUrl || xmlUrl || cdrUrl;
    const hasPdfReal = pdfUrl && !isDemoAsset;

    return (
        <>
        <ComprobantePrintModal
            open={printOpen}
            onClose={() => setPrintOpen(false)}
            comprobanteId={comprobanteId}
        />
        <Modal
            open={open}
            onClose={onClose}
            title="Resultado de emisión"
            footer={
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                    {status === 'no_confirmado' && onRetry && (
                        <button type="button" className="btn btn-primary" onClick={onRetry}>
                            <i className="bi bi-arrow-repeat" aria-hidden="true" /> Reintentar
                        </button>
                    )}
                    {status === 'aceptado' && comprobanteId && (
                        <button type="button" className="btn btn-ghost" onClick={() => setPrintOpen(true)}>
                            <i className="bi bi-printer" aria-hidden="true" /> Imprimir…
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={onClose}>
                        {status === 'aceptado' ? 'Cerrar' : 'Entendido'}
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Cabecera de estado */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderLeft: `4px solid ${cfg.borderLeft}`,
                    borderRadius: '0 8px 8px 0',
                }}>
                    <i
                        className={`bi ${cfg.icon}`}
                        aria-hidden="true"
                        style={{ color: cfg.color, fontSize: '1.5rem', flexShrink: 0, marginTop: '1px' }}
                    />
                    <div>
                        <div style={{ fontWeight: 700, color: cfg.color, fontSize: '1rem' }}>{cfg.label}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{cfg.sublabel}</div>
                        {serieCorr && (
                            <div style={{
                                marginTop: '0.4rem',
                                fontFamily: 'var(--font-mono, monospace)',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: 'var(--color-text)',
                            }}>
                                {serieCorr}
                            </div>
                        )}
                    </div>
                </div>

                {/* CDR info */}
                {hasCdr && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '0.875rem 1rem',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>Código CDR</span>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{cdrCode}</span>
                        </div>
                        {cdrDescription && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.4, borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                                {cdrDescription}
                            </div>
                        )}
                    </div>
                )}

                {/* Hash */}
                {hash && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>Hash</span>
                        <span
                            title={hash}
                            style={{
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '0.72rem',
                                color: 'var(--color-text-secondary)',
                                textAlign: 'right',
                                wordBreak: 'break-all',
                                maxWidth: '80%',
                            }}
                        >
                            {hash}
                        </span>
                    </div>
                )}

                {/* Mensaje de error en casos no-aceptado */}
                {message && status !== 'aceptado' && (
                    <div style={{
                        fontSize: '0.85rem',
                        color: status === 'rechazado' ? '#dc2626' : '#d97706',
                        background: status === 'rechazado' ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${status === 'rechazado' ? '#fca5a5' : '#fcd34d'}`,
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        lineHeight: 1.4,
                    }}>
                        {message}
                    </div>
                )}

                {/* Links de descarga / Documentos SUNAT */}
                {hasLinks && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {isDemoAsset && (
                            <div style={{
                                padding: '0.5rem 0.75rem',
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                borderLeft: '3px solid #d97706',
                                borderRadius: '0 6px 6px 0',
                                fontSize: '0.78rem',
                                color: '#92400e',
                                lineHeight: 1.4,
                            }}>
                                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ color: '#d97706', marginRight: '5px' }} />
                                En modo mock los enlaces de APISPERU son de demostración.
                                En producción (<code style={{ fontSize: '0.72rem' }}>APISPERU_MOCK=false</code>) se usarán los archivos reales de SUNAT.
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {hasPdfReal && (
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-ghost btn-sm"
                                >
                                    <i className="bi bi-file-earmark-pdf-fill" aria-hidden="true" /> PDF proveedor
                                </a>
                            )}
                            {xmlUrl && !isDemoAsset && (
                                <a
                                    href={xmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-ghost btn-sm"
                                >
                                    <i className="bi bi-code-slash" aria-hidden="true" /> XML
                                </a>
                            )}
                            {cdrUrl && !isDemoAsset && (
                                <a
                                    href={cdrUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-ghost btn-sm"
                                >
                                    <i className="bi bi-shield-check" aria-hidden="true" /> CDR
                                </a>
                            )}
                            {isDemoAsset && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                                    Usa <strong>Imprimir…</strong> para la representación AFINIX (A4 / 80mm).
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Request ID */}
                {requestId && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                        ID solicitud: <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{requestId}</span>
                    </div>
                )}
            </div>
        </Modal>
        </>
    );
};

export default BillingResultModal;
