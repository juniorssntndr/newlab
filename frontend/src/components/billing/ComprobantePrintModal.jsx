import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../Modal.jsx';
import ComprobantePrintSheet from './ComprobantePrintSheet.jsx';
import { fetchComprobantePrint } from '../../modules/billing/api/billingApi.js';
import { useAuth } from '../../state/AuthContext.jsx';

const FORMAT_OPTIONS = [
    {
        id: 'a4',
        label: 'A4',
        subtitle: 'Impresora estándar',
        icon: 'bi-file-earmark-text',
        pageHint: '@page { size: A4; }',
    },
    {
        id: 'ticket80',
        label: 'Ticketera 80mm',
        subtitle: 'Impresora térmica',
        icon: 'bi-receipt',
        pageHint: '@page { size: 80mm auto; }',
    },
    {
        id: 'a5',
        label: 'A5 / Media hoja',
        subtitle: 'Hoja reducida',
        icon: 'bi-file-earmark',
        pageHint: '@page { size: A5; }',
    },
];

const isDemoUrl = (url) =>
    !!url && (url.includes('/demo/') || url.includes('demo.apisperu') || url.includes('apisperu.com/demo'));

/**
 * ComprobantePrintModal
 *
 * Props:
 *   open           boolean
 *   onClose        () => void
 *   comprobanteId  string | number
 */
const ComprobantePrintModal = ({ open, onClose, comprobanteId }) => {
    const { getHeaders } = useAuth();
    const [format, setFormat] = useState('a4');
    const [printData, setPrintData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [printing, setPrinting] = useState(false);
    const printRootRef = useRef(null);

    useEffect(() => {
        if (!open || !comprobanteId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchComprobantePrint({ id: comprobanteId, headers: getHeaders() })
            .then((data) => { if (!cancelled) setPrintData(data); })
            .catch((err) => { if (!cancelled) setError(err.message || 'Error al cargar datos de impresión.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, comprobanteId, getHeaders]);

    const handlePrint = useCallback(() => {
        if (!printRootRef.current) return;
        setPrinting(true);
        document.body.classList.add(`cpe-printing--${format}`);
        printRootRef.current.style.display = 'block';

        requestAnimationFrame(() => {
            window.print();
            // Restaurar tras el diálogo de impresión
            setTimeout(() => {
                if (printRootRef.current) printRootRef.current.style.display = 'none';
                document.body.classList.remove(`cpe-printing--${format}`);
                setPrinting(false);
            }, 500);
        });
    }, [format]);

    const assets = printData?.assets || {};
    const comprobante = printData?.comprobante || {};

    const hasPdf = !!comprobante.pdf_url && !assets.isDemoAsset;
    const hasXml = !!comprobante.xml_url && !assets.isDemoAsset;
    const hasCdr = !!comprobante.cdr_url && !assets.isDemoAsset;

    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                title="Imprimir comprobante electrónico"
                footer={
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cerrar
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handlePrint}
                            disabled={!printData || loading || printing}
                        >
                            {printing ? (
                                <><i className="bi bi-hourglass-split" aria-hidden="true" /> Imprimiendo...</>
                            ) : (
                                <><i className="bi bi-printer-fill" aria-hidden="true" /> Imprimir</>
                            )}
                        </button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Selector de formato */}
                    <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Formato de impresión
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {FORMAT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setFormat(opt.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 0.875rem',
                                        borderRadius: '8px',
                                        border: format === opt.id
                                            ? '2px solid var(--color-primary)'
                                            : '2px solid var(--color-border)',
                                        background: format === opt.id
                                            ? 'rgba(var(--color-primary-rgb, 20,184,166), 0.08)'
                                            : 'var(--color-surface)',
                                        cursor: 'pointer',
                                        fontWeight: format === opt.id ? 700 : 400,
                                        color: format === opt.id ? 'var(--color-primary)' : 'var(--color-text)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <i className={`bi ${opt.icon}`} aria-hidden="true" />
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.875rem' }}>{opt.label}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{opt.subtitle}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Estado de carga */}
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                            <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                            Cargando datos del comprobante...
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.875rem', color: '#dc2626' }}>
                            <i className="bi bi-exclamation-circle-fill" aria-hidden="true" /> {error}
                        </div>
                    )}

                    {/* Vista previa compacta del comprobante */}
                    {printData && !loading && (
                        <div style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            padding: '0.75rem 1rem',
                            background: 'var(--color-bg-alt)',
                            fontSize: '0.82rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                {comprobante.tipo_comprobante === '01' ? 'Factura' : 'Boleta'}{' '}
                                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                    {comprobante.serie}-{comprobante.correlativo}
                                </span>
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)' }}>
                                {comprobante.receptor_razon_social || '—'} · {comprobante.receptor_documento || ''}
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                Total: S/. {parseFloat(comprobante.total_venta || 0).toFixed(2)}
                            </div>
                        </div>
                    )}

                    {/* Sección documentos SUNAT */}
                    {printData && !loading && (
                        <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Documentos SUNAT
                            </div>

                            {/* Aviso demo */}
                            {assets.isDemoAsset && (
                                <div style={{
                                    padding: '0.625rem 0.875rem',
                                    background: '#fffbeb',
                                    border: '1px solid #fcd34d',
                                    borderLeft: '4px solid #d97706',
                                    borderRadius: '0 6px 6px 0',
                                    fontSize: '0.8rem',
                                    color: '#92400e',
                                    marginBottom: '0.625rem',
                                    lineHeight: 1.4,
                                }}>
                                    <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" style={{ color: '#d97706', marginRight: '6px' }} />
                                    En modo mock los enlaces PDF/XML/CDR de APISPERU son de demostración. En producción
                                    {' '}(<code style={{ fontSize: '0.75rem' }}>APISPERU_MOCK=false</code>) se usarán los archivos reales de SUNAT.
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {hasPdf && (
                                    <a
                                        href={comprobante.pdf_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <i className="bi bi-file-earmark-pdf-fill" aria-hidden="true" /> PDF proveedor
                                    </a>
                                )}
                                {hasXml && (
                                    <a
                                        href={comprobante.xml_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <i className="bi bi-code-slash" aria-hidden="true" /> XML
                                    </a>
                                )}
                                {hasCdr && (
                                    <a
                                        href={comprobante.cdr_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <i className="bi bi-shield-check" aria-hidden="true" /> CDR
                                    </a>
                                )}
                                {assets.isDemoAsset && (
                                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                        PDF/XML/CDR externos no disponibles en mock. Usa <strong>Imprimir</strong> arriba.
                                    </span>
                                )}
                                {!assets.isDemoAsset && !hasPdf && !hasXml && !hasCdr && (
                                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                                        <i className="bi bi-dash-circle" aria-hidden="true" /> Sin archivos externos disponibles.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Portal de impresión: siempre en el DOM, se hace visible al imprimir */}
            {createPortal(
                <div
                    id="cpe-print-root"
                    ref={printRootRef}
                    style={{ display: 'none' }}
                    aria-hidden="true"
                >
                    {printData && (
                        <ComprobantePrintSheet data={printData} format={format} />
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

export default ComprobantePrintModal;
