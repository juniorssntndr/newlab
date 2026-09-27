import React, { useEffect, useState } from 'react';
import logoLight from '../../assets/branding/logo-light.png';
import { numeroALetras, buildSunatQRPayload, generateQRCodeDataUrl } from '../../utils/sunatReceipt.js';
import './comprobante-print.css';

const TIPO_LABEL = {
    '01': 'FACTURA ELECTRÓNICA',
    '03': 'BOLETA DE VENTA ELECTRÓNICA',
    '00': 'NOTA DE VENTA / TICKET DE COBRO',
    'NOTA': 'NOTA DE VENTA / TICKET DE COBRO',
    'nota': 'NOTA DE VENTA / TICKET DE COBRO',
    'factura': 'FACTURA ELECTRÓNICA',
    'boleta': 'BOLETA DE VENTA ELECTRÓNICA',
};

const TIPO_DOC_LABEL = { '1': 'DNI', '6': 'RUC', '4': 'CE', '-': 'Sin doc.' };

const fmt = (v) => {
    const n = parseFloat(v || 0);
    return isNaN(n) ? 'S/. 0.00' : `S/. ${n.toFixed(2)}`;
};

const fmtDate = (v) => {
    if (!v) return '—';
    try {
        return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
    } catch {
        return String(v);
    }
};

/**
 * ComprobantePrintSheet — hoja de impresión de comprobante electrónico SUNAT y ticket de mostrador.
 *
 * Props:
 *   data    — objeto con { comprobante, emisor, pedido, lineas, assets }
 *   format  — 'a4' | 'ticket80' | 'a5'   (default 'a4')
 */
