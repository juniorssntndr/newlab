import React from 'react';
import AfinixLogo from '../AfinixLogo.jsx';
import './comprobante-print.css';

const TIPO_LABEL = { '01': 'FACTURA ELECTRÓNICA', '03': 'BOLETA DE VENTA ELECTRÓNICA' };
const TIPO_DOC_LABEL = { '1': 'DNI', '6': 'RUC', '4': 'CE', '-': 'Sin doc.' };

const fmt = (v) => {
    const n = parseFloat(v || 0);
    return isNaN(n) ? 'S/. 0.00' : `S/. ${n.toFixed(2)}`;
};

const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(v));
    } catch {
        return String(v);
    }
};

/**
 * ComprobantePrintSheet — hoja de impresión de comprobante electrónico SUNAT.
 *
 * Props:
 *   data    — objeto con { comprobante, emisor, pedido, lineas, assets }
 *   format  — 'a4' | 'ticket80' | 'a5'   (default 'a4')
 */
const ComprobantePrintSheet = ({ data, format = 'a4' }) => {
    if (!data) return null;

    const { comprobante: c, emisor, pedido, lineas = [] } = data;
    const tipoLabel = TIPO_LABEL[c?.tipo_comprobante] || 'COMPROBANTE ELECTRÓNICO';
    const serieCorr = [c?.serie, c?.correlativo].filter(Boolean).join('-');
    const docReceptorLabel = TIPO_DOC_LABEL[c?.receptor_tipo_doc] || 'Doc';

    if (format === 'ticket80') {
        return (
            <div className="cpe-print--ticket80">
                <div className="cpe-t-center">
                    <div className="cpe-t-logo">
                        <AfinixLogo size={28} theme="light" showText={false} />
                    </div>
                    <div className="cpe-t-brand">{emisor?.nombre_comercial || 'AFINIX Dental Lab'}</div>
                    {emisor?.ruc && <div className="cpe-t-sub">RUC: {emisor.ruc}</div>}
                    {emisor?.direccion_fiscal && <div className="cpe-t-sub">{emisor.direccion_fiscal}</div>}
                </div>
                <hr className="cpe-t-divider" />
                <div className="cpe-t-center">
                    <div className="cpe-t-doc-type">{tipoLabel}</div>
                    <div className="cpe-t-serie">{serieCorr}</div>
                    <div className="cpe-t-sub">Fecha: {fmtDate(c?.fecha_emision)}</div>
                </div>
                <hr className="cpe-t-divider" />
                <table className="cpe-t-table">
                    <tbody>
                        <tr>
                            <td className="cpe-t-label" colSpan={2}>RECEPTOR</td>
                        </tr>
                        <tr>
                            <td colSpan={2} style={{ fontWeight: 600 }}>{c?.receptor_razon_social || '—'}</td>
                        </tr>
                        <tr>
                            <td>{docReceptorLabel}: {c?.receptor_documento || '—'}</td>
                        </tr>
                        {c?.receptor_direccion && (
                            <tr><td colSpan={2} style={{ fontSize: '8pt', color: '#444' }}>{c.receptor_direccion}</td></tr>
                        )}
                    </tbody>
                </table>
                <hr className="cpe-t-divider" />
                <table className="cpe-t-table">
                    <tbody>
                        {lineas.map((ln, i) => (
                            <React.Fragment key={i}>
                                <tr>
                                    <td colSpan={2} style={{ paddingBottom: '1px' }}>{ln.descripcion}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#444', fontSize: '9pt' }}>
                                        {ln.cantidad} x {fmt(ln.precio_unitario)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(ln.subtotal)}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                <hr className="cpe-t-divider" />
                <table className="cpe-t-table">
                    <tbody>
                        <tr>
                            <td>Op. Gravadas</td>
                            <td style={{ textAlign: 'right' }}>{fmt(c?.total_gravada)}</td>
                        </tr>
                        <tr>
                            <td>IGV (18%)</td>
                            <td style={{ textAlign: 'right' }}>{fmt(c?.total_igv)}</td>
                        </tr>
                        <tr className="cpe-t-total-row">
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'right' }}>{fmt(c?.total_venta)}</td>
                        </tr>
                    </tbody>
                </table>
                <hr className="cpe-t-divider" />
                {c?.hash_cpe && (
                    <div className="cpe-t-hash">Hash: {c.hash_cpe}</div>
                )}
                {c?.cdr_code && (
                    <div className="cpe-t-hash">CDR: {c.cdr_code} — {c.cdr_description || ''}</div>
                )}
                <div className="cpe-t-footer">
                    Representación impresa del comprobante electrónico
                </div>
                <div className="cpe-t-footer">¡Gracias por su preferencia!</div>
            </div>
        );
    }

    // A4 o A5 — misma estructura, diferente clase CSS
    const cls = format === 'a5' ? 'cpe-print--a5' : 'cpe-print--a4';

    return (
        <div className={cls}>
            {/* Cabecera */}
            <div className="cpe-header">
                <div className="cpe-emisor">
                    <div className="cpe-emisor-logo">
                        <AfinixLogo size={48} theme="light" showText />
                    </div>
                    {emisor?.ruc && <div className="cpe-emisor-sub">RUC: {emisor.ruc}</div>}
                    {emisor?.razon_social && (
                        <div className="cpe-emisor-sub">{emisor.razon_social}</div>
                    )}
                    {emisor?.nombre_comercial && emisor?.razon_social && emisor.nombre_comercial !== emisor.razon_social && (
                        <div className="cpe-emisor-sub">{emisor.nombre_comercial}</div>
                    )}
                    {!emisor?.razon_social && !emisor?.nombre_comercial && (
                        <div className="cpe-emisor-sub">AFINIX Dental Lab</div>
                    )}
                    {emisor?.direccion_fiscal && <div className="cpe-emisor-sub">{emisor.direccion_fiscal}</div>}
                </div>
                <div className="cpe-doc-box">
                    <div className="cpe-doc-type">{tipoLabel}</div>
                    <div className="cpe-doc-serie">{serieCorr}</div>
                    <div className="cpe-doc-fecha">{fmtDate(c?.fecha_emision)}</div>
                </div>
            </div>

            {/* Receptor */}
            <div className="cpe-section-title">Datos del receptor</div>
            <div className="cpe-info-grid">
                <span className="cpe-info-label">{docReceptorLabel}</span>
                <span className="cpe-info-value">{c?.receptor_documento || '—'}</span>
                <span className="cpe-info-label">Razón Social</span>
                <span className="cpe-info-value">{c?.receptor_razon_social || '—'}</span>
                {c?.receptor_direccion && (
                    <>
                        <span className="cpe-info-label">Dirección</span>
                        <span className="cpe-info-value">{c.receptor_direccion}</span>
                    </>
                )}
            </div>

            {/* Pedido */}
            {pedido?.paciente_nombre && (
                <>
                    <div className="cpe-section-title">Datos adicionales</div>
                    <div className="cpe-info-grid">
                        <span className="cpe-info-label">Paciente</span>
                        <span className="cpe-info-value">{pedido.paciente_nombre}</span>
                    </div>
                </>
            )}

            {/* Ítems */}
            <div className="cpe-section-title">Detalle de operación</div>
            <table className="cpe-items-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Descripción</th>
                        <th style={{ textAlign: 'center', width: '52px' }}>Cant.</th>
                        <th style={{ textAlign: 'right', width: '90px' }}>P. Unit.</th>
                        <th style={{ textAlign: 'right', width: '90px' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {lineas.length === 0 ? (
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '10px 0' }}>Sin líneas de detalle</td>
                        </tr>
                    ) : lineas.map((ln, i) => (
                        <tr key={i}>
                            <td>{ln.descripcion}</td>
                            <td style={{ textAlign: 'center' }}>{ln.cantidad}</td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(ln.precio_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(ln.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totales */}
            <div className="cpe-totals-wrap">
                <div className="cpe-totals-box">
                    <div className="cpe-total-row">
                        <span className="cpe-total-label">Op. Gravadas</span>
                        <span>{fmt(c?.total_gravada)}</span>
                    </div>
                    <div className="cpe-total-row">
                        <span className="cpe-total-label">IGV (18%)</span>
                        <span>{fmt(c?.total_igv)}</span>
                    </div>
                    <div className="cpe-total-row">
                        <span className="cpe-total-label">IMPORTE TOTAL</span>
                        <span>{fmt(c?.total_venta)}</span>
                    </div>
                </div>
            </div>

            {/* Hash / CDR */}
            {(c?.hash_cpe || c?.cdr_code) && (
                <div style={{ marginTop: '12px' }}>
                    {c?.hash_cpe && (
                        <div className="cpe-hash-row">
                            <span style={{ fontWeight: 600, flexShrink: 0 }}>Hash:</span>
                            <span className="cpe-hash-value">{c.hash_cpe}</span>
                        </div>
                    )}
                    {c?.cdr_code && (
                        <div className="cpe-hash-row">
                            <span style={{ fontWeight: 600, flexShrink: 0 }}>CDR:</span>
                            <span className="cpe-hash-value">{c.cdr_code}{c.cdr_description ? ` — ${c.cdr_description}` : ''}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="cpe-footer">
                Representación impresa del comprobante electrónico — No válido como comprobante de pago
                <br />
                Consulta en: <strong>www.sunat.gob.pe</strong>
            </div>
        </div>
    );
};

export default ComprobantePrintSheet;
