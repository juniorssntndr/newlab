import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { fetchOrderDetail } from '../modules/orders/api/ordersApi.js';
import { useCreateInvoiceMutation } from '../modules/billing/mutations/useCreateInvoiceMutation.js';
import { consultarDNI, consultarRUC, guardarIdentidadLocal } from '../modules/identity/api/identityApi.js';
import BillingConfirmModal from '../components/billing/BillingConfirmModal.jsx';
import BillingResultModal from '../components/billing/BillingResultModal.jsx';
import CustomSelect from '../components/CustomSelect.jsx';

const TIPO_DOC_OPTIONS = [
    { value: '1', label: 'DNI (8 dígitos)' },
    { value: '6', label: 'RUC (11 dígitos)' },
    { value: '4', label: 'Carné Extranjería' },
    { value: '-', label: 'Sin Documento (Varios)' }
];

const FORMA_PAGO_OPTIONS = [
    { value: 'contado', label: 'CONTADO' },
    { value: 'credito', label: 'CRÉDITO (Pronto)', disabled: true }
];

export default function FacturarPedido() {
    const { id: paramId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { getHeaders } = useAuth();

    const pedidosQuery = searchParams.get('pedidos') || searchParams.get('orders');
    const orderIds = useMemo(() => {
        if (pedidosQuery) {
            return pedidosQuery.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (paramId) {
            return [paramId];
        }
        return [];
    }, [pedidosQuery, paramId]);

    const isMultiOrder = orderIds.length > 1;

    const ordersBatchQuery = useQuery({
        queryKey: ['billing-orders-batch', orderIds.join(',')],
        queryFn: async () => {
            if (orderIds.length === 0) return [];
            return Promise.all(
                orderIds.map(orderId => fetchOrderDetail({ orderId, headers: getHeaders() }))
            );
        },
        enabled: orderIds.length > 0
    });

    const pedidosList = ordersBatchQuery.data || [];
    const firstOrder = pedidosList[0] || null;
    const isLoading = ordersBatchQuery.isLoading;

    const createInvoiceMutation = useCreateInvoiceMutation();
    const hydratedBatchKeyRef = useRef(null);
    const idempotencyKeyRef = useRef(null);

    const [consultando, setConsultando] = useState(false);
    const [consultaDocumento, setConsultaDocumento] = useState(null);
    const [identityNotInReniec, setIdentityNotInReniec] = useState(false);

    // Modales de billing
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [resultModal, setResultModal] = useState({ open: false, status: 'aceptado', data: {} });

    // Form State
    const [tipoComprobante, setTipoComprobante] = useState('03'); // Boleta por defecto
    const [cliente, setCliente] = useState({
        tipoDoc: '1', // 1=DNI, 6=RUC
        numDoc: '',
        rznSocial: '',
        direccion: '',
        ubigeo: ''
    });

    const [productosFacturacion, setProductosFacturacion] = useState([]);

    // Totales (calculated in real time)
    const [totales, setTotales] = useState({
        gravada: 0,
        igv: 0,
        total: 0
    });

    useEffect(() => {
        hydratedBatchKeyRef.current = null;
    }, [orderIds.join(',')]);

    useEffect(() => {
        if (!pedidosList.length || hydratedBatchKeyRef.current === orderIds.join(',')) {
            return;
        }

        const primaryOrder = pedidosList[0];
        let defaultTipoDoc = '1';
        let defaultNum = primaryOrder.clinica_dni || primaryOrder.dni || '';
        let defaultTipoComprobante = '03';

        if (primaryOrder.clinica_ruc && primaryOrder.clinica_ruc.length === 11) {
            defaultTipoDoc = '6';
            defaultNum = primaryOrder.clinica_ruc;
            defaultTipoComprobante = '01';
        } else if (primaryOrder.ruc && primaryOrder.ruc.length === 11) {
            defaultTipoDoc = '6';
            defaultNum = primaryOrder.ruc;
            defaultTipoComprobante = '01';
        }

        setTipoComprobante(defaultTipoComprobante);
        setCliente({
            tipoDoc: defaultTipoDoc,
            numDoc: defaultNum,
            rznSocial: primaryOrder.clinica_razon_social || primaryOrder.clinica_nombre || primaryOrder.razon_social || primaryOrder.paciente_nombre || '',
            direccion: primaryOrder.clinica_direccion || primaryOrder.direccion || 'Lima, Peru',
            ubigeo: primaryOrder.ubigeo || '150101'
        });

        const initialFacturacionItems = pedidosList.flatMap((ped) => {
            const items = (ped.items && ped.items.length > 0)
                ? ped.items
                : [{
                    id: ped.id,
                    producto_id: ped.producto_id || 'SRV',
                    producto_nombre: ped.producto_nombre || 'Servicio Odontológico',
                    cantidad: parseFloat(ped.cantidad) || 1,
                    precio_unitario: parseFloat(ped.precio_unitario || ped.total) || 0
                }];

            return items.map((item) => {
                const cantidad = parseFloat(item.cantidad) || 1;
                const mtoPrecioUnitario = parseFloat(item.precio_unitario) || 0;
                const mtoValorUnitario = mtoPrecioUnitario / 1.18;
                const mtoValorVenta = mtoValorUnitario * cantidad;
                const igvItem = (mtoPrecioUnitario * cantidad) - mtoValorVenta;
                const descripcionProducto = item.producto_nombre || item.producto || item.nombre || ped.producto_nombre || item.material || 'Servicio Odontológico';

                return {
                    id_local: `${ped.id}-${item.id}`,
                    pedido_id: ped.id,
                    pedido_codigo: ped.codigo,
                    paciente_nombre: ped.paciente_nombre,
                    codProducto: item.producto_id ? item.producto_id.toString() : 'SRV',
                    descripcion: descripcionProducto,
                    unidad: 'ZZ',
                    tipoIgv: '10',
                    cantidad,
                    mtoValorUnitario,
                    mtoValorVenta,
                    mtoBaseIgv: mtoValorVenta,
                    igv: igvItem,
                    mtoPrecioUnitario,
                    importe: mtoPrecioUnitario * cantidad
                };
            });
        });

        setProductosFacturacion(initialFacturacionItems);
        recalcularTotales(initialFacturacionItems);
        hydratedBatchKeyRef.current = orderIds.join(',');
    }, [pedidosList, orderIds]);

    const recalcularTotales = (listaProductos) => {
        let gravada = 0;
        let igv = 0;
        let total = 0;

        listaProductos.forEach(p => {
            gravada += p.mtoValorVenta;
            igv += p.igv;
            total += p.importe;
        });

        setTotales({
            gravada: parseFloat(gravada.toFixed(2)),
            igv: parseFloat(igv.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        });
    };

    // Al cambiar la cantidad o precio de un item de la fila
    const handleItemChange = (index, field, value) => {
        const nuevosItems = [...productosFacturacion];
        const item = nuevosItems[index];

        if (field === 'cantidad') {
            item.cantidad = parseFloat(value) || 0;
        } else if (field === 'mtoPrecioUnitario') {
            item.mtoPrecioUnitario = parseFloat(value) || 0; // Precio con IGV editado
        } else if (field === 'descripcion') {
            item.descripcion = value;
        }

        // Recalcular montos de la fila
        item.mtoValorUnitario = item.mtoPrecioUnitario / 1.18;
        item.mtoValorVenta = item.mtoValorUnitario * item.cantidad;
        item.mtoBaseIgv = item.mtoValorVenta;
        item.importe = item.mtoPrecioUnitario * item.cantidad;
        item.igv = item.importe - item.mtoValorVenta;

        nuevosItems[index] = item;
        setProductosFacturacion(nuevosItems);
        recalcularTotales(nuevosItems);
    };

    // Al cambiar tipo de comprobante
    const handleTipoComprobanteChange = (e) => {
        const value = e.target.value;
        setTipoComprobante(value);
        if (value === '01') {
            setCliente(prev => ({ ...prev, tipoDoc: '6', numDoc: '', rznSocial: '' })); // Factura exige RUC
        } else {
            setCliente(prev => ({ ...prev, tipoDoc: '1', numDoc: '', rznSocial: '' })); // Boleta prefiere DNI
        }
        setConsultaDocumento(null);
        setIdentityNotInReniec(false);
    };

    const handleConsultaDocumento = async () => {
        const num = cliente.numDoc.trim().replace(/\D/g, '');
        if (!num) return;

        const isDni = num.length === 8;
        const isRuc = num.length === 11;
        if (!isDni && !isRuc) {
            toast.error('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');
            return;
        }

        try {
            setConsultando(true);
            const data = isDni
                ? await consultarDNI({ dni: num, headers: getHeaders() })
                : await consultarRUC({ ruc: num, headers: getHeaders() });

            const nombreCompleto = isDni
                ? ([data.nombres, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim() || data.fullName || '')
                : (data.razonSocial || data.razon_social || '');

            const ubigeoObtenido = Array.isArray(data.ubigeo) ? data.ubigeo[0] : (data.ubigeo || cliente.ubigeo);
            const fromLocal = data.source === 'local' || data.notInReniec === true;

            setIdentityNotInReniec(fromLocal);
            setConsultaDocumento({
                numero: num,
                tipo: isDni ? 'dni' : 'ruc',
                estado: data.estado || null,
                condicion: data.condicion || null,
                source: data.source || null,
            });

            if (!nombreCompleto) {
                toast.error('No se pudo extraer el nombre del documento consultado.');
                return;
            }

            if (isRuc && data.isActiveHabido === false) {
                toast.error(
                    `RUC ${data.estado || '?'} / ${data.condicion || '?'} — no apto para factura hasta regularizar.`,
                    { duration: 7000 }
                );
            }

            setCliente(prev => ({
                ...prev,
                tipoDoc: isRuc ? '6' : '1',
                rznSocial: nombreCompleto,
                direccion: data.direccion || prev.direccion,
                ubigeo: ubigeoObtenido || prev.ubigeo
            }));
            toast.success(
                fromLocal
                    ? 'Datos cargados del registro local (no constan en RENIEC/SUNAT).'
                    : 'Datos obtenidos exitosamente.'
            );
        } catch (err) {
            console.error(err);
            if (err.status === 401 || err.code === 'TOKEN_MISSING') {
                toast.error('Token de consultas APISPERU inválido o ausente. Revisa EXTERNAL_API_TOKEN.', { duration: 6000 });
            } else if (err.code === 'DOCUMENT_NOT_FOUND' || err.status === 404) {
                setIdentityNotInReniec(true);
                setConsultaDocumento(null);
                toast.error(
                    err.message || 'Datos no encontrados en RENIEC. Completa el nombre manualmente y se guardará al emitir.',
                    { duration: 7000 }
                );
            } else {
                toast.error(err.message || 'Error de conexión.');
            }
        } finally {
            setConsultando(false);
        }
    };

    const persistIdentidadLocalSiAplica = async () => {
        if (!identityNotInReniec) return;
        const numDoc = cliente.numDoc.replace(/\D/g, '');
        const rznSocial = cliente.rznSocial.trim();
        if (!numDoc || !rznSocial) return;
        try {
            await guardarIdentidadLocal({
                headers: getHeaders(),
                payload: {
                    tipoDoc: cliente.tipoDoc || (numDoc.length === 11 ? '6' : '1'),
                    numDoc,
                    rznSocial,
                    direccion: cliente.direccion || null,
                    ubigeo: cliente.ubigeo || null,
                    notInReniec: true,
                    source: 'manual',
                },
            });
        } catch (err) {
            console.warn('No se pudo guardar identidad local:', err.message);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        const documento = cliente.numDoc.replace(/\D/g, '');

        // Validación básica
        if (tipoComprobante === '01' && documento.length !== 11) {
            toast.error('La Factura exige un número de RUC válido de 11 dígitos.');
            return;
        }
        if (!cliente.rznSocial.trim()) {
            toast.error('Ingresa o consulta el nombre o razón social del receptor.');
            return;
        }
        const esReceptorRuc = cliente.tipoDoc === '6' || documento.length === 11;
        if (esReceptorRuc && (!cliente.direccion.trim() || !/^\d{6}$/.test(cliente.ubigeo.trim()))) {
            toast.error('Para RUC, la dirección y un ubigeo válido de 6 dígitos son obligatorios.');
            return;
        }
        if (productosFacturacion.length === 0) {
            toast.error('Debe haber al menos un producto a facturar.');
            return;
        }
        if (productosFacturacion.some((item) => !item.descripcion.trim() || item.cantidad <= 0 || item.mtoPrecioUnitario <= 0)) {
            toast.error('Todos los productos deben tener descripción, cantidad y precio mayores a cero.');
            return;
        }

        const rucNoApto = consultaDocumento?.tipo === 'ruc' && consultaDocumento.numero === documento && (
            (consultaDocumento.estado && !String(consultaDocumento.estado).toUpperCase().includes('ACTIVO'))
            || (consultaDocumento.condicion && !String(consultaDocumento.condicion).toUpperCase().includes('HABIDO'))
        );
        if (rucNoApto) {
            toast.error(`El RUC figura ${consultaDocumento.estado || ''} / ${consultaDocumento.condicion || ''}. Verifica antes de emitir.`);
            return;
        }

        await persistIdentidadLocalSiAplica();
        // Abrir modal de confirmación (reemplaza window.confirm)
        setConfirmModalOpen(true);
    };

    const handleConfirmEmit = async () => {
        const documento = cliente.numDoc.replace(/\D/g, '');
        const esReceptorRuc = cliente.tipoDoc === '6' || documento.length === 11;
        const primaryOrderId = orderIds[0];
        try {
            idempotencyKeyRef.current ||= crypto.randomUUID();
            const payload = {
                tipoComprobante,
                orderIds: orderIds.map(Number),
                idempotencyKey: idempotencyKeyRef.current,
                billingData: {
                    client: {
                        tipoDoc: cliente.tipoDoc,
                        numDoc: documento,
                        rznSocial: cliente.rznSocial,
                        notInReniec: identityNotInReniec,
                        ...(esReceptorRuc ? {
                            direccion: cliente.direccion,
                            ubigeo: cliente.ubigeo,
                            address: {
                                direccion: cliente.direccion,
                                ubigeo: cliente.ubigeo,
                                provincia: 'LIMA', departamento: 'LIMA', distrito: 'LIMA'
                            }
                        } : {})
                    },
                    details: productosFacturacion,
                    mtoOperGravadas: totales.gravada,
                    mtoIGV: totales.igv,
                    mtoImpVenta: totales.total
                }
            };

            const result = await createInvoiceMutation.mutateAsync({ orderId: primaryOrderId, payload });

            setConfirmModalOpen(false);
            idempotencyKeyRef.current = null;
            toast.success('Comprobante emitido.');
            setResultModal({
                open: true,
                status: 'aceptado',
                data: {
                    serie: result?.serie,
                    correlativo: result?.correlativo,
                    cdrCode: result?.cdr_code,
                    cdrDescription: result?.cdr_description,
                    hash: result?.hash_cpe || result?.hash,
                    pdfUrl: result?.pdf_url,
                    xmlUrl: result?.xml_url,
                    cdrUrl: result?.cdr_url,
                    requestId: result?.requestId || null,
                    comprobanteId: result?.id || null,
                    isDemoAsset: !!(result?.pdf_url && (result.pdf_url.includes('/demo/') || result.pdf_url.includes('demo.apisperu'))),
                },
            });
        } catch (err) {
            console.error(err);
            setConfirmModalOpen(false);
            const is422 = err.status === 422;
            const isNetworkOrServer = !err.status || err.status >= 500;
            const status = is422 ? 'rechazado' : isNetworkOrServer ? 'no_confirmado' : 'rechazado';
            // Conservar la clave de idempotencia para reintentos en caso de error de red
            if (!isNetworkOrServer) idempotencyKeyRef.current = null;
            setResultModal({
                open: true,
                status,
                data: {
                    cdrCode: err.payload?.cdr_code || err.payload?.code,
                    cdrDescription: err.payload?.cdr_description || err.payload?.details,
                    message: err.message || 'Error al emitir comprobante',
                    requestId: err.payload?.requestId || err.payload?.request_id,
                },
            });
        }
    };

    const handleRetryEmit = () => {
        setResultModal({ open: false, status: 'aceptado', data: {} });
        // La clave de idempotencia se conserva para reintentar
        handleConfirmEmit();
    };

    const handleResultClose = () => {
        const wasAcepted = resultModal.status === 'aceptado';
        setResultModal({ open: false, status: 'aceptado', data: {} });
        if (wasAcepted) {
            if (isMultiOrder) {
                navigate('/caja-gastos?tab=facturacion');
            } else {
                navigate(`/finanzas/${orderIds[0]}`);
            }
        }
    };

    if (orderIds.length === 0) {
        return (
            <div className="facturacion-page animate-fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>No se especificaron pedidos para facturar.</p>
                <button type="button" className="btn btn-secondary" onClick={() => navigate('/caja-gastos?tab=facturacion')}>
                    Volver a Facturación
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="facturacion-page animate-fade-in" style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto 1rem', borderWidth: '3px' }}></div>
                <p style={{ fontWeight: 600 }}>Cargando información para facturación...</p>
            </div>
        );
    }

    if (!pedidosList.length) {
        return (
            <div className="facturacion-page animate-fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Pedido(s) no encontrado(s).</p>
                <button type="button" className="btn btn-secondary" onClick={() => navigate('/caja-gastos?tab=facturacion')}>
                    Volver a Facturación
                </button>
            </div>
        );
    }

    return (
        <div className="facturacion-page animate-fade-in">
            <BillingConfirmModal
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={handleConfirmEmit}
                tipoComprobante={tipoComprobante}
                receptorName={cliente.rznSocial}
                receptorDoc={cliente.numDoc.replace(/\D/g, '')}
                entorno="beta APISPERU"
                base={totales.gravada}
                igv={totales.igv}
                total={totales.total}
                confirming={createInvoiceMutation.isPending}
            />
            <BillingResultModal
                open={resultModal.open}
                onClose={handleResultClose}
                onRetry={resultModal.status === 'no_confirmado' ? handleRetryEmit : undefined}
                status={resultModal.status}
                {...resultModal.data}
            />

            {/* Page Header */}
            <div className="facturacion-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/caja-gastos?tab=facturacion')}
                        className="btn btn-secondary btn-icon"
                        title="Volver a Facturación"
                        aria-label="Volver a Facturación"
                        style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                    >
                        <i className="bi bi-arrow-left" style={{ fontSize: '1.2rem' }}></i>
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                                Emitir Comprobante
                            </h1>
                            {isMultiOrder ? (
                                <span className="badge badge-secondary" style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="bi bi-collection" style={{ color: 'var(--color-primary)' }}></i>
                                    Factura Consolidada &bull; {orderIds.length} pedidos
                                </span>
                            ) : (
                                firstOrder && (
                                    <span className="badge badge-secondary" style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <i className="bi bi-receipt" style={{ color: 'var(--color-primary)' }}></i>
                                        Orden #{firstOrder.codigo}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Single-Sheet Document Module */}
            <div className="facturacion-sheet">
                {/* Sheet Top Bar: Document Type Segmented Control */}
                <div className="facturacion-sheet-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className="segmented-control" role="group" aria-label="Tipo de comprobante" style={{ minWidth: '320px', display: 'flex' }}>
                            <button
                                type="button"
                                className={`segmented-control__btn${tipoComprobante === '03' ? ' is-active' : ''}`}
                                onClick={() => handleTipoComprobanteChange({ target: { value: '03' } })}
                                style={{ flex: 1, justifyContent: 'center', padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.84rem' }}
                            >
                                <i className="bi bi-receipt" style={{ marginRight: '6px' }}></i>
                                <span>Boleta (B001)</span>
                            </button>
                            <button
                                type="button"
                                className={`segmented-control__btn${tipoComprobante === '01' ? ' is-active' : ''}`}
                                onClick={() => handleTipoComprobanteChange({ target: { value: '01' } })}
                                style={{ flex: 1, justifyContent: 'center', padding: '0.55rem 0.9rem', fontWeight: 700, fontSize: '0.84rem' }}
                            >
                                <i className="bi bi-building" style={{ marginRight: '6px' }}></i>
                                <span>Factura (F001)</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        <i className="bi bi-shield-check" style={{ color: 'var(--color-primary)' }}></i>
                        <span>AFINIX DENTAL LAB S.A.C. &bull; RUC 20616033973</span>
                    </div>
                </div>

                {/* Sheet Body */}
                <div className="facturacion-sheet-body">
                    {/* Section 1: Datos del Adquirente */}
                    <div>
                        <div className="facturacion-section-header">
                            <div className="facturacion-section-title">
                                <div className="facturacion-section-icon">
                                    <i className="bi bi-person-badge"></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        Datos del Cliente / Adquirente
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                                        Identificación tributaria registrada para emisión electrónica
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3-column inline grid */}
                        <div className="facturacion-client-grid">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                                    Tipo Doc. Ident. <span style={{ color: 'var(--color-danger)' }}>*</span>
                                </label>
                                <CustomSelect
                                    value={cliente.tipoDoc}
                                    onChange={(e, val) => setCliente({ ...cliente, tipoDoc: val })}
                                    options={TIPO_DOC_OPTIONS}
                                    aria-label="Tipo de documento de identidad"
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                                    N° de Documento <span style={{ color: 'var(--color-danger)' }}>*</span>
                                </label>
                                <div style={{ display: 'flex', gap: '0.45rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{
                                            borderColor: (tipoComprobante === '01' && cliente.numDoc.length > 0 && cliente.numDoc.length !== 11) ? 'var(--color-danger)' : '',
                                            flex: 1,
                                            minWidth: 0,
                                            fontWeight: 600
                                        }}
                                        placeholder={tipoComprobante === '01' ? "RUC de 11 dígitos..." : "Número de documento..."}
                                        value={cliente.numDoc}
                                        onChange={e => {
                                            setCliente({ ...cliente, numDoc: e.target.value.replace(/\D/g, '') });
                                            setConsultaDocumento(null);
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleConsultaDocumento();
                                            }
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleConsultaDocumento}
                                        disabled={consultando}
                                        style={{ padding: '0 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                                        title="Consultar en RENIEC/SUNAT"
                                    >
                                        {consultando ? (
                                            <div className="spinner" style={{ width: '0.9rem', height: '0.9rem', borderWidth: '2px' }}></div>
                                        ) : (
                                            <>
                                                <i className="bi bi-search"></i>
                                                <span style={{ fontSize: '0.8rem' }}>Buscar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                {tipoComprobante === '01' && cliente.numDoc.length > 0 && cliente.numDoc.length !== 11 && (
                                    <span style={{ color: 'var(--color-danger)', fontSize: '0.76rem', marginTop: '4px', display: 'block' }}>
                                        La factura requiere un RUC de 11 dígitos.
                                    </span>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                                    Razón Social / Nombres y Apellidos <span style={{ color: 'var(--color-danger)' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Nombre completo o razón social..."
                                    value={cliente.rznSocial}
                                    onChange={e => setCliente({ ...cliente, rznSocial: e.target.value })}
                                    onBlur={() => { void persistIdentidadLocalSiAplica(); }}
                                    required
                                />
                                {identityNotInReniec && (
                                    <small style={{ color: 'var(--color-text-tertiary)', display: 'block', marginTop: 4 }}>
                                        No consta en RENIEC/SUNAT. Se guardará en el registro local.
                                    </small>
                                )}
                            </div>
                        </div>

                        {/* Optional Subgrid for RUC address */}
                        {(cliente.tipoDoc === '6' || String(cliente.numDoc || '').replace(/\D/g, '').length === 11) && (
                            <div className="facturacion-client-subgrid">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                                        Dirección Fiscal del Receptor <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <i className="bi bi-geo-alt" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}></i>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ paddingLeft: '2.4rem' }}
                                            placeholder="Dirección fiscal..."
                                            value={cliente.direccion}
                                            onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>
                                        Ubigeo <span style={{ color: 'var(--color-danger)' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: 040126"
                                        value={cliente.ubigeo}
                                        onChange={e => setCliente({ ...cliente, ubigeo: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Detalle de Ítems Tributarios (Full-Width Accounting Table) */}
                    <div>
                        <div className="facturacion-section-header">
                            <div className="facturacion-section-title">
                                <div className="facturacion-section-icon">
                                    <i className="bi bi-box-seam"></i>
                                </div>
                                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    Detalle del Pedido
                                </h3>
                            </div>
                            <span className="badge badge-secondary" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                {productosFacturacion.length} ítem{productosFacturacion.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="facturacion-table-wrapper">
                            <table className="facturacion-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                        <th>Descripción del Ítem / Servicio</th>
                                        <th style={{ width: '65px', textAlign: 'center' }}>Und.</th>
                                        <th style={{ width: '75px', textAlign: 'center' }}>Cant.</th>
                                        <th style={{ width: '115px', textAlign: 'right' }}>P. Unit. (c/ IGV)</th>
                                        <th style={{ width: '105px', textAlign: 'right' }}>Subtotal (Base)</th>
                                        <th style={{ width: '90px', textAlign: 'right' }}>IGV (18%)</th>
                                        <th style={{ width: '120px', textAlign: 'right' }}>Importe Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFacturacion.map((item, index) => (
                                        <tr key={index}>
                                            <td style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontWeight: 600, fontSize: '0.82rem' }}>
                                                {index + 1}
                                            </td>
                                            <td>
                                                <input
                                                    className="form-input form-input-sm"
                                                    style={{ width: '100%', fontSize: '0.84rem', fontWeight: 550, marginBottom: '3px' }}
                                                    value={item.descripcion}
                                                    onChange={e => handleItemChange(index, 'descripcion', e.target.value)}
                                                />
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {item.pedido_codigo && (
                                                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '1px 6px', fontWeight: 650, color: 'var(--color-primary)' }}>
                                                            Orden #{item.pedido_codigo}
                                                        </span>
                                                    )}
                                                    {item.paciente_nombre && (
                                                        <span>Paciente: <strong>{item.paciente_nombre}</strong></span>
                                                    )}
                                                    {(item.pedido_codigo || item.paciente_nombre) && <span>&bull;</span>}
                                                    <span>Código: {item.codProducto || 'SRV'}</span>
                                                    <span>&bull;</span>
                                                    <span>Tipo IGV: Gravado (10)</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ display: 'inline-block', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.2rem 0.45rem', fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                                    {item.unidad}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="number" min="0.1" step="any"
                                                    className="form-input form-input-sm"
                                                    style={{ padding: '0.35rem 0.2rem', width: '54px', textAlign: 'center', fontSize: '0.85rem', margin: '0 auto' }}
                                                    value={item.cantidad}
                                                    onChange={e => handleItemChange(index, 'cantidad', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>S/.</span>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        className="form-input form-input-sm"
                                                        style={{ padding: '0.35rem 0.4rem', width: '80px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}
                                                        value={item.mtoPrecioUnitario}
                                                        onChange={e => handleItemChange(index, 'mtoPrecioUnitario', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.86rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                S/.&nbsp;{item.mtoValorVenta.toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.86rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                S/.&nbsp;{item.igv.toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                                S/.&nbsp;{item.importe.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: Bottom 2-Column Grid (Commercial conditions & Totals) */}
                    <div className="facturacion-footer-grid">
                        {/* Left Column: Commercial Conditions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="facturacion-section-header" style={{ marginBottom: '0.5rem' }}>
                                <div className="facturacion-section-title">
                                    <div className="facturacion-section-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
                                        <i className="bi bi-wallet2"></i>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                            Condiciones y Observaciones
                                        </h3>
                                    </div>
                                </div>
                            </div>

                            <div className="facturacion-conditions-grid">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>Forma de Pago</label>
                                    <CustomSelect
                                        value="contado"
                                        options={FORMA_PAGO_OPTIONS}
                                        aria-label="Forma de pago"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontWeight: 650, fontSize: '0.82rem' }}>Observación en Comprobante</label>
                                    <input type="text" className="form-input" placeholder="Comentario opcional impreso..." />
                                </div>
                            </div>

                            {/* Legal Security Callout */}
                            <div style={{ background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.15)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '10px', alignItems: 'center', marginTop: '0.5rem' }}>
                                <i className="bi bi-shield-check" style={{ color: 'var(--color-primary)', fontSize: '1.25rem', flexShrink: 0 }}></i>
                                <div style={{ lineHeight: '1.4' }}>
                                    Emisor Oficial: <strong>AFINIX DENTAL LAB S.A.C.</strong> &bull; RUC 20616033973. Envío electrónico validado en línea ante SUNAT.
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Accounting Totals Box */}
                        <div className="facturacion-totals-box">
                            <div className="facturacion-total-row">
                                <span>Operaciones Gravadas</span>
                                <strong>S/.&nbsp;{totales.gravada.toFixed(2)}</strong>
                            </div>
                            <div className="facturacion-total-row">
                                <span>Descuentos Totales</span>
                                <strong>S/.&nbsp;0.00</strong>
                            </div>
                            <div className="facturacion-total-row">
                                <span>IGV (18%)</span>
                                <strong>S/.&nbsp;{totales.igv.toFixed(2)}</strong>
                            </div>
                            <div className="facturacion-total-highlight">
                                <div>
                                    <div className="facturacion-total-highlight-label">Importe Total</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>Incluye IGV 18%</div>
                                </div>
                                <div className="facturacion-total-highlight-val">
                                    S/.&nbsp;{totales.total.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="facturacion-action-bar">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate('/caja-gastos?tab=facturacion')}
                        disabled={createInvoiceMutation.isPending}
                        style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                        <i className="bi bi-x-circle" style={{ marginRight: '6px' }}></i>
                        Cancelar y Volver
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 700, display: 'inline-flex', gap: '0.6rem', alignItems: 'center' }}
                        disabled={createInvoiceMutation.isPending}
                    >
                        {createInvoiceMutation.isPending ? (
                            <>
                                <div className="spinner" style={{ width: '1.1rem', height: '1.1rem', borderWidth: '2px' }}></div>
                                <span>Procesando en SUNAT...</span>
                            </>
                        ) : (
                            <>
                                <i className="bi bi-send-check-fill"></i>
                                <span>Emitir {tipoComprobante === '01' ? 'Factura Electrónica (F001)' : 'Boleta de Venta (B001)'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