const ComprobantePrintSheet = ({ data, format = 'a4' }) => {
    const [qrDataUrl, setQrDataUrl] = useState('');

    if (!data) return null;

    const { comprobante: c, emisor, pedido, lineas = [] } = data;
    const tipoKey = String(c?.tipo_comprobante || '00');
    const tipoLabel = TIPO_LABEL[tipoKey] || 'COMPROBANTE DE PAGO';
    const isFiscal = ['01', '03', 'factura', 'boleta'].includes(tipoKey);

    // Formateador estricto para evitar series duplicadas (ej: B001-B001-...) y cumplir formato SUNAT
    const formatSerieCorrelativo = (serieProp, correlativoProp, tipo) => {
        const defaultSerie = (tipo === '01' || tipo === 'factura') ? 'F001'
            : (tipo === '03' || tipo === 'boleta' ? 'B001' : 'NV01');

        let raw = String(correlativoProp || '').trim();
        let s = String(serieProp || '').trim().toUpperCase();

        if (raw.includes('-')) {
            const parts = raw.split('-');
            const first = parts[0].trim().toUpperCase();
            if (first.length >= 2 && first.length <= 4) {
                s = first;
            }
            raw = parts.slice(1).join('-');
        }

        if (!s || s === 'TCK') s = defaultSerie;

        const digits = raw.replace(/\D/g, '');
        const num = digits ? digits.slice(-8).padStart(8, '0') : '00000001';

        return {
            serie: s,
            correlativo: num,
            display: `${s}-${num}`
        };
    };

    const parsedNumber = formatSerieCorrelativo(c?.serie, c?.correlativo, tipoKey);
    const serieCorr = parsedNumber.display;
    const docReceptorLabel = TIPO_DOC_LABEL[c?.receptor_tipo_doc] || (c?.receptor_documento?.length === 11 ? 'RUC' : 'DNI');

    // Generación dinámica del QR oficial SUNAT
    useEffect(() => {
        let isCurrent = true;
        if (c?.qr_data_url) {
            setQrDataUrl(c.qr_data_url);
            return;
        }

        const payload = buildSunatQRPayload({
            rucEmisor: emisor?.ruc || '20616033973',
            tipoComprobante: tipoKey === 'factura' ? '01' : (tipoKey === 'boleta' ? '03' : (tipoKey === '01' || tipoKey === '03' ? tipoKey : '00')),
            serie: parsedNumber.serie,
            correlativo: parsedNumber.correlativo,
            igv: c?.total_igv || 0,
            total: c?.total_venta || 0,
            fecha: c?.fecha_emision ? new Date(c.fecha_emision) : new Date(),
            tipoDocReceptor: c?.receptor_tipo_doc,
            numDocReceptor: c?.receptor_documento,
            hash: c?.hash_cpe || 'AFINIX-DIGEST'
        });

        generateQRCodeDataUrl(payload, { width: 140, margin: 1 }).then((url) => {
            if (isCurrent && url) setQrDataUrl(url);
        });

        return () => { isCurrent = false; };
    }, [c, emisor, tipoKey, parsedNumber.serie, parsedNumber.correlativo]);

    const totalCobrado = parseFloat(c?.total_cobrado ?? c?.total_venta ?? 0);
    const saldoRestante = parseFloat(c?.saldo_restante ?? 0);
    const descuento = parseFloat(c?.descuento ?? 0);

    /* ────────────────────────── TICKET 80MM ────────────────────────── */
    /* ────────────────────────── TICKET 80MM ────────────────────────── */
    if (format === 'ticket80') {
        return (
            <div className="cpe-print--ticket80">
                <div className="cpe-t-center">
                    <div className="cpe-t-logo">
                        <img src={logoLight} alt="AFINIX DENTAL LAB" className="cpe-t-logo-img" />
                    </div>
                    <div className="cpe-t-brand">{emisor?.razon_social || 'AFINIX DENTAL LAB S.A.C.'}</div>
                    <div className="cpe-t-sub">R.U.C. {emisor?.ruc || '20616033973'}</div>
                    <div className="cpe-t-sub">Calle Piura 316, Mariano Melgar, Arequipa.</div>
                </div>

                <div className="cpe-t-doc-box">
                    <div className="cpe-t-doc-type">{tipoLabel}</div>
                    <div className="cpe-t-serie">{serieCorr}</div>
                    <div className="cpe-t-doc-meta">
                        <span>Emisión: {fmtDate(c?.fecha_emision)}</span>
                        {c?.responsable && <span> · Cajero: {c.responsable}</span>}
                    </div>
                </div>

                <div className="cpe-t-client-box">
                    <div className="cpe-t-label">ADQUIRIENTE / CLIENTE</div>
                    <div className="cpe-t-client-name">{c?.receptor_razon_social || 'Cliente General'}</div>
                    {c?.receptor_documento && (
                        <div className="cpe-t-client-doc">{docReceptorLabel}: <strong>{c.receptor_documento}</strong></div>
                    )}
                    {c?.receptor_direccion && (
                        <div className="cpe-t-client-dir">{c.receptor_direccion}</div>
                    )}
                </div>

                <hr className="cpe-t-divider" />

                <table className="cpe-t-table">
                    <thead>
                        <tr className="cpe-t-items-head">
                            <th style={{ width: '14%', textAlign: 'left', paddingRight: '6px' }}>CANT</th>
                            <th style={{ width: '46%', textAlign: 'left', paddingRight: '6px' }}>DESCRIPCIÓN</th>
                            <th style={{ width: '18%', textAlign: 'right', paddingRight: '6px' }}>P.U.</th>
                            <th style={{ width: '22%', textAlign: 'right' }}>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineas.map((ln, i) => (
                            <tr key={i} className="cpe-t-item-row">
                                <td style={{ textAlign: 'left', verticalAlign: 'top', fontWeight: 700, paddingRight: '6px' }}>
                                    {ln.cantidad}
                                </td>
                                <td style={{ textAlign: 'left', verticalAlign: 'top', paddingRight: '6px' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.25 }}>{ln.descripcion}</div>
                                </td>
                                <td style={{ textAlign: 'right', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', color: '#475569', paddingRight: '6px' }}>
                                    {fmt(ln.precio_unitario).replace('S/. ', '')}
                                </td>
                                <td style={{ textAlign: 'right', verticalAlign: 'top', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmt(ln.subtotal)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <hr className="cpe-t-divider" />

                <div className="cpe-t-totals-wrap">
                    <table className="cpe-t-table">
                        <tbody>
                            {isFiscal ? (
                                <>
                                    <tr>
                                        <td>Op. Gravadas:</td>
                                        <td className="cpe-t-num">{fmt(c?.total_gravada)}</td>
                                    </tr>
                                    <tr>
                                        <td>I.G.V. (18%):</td>
                                        <td className="cpe-t-num">{fmt(c?.total_igv)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td>Subtotal:</td>
                                    <td className="cpe-t-num">{fmt(c?.subtotal_original || c?.total_venta)}</td>
                                </tr>
                            )}

                            {descuento > 0 && (
                                <tr style={{ color: '#b91c1c' }}>
                                    <td>Descuento {c?.descuento_motivo ? `(${c.descuento_motivo})` : ''}:</td>
                                    <td className="cpe-t-num">-{fmt(descuento)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="cpe-t-grand-total-box">
                        <span className="cpe-t-grand-label">TOTAL:</span>
                        <span className="cpe-t-grand-value">{fmt(c?.total_venta)}</span>
                    </div>

                    {(c?.total_cobrado !== undefined || saldoRestante > 0.01) && (
                        <table className="cpe-t-table" style={{ marginTop: '3px' }}>
                            <tbody>
                                {c?.total_cobrado !== undefined && (
                                    <tr>
                                        <td style={{ fontWeight: 700 }}>Monto Cobrado Hoy:</td>
                                        <td className="cpe-t-num" style={{ fontWeight: 700 }}>{fmt(totalCobrado)}</td>
                                    </tr>
                                )}
                                {saldoRestante > 0.01 && (
                                    <tr style={{ color: '#b45309', fontWeight: 700 }}>
                                        <td>Saldo Pendiente:</td>
                                        <td className="cpe-t-num">{fmt(saldoRestante)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Leyenda SUNAT 1000 en letras */}
                <div className="cpe-t-words-box">
                    <strong>SON: </strong>{numeroALetras(totalCobrado || c?.total_venta || 0)}
                </div>

                <hr className="cpe-t-divider" />

                <div className="cpe-t-pay-info">
                    <div className="cpe-t-pay-row">
                        <span>Forma de Pago:</span>
                        <strong>{c?.forma_pago || (saldoRestante > 0.01 ? 'CRÉDITO / PARCIAL' : 'AL CONTADO')}</strong>
                    </div>
                    <div className="cpe-t-pay-row">
                        <span>Medio de Pago:</span>
                        <span>{c?.medio_pago || 'EFECTIVO'}</span>
                    </div>
                    {c?.referencia && (
                        <div className="cpe-t-pay-row">
                            <span>N° Operación:</span>
                            <span>{c.referencia}</span>
                        </div>
                    )}
                </div>

                {/* Código QR Real y Hash */}
                <div className="cpe-t-qr-block">
                    {qrDataUrl && (
                        <div className="cpe-t-qr">
                            <img src={qrDataUrl} alt="Código QR SUNAT" />
                        </div>
                    )}
                    {c?.hash_cpe && (
                        <div className="cpe-t-hash">Hash: {c.hash_cpe}</div>
                    )}
                    {c?.cdr_code && (
                        <div className="cpe-t-hash">CDR: {c.cdr_code} — {c.cdr_description || ''}</div>
                    )}
                </div>

                <div className="cpe-t-footer">
                    <div className="cpe-t-footer-legal">
                        {isFiscal
                            ? 'Representación impresa de la Boleta/Factura Electrónica'
                            : 'Representación impresa del Comprobante de Cobro en Mostrador'}
                    </div>
                    <div className="cpe-t-footer-sub">
                        Supervisado por SUNAT · Sistema AFINIX LAB
                    </div>
                    <div className="cpe-t-footer-thanks">
                        ¡Gracias por su preferencia!
                    </div>
                    <div className="cpe-t-footer-web">
                        <strong>www.afinixlab.com</strong>
                    </div>
                </div>
            </div>
        );
    }

    /* ────────────────────────── A4 O A5 ────────────────────────── */
    const cls = format === 'a5' ? 'cpe-print--a5' : 'cpe-print--a4';

    return (
        <div className={cls}>
            {/* Cabecera */}
            <div className="cpe-header">
                <div className="cpe-emisor">
                    <div className="cpe-emisor-logo">
                        <img src={logoLight} alt="AFINIX DENTAL LAB" className="cpe-emisor-logo-img" />
                    </div>
                    <div className="cpe-emisor-sub" style={{ fontWeight: 700, fontSize: format === 'a5' ? '8.5pt' : '10pt', color: '#1e293b' }}>
                        {emisor?.razon_social || 'AFINIX DENTAL LAB S.A.C.'}
                    </div>
                    <div className="cpe-emisor-sub">Calle Piura 316, Mariano Melgar, Arequipa.</div>
                </div>
                <div className="cpe-doc-box">
                    <div className="cpe-doc-ruc">R.U.C. {emisor?.ruc || '20616033973'}</div>
                    <div className="cpe-doc-type">{tipoLabel}</div>
                    <div className="cpe-doc-serie">{serieCorr}</div>
                    <div className="cpe-doc-fecha">Emisión: {fmtDate(c?.fecha_emision)}</div>
                </div>
            </div>

            {/* Receptor */}
            <div className="cpe-section-title">Datos del cliente / receptor</div>
            <div className="cpe-info-grid">
                <span className="cpe-info-label">Razón Social:</span>
                <span className="cpe-info-value" style={{ fontWeight: 700 }}>{c?.receptor_razon_social || 'Cliente General'}</span>

                <span className="cpe-info-label">{docReceptorLabel}:</span>
                <span className="cpe-info-value">{c?.receptor_documento || '—'}</span>

                {c?.receptor_direccion && (
                    <>
                        <span className="cpe-info-label">Dirección:</span>
                        <span className="cpe-info-value">{c.receptor_direccion}</span>
                    </>
                )}

                {pedido?.paciente_nombre && (
                    <>
                        <span className="cpe-info-label">Paciente:</span>
                        <span className="cpe-info-value">{pedido.paciente_nombre}</span>
                    </>
                )}

                <span className="cpe-info-label">Forma de Pago:</span>
                <span className="cpe-info-value">
                    {c?.forma_pago || (saldoRestante > 0.01 ? 'CRÉDITO / PARCIAL' : 'AL CONTADO')}
                </span>

                <span className="cpe-info-label">Medio de Pago:</span>
                <span className="cpe-info-value">
                    {c?.medio_pago || 'EFECTIVO'} {c?.referencia ? `(Ref: ${c.referencia})` : ''}
                </span>

                {c?.responsable && (
                    <>
                        <span className="cpe-info-label">Cajero(a):</span>
                        <span className="cpe-info-value">{c.responsable}</span>
                    </>
                )}
            </div>

            {/* Ítems */}
            <div className="cpe-section-title">Detalle de trabajos y servicios odontológicos</div>
            <table className="cpe-items-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Descripción</th>
                        <th style={{ textAlign: 'center', width: '50px' }}>Cant.</th>
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

            {/* Totales y Leyenda SUNAT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '12px', gap: '16px' }}>
                {/* Bloque Leyenda SUNAT */}
                <div style={{ flex: 1 }}>
                    <div className="cpe-words-box">
                        <strong>SON: </strong>{numeroALetras(totalCobrado || c?.total_venta || 0)}
                    </div>

                    {/* QR Code y Hash criptográfico */}
                    <div className="cpe-qr-box">
                        {qrDataUrl && (
                            <img src={qrDataUrl} alt="Código QR SUNAT" className="cpe-qr-img" />
                        )}
                        <div className="cpe-qr-meta">
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>Supervisado por SUNAT</div>
                            <div style={{ fontSize: '7.5pt', color: '#64748b' }}>
                                Escanee el código QR para verificar la validez tributaria del comprobante.
                            </div>
                            {c?.hash_cpe && (
                                <div className="cpe-hash-value">Hash: {c.hash_cpe}</div>
                            )}
                            {c?.cdr_code && (
                                <div className="cpe-hash-value">CDR: {c.cdr_code}{c.cdr_description ? ` — ${c.cdr_description}` : ''}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cuadro de Totales */}
                <div className="cpe-totals-box">
                    {isFiscal ? (
                        <>
                            <div className="cpe-total-row">
                                <span className="cpe-total-label">Op. Gravadas</span>
                                <span>{fmt(c?.total_gravada)}</span>
                            </div>
                            <div className="cpe-total-row">
                                <span className="cpe-total-label">IGV (18%)</span>
                                <span>{fmt(c?.total_igv)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="cpe-total-row">
                            <span className="cpe-total-label">Subtotal</span>
                            <span>{fmt(c?.subtotal_original || c?.total_venta)}</span>
                        </div>
                    )}

                    {descuento > 0 && (
                        <div className="cpe-total-row" style={{ color: '#b91c1c' }}>
                            <span className="cpe-total-label">Descuento</span>
                            <span>-{fmt(descuento)}</span>
                        </div>
                    )}

                    <div className="cpe-total-row cpe-total-grand">
                        <span className="cpe-total-label">TOTAL</span>
                        <span>{fmt(c?.total_venta)}</span>
                    </div>

                    {c?.total_cobrado !== undefined && (
                        <div className="cpe-total-row" style={{ fontWeight: 700 }}>
                            <span className="cpe-total-label">Cobrado Hoy</span>
                            <span>{fmt(totalCobrado)}</span>
                        </div>
                    )}

                    {saldoRestante > 0.01 && (
                        <div className="cpe-total-row" style={{ color: '#d97706', fontWeight: 700 }}>
                            <span className="cpe-total-label">Saldo Pendiente</span>
                            <span>{fmt(saldoRestante)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="cpe-footer">
                {isFiscal
                    ? 'Representación impresa de la Boleta o Factura Electrónica — Consultable en www.sunat.gob.pe'
                    : 'Representación impresa del Comprobante de Cobro en Mostrador — AFINIX LAB'}
                <br />
                Garantía y Precisión Odontológica · Central: (01) 748-2910 · <strong>www.afinixlab.com</strong>
            </div>
        </div>
    );
};

export default ComprobantePrintSheet;
