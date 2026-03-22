import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_URL } from '../config.js';
import { useAuth } from '../state/AuthContext.jsx';

export default function FacturarPedido() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { getHeaders } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [consultando, setConsultando] = useState(false);
    const [pedido, setPedido] = useState(null);
    const [items, setItems] = useState([]);

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
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/pedidos/${id}`, {
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Error al cargar datos');
            const data = await res.json();
            setPedido(data);
            setItems(data.items);

            // Pre-fill Cliente data based on Pedido
            // Default to Clinic's fiscal data, fallback to patient data
            let defaultTipoDoc = '1';
            let defaultNum = data.clinica_dni || data.dni || '';
            let isFactura = false;

            if (data.clinica_ruc && data.clinica_ruc.length === 11) {
                defaultTipoDoc = '6';
                defaultNum = data.clinica_ruc;
                isFactura = true;
                setTipoComprobante('01');
            } else if (data.ruc && data.ruc.length === 11) {
                defaultTipoDoc = '6';
                defaultNum = data.ruc;
                isFactura = true;
                setTipoComprobante('01');
            }

            setCliente({
                tipoDoc: defaultTipoDoc,
                numDoc: defaultNum,
                rznSocial: data.clinica_razon_social || data.clinica_nombre || data.razon_social || data.paciente_nombre || '',
                direccion: data.clinica_direccion || data.direccion || 'Lima, Peru',
                ubigeo: data.ubigeo || '150101' // Default Lima
            });

            // Map original items to Facturación structure
            const initialFacturacionItems = data.items.map(item => {
                // Determine prices since the original price *includes* IGV
                const cantidad = parseFloat(item.cantidad) || 1;
                const mtoPrecioUnitario = parseFloat(item.precio_unitario) || 0; // Con IGV

                // MtoValorUnitario is without IGV
                const mtoValorUnitario = mtoPrecioUnitario / 1.18;
                const mtoValorVenta = mtoValorUnitario * cantidad; // Subtotal sin IGV
                const igvItem = (mtoPrecioUnitario * cantidad) - mtoValorVenta;

                return {
                    id_local: item.id,
                    codProducto: item.producto_id ? item.producto_id.toString() : 'SRV',
                    descripcion: `${item.cantidad}x ${item.material || 'Servicio Dent.'}`,
                    unidad: 'ZZ', // Servicio
                    tipoIgv: '10', // Gravado
                    cantidad: cantidad,
                    mtoValorUnitario: mtoValorUnitario,
                    mtoValorVenta: mtoValorVenta, // Subtotal sin IGV por producto
                    mtoBaseIgv: mtoValorVenta,
                    igv: igvItem,
                    mtoPrecioUnitario: mtoPrecioUnitario,
                    importe: mtoPrecioUnitario * cantidad
                };
            });

            setProductosFacturacion(initialFacturacionItems);
            recalcularTotales(initialFacturacionItems);

        } catch (err) {
            console.error('Error fetching data:', err);
            toast.error('Error al cargar datos del pedido');
        } finally {
            setLoading(false);
        }
    };

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
            setCliente(prev => ({ ...prev, tipoDoc: '6' })); // Factura exige RUC
        } else {
            setCliente(prev => ({ ...prev, tipoDoc: '1' })); // Boleta prefiere DNI
        }
    };

    const handleConsultaDocumento = async () => {
        const num = cliente.numDoc.trim();
        if (!num) return;

        // Determinar endpoint según longitud
        let endpoint = '';
        if (num.length === 8) endpoint = 'dni';
        else if (num.length === 11) endpoint = 'ruc';
        else {
            toast.error('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');
            return;
        }

        try {
            setConsultando(true);
            const res = await fetch(`${API_URL}/consultas/${endpoint}/${num}`, {
                headers: getHeaders()
            });
            const data = await res.json();

            if (!res.ok) {
                // Safely convert details to string to avoid "is not a function" error
                const detailsStr = data.details
                    ? (typeof data.details === 'string' ? data.details : JSON.stringify(data.details))
                    : '';
                if (res.status === 404 || res.status === 422) {
                    toast.error(data.error || 'Documento no encontrado en RENIEC/SUNAT.');
                } else if (res.status === 401) {
                    toast.error('Token de APISPERU inválido. Revisa la configuración del backend.', { duration: 6000 });
                } else {
                    toast.error(data.error || detailsStr || 'Error al consultar documento');
                }
                return;
            }

            // APISPERU puede devolver HTTP 200 con { success: false } en algunos casos
            if (data.success === false) {
                toast.error(data.message || 'Documento no encontrado en RENIEC/SUNAT.');
                return;
            }

            // Mapeo seguro según respuesta (DNI usa nombres/apellidoX; RUC usa razonSocial)
            let nombreCompleto = '';
            let direccionObtenida = cliente.direccion;
            let ubigeoObtenido = cliente.ubigeo;

            if (endpoint === 'dni') {
                nombreCompleto = [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
                    .filter(Boolean)
                    .join(' ')
                    .trim();
            } else if (endpoint === 'ruc') {
                nombreCompleto = data.razonSocial || data.nombre || '';
                direccionObtenida = data.direccion || direccionObtenida;

                // Extraer ubigeo si viene en el formato de API
                if (data.ubigeo) ubigeoObtenido = data.ubigeo;
            }

            if (nombreCompleto) {
                setCliente(prev => ({
                    ...prev,
                    rznSocial: nombreCompleto,
                    direccion: direccionObtenida,
                    ubigeo: ubigeoObtenido
                }));
                toast.success('Datos obtenidos exitosamente.');
            } else {
                toast.error('No se pudo extraer el nombre del documento consultado.');
            }

        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Error de conexión.');
        } finally {
            setConsultando(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación básica
        if (tipoComprobante === '01' && cliente.numDoc.length !== 11) {
            toast.error('La Factura exige un número de RUC válido de 11 dígitos.');
            return;
        }
        if (productosFacturacion.length === 0) {
            toast.error('Debe haber al menos un producto a facturar.');
            return;
        }

        try {
            setSubmitting(true);
            const token = localStorage.getItem('token');
            const payload = {
                tipoComprobante,
                billingData: {
                    client: {
                        tipoDoc: cliente.tipoDoc,
                        numDoc: cliente.numDoc,
                        rznSocial: cliente.rznSocial,
                        address: {
                            direccion: cliente.direccion,
                            ubigeo: cliente.ubigeo,
                            provincia: 'LIMA', departamento: 'LIMA', distrito: 'LIMA'
                        }
                    },
                    details: productosFacturacion,
                    mtoOperGravadas: totales.gravada,
                    mtoIGV: totales.igv,
                    mtoImpVenta: totales.total
                }
            };

            const res = await fetch(`${API_URL}/facturacion/${id}/emitir`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al emitir comprobante');
            }

            toast.success('Comprobante emitido correctamente en SUNAT.');
            navigate(`/finanzas/${id}`);
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Error al emitir comprobante');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Cargando pantalla de facturación...</div>;
    if (!pedido) return <div>Pedido no encontrado.</div>;

    return (
        <div className="facturacion-layout animate-fade-in">

            {/* Left Column: Form Content */}
            <div className="facturacion-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => navigate(`/finanzas/${id}`)}
                        className="btn btn-ghost btn-icon"
                        title="Volver"
                    >
                        <i className="bi bi-arrow-left" style={{ fontSize: '1.25rem' }}></i>
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Emitir Comprobante</h1>
                </div>

                {/* Panel: Documento y Cliente */}
                <div className="card" style={{ padding: '2rem', borderTop: tipoComprobante === '01' ? '4px solid var(--color-primary)' : '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="bi bi-person-lines-fill" style={{ color: 'var(--color-primary)' }}></i>
                            Datos del Receptor
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Comprobante:</label>
                            <select className="form-select"
                                style={{ fontWeight: 'bold', width: 'auto', padding: '0.4rem 2rem 0.4rem 1rem', background: 'var(--color-bg-alt)' }}
                                value={tipoComprobante}
                                onChange={handleTipoComprobanteChange}
                            >
                                <option value="03">Boleta Electrónica</option>
                                <option value="01">Factura Electrónica</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Tipo Doc. Ident. <span style={{ color: 'red' }}>*</span></label>
                            <select className="form-select"
                                value={cliente.tipoDoc}
                                onChange={e => setCliente({ ...cliente, tipoDoc: e.target.value })}
                            >
                                <option value="1">DNI</option>
                                <option value="6">RUC</option>
                                <option value="4">Carné Extranjería</option>
                                <option value="-">Varios (Sin Doc)</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>N° de Documento <span style={{ color: 'red' }}>*</span></label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{
                                        borderColor: (tipoComprobante === '01' && cliente.numDoc.length > 0 && cliente.numDoc.length !== 11) ? '#ef4444' : '',
                                        flex: 1
                                    }}
                                    placeholder={tipoComprobante === '01' ? "RUC de 11 dígitos..." : "Número..."}
                                    value={cliente.numDoc}
                                    onChange={e => setCliente({ ...cliente, numDoc: e.target.value })}
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
                                    style={{ padding: '0.5rem 1rem' }}
                                    title="Consultar en RENIEC/SUNAT"
                                >
                                    {consultando ? (
                                        <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></div>
                                    ) : (
                                        <i className="bi bi-search"></i>
                                    )}
                                </button>
                            </div>
                            {tipoComprobante === '01' && cliente.numDoc.length > 0 && cliente.numDoc.length !== 11 && (
                                <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                    La factura requiere un RUC de 11 dígitos.
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>Razón Social / Nombres y Apellidos <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Nombre del cliente o Razón Social..."
                            value={cliente.rznSocial}
                            onChange={e => setCliente({ ...cliente, rznSocial: e.target.value })}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Dirección del Receptor</label>
                            <div style={{ position: 'relative' }}>
                                <i className="bi bi-geo-alt" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }}></i>
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="Dirección fiscal..."
                                    value={cliente.direccion}
                                    onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Ubigeo</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 150101"
                                value={cliente.ubigeo}
                                onChange={e => setCliente({ ...cliente, ubigeo: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Panel: Productos */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg-alt) 100%)' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'rgba(var(--color-primary-rgb, 20,184,166), 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="bi bi-box-seam" style={{ color: 'var(--color-primary)', fontSize: '1rem' }}></i>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Productos Tributarios</h3>
                        <span style={{ marginLeft: 'auto', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
                            {productosFacturacion.length} item{productosFacturacion.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '760px' }}>
                            <colgroup>
                                <col style={{ width: 'auto' }} />
                                <col style={{ width: '62px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '80px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '110px' }} />
                                <col style={{ width: '115px' }} />
                            </colgroup>
                            <thead>
                                <tr style={{ background: 'var(--color-bg-alt)', borderBottom: '2px solid var(--color-border)' }}>
                                    <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Descripción</th>
                                    <th style={{ padding: '0.875rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Und.</th>
                                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>V.U s/ IGV</th>
                                    <th style={{ padding: '0.875rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>Cant.</th>
                                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>P.U c/ IGV</th>
                                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>IGV Fila</th>
                                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productosFacturacion.map((item, index) => (
                                    <tr key={index} style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                                        transition: 'background 0.15s'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb, 20,184,166), 0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'}
                                    >
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <input
                                                className="form-input"
                                                style={{ width: '100%', fontSize: '0.9rem' }}
                                                value={item.descripcion}
                                                onChange={e => handleItemChange(index, 'descripcion', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                            <span style={{ display: 'inline-block', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: '600', letterSpacing: '0.02em' }}>{item.unidad}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                                            S/. {item.mtoValorUnitario.toFixed(2)}
                                        </td>
                                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                            <input
                                                type="number" min="0.1" step="any"
                                                className="form-input"
                                                style={{ padding: '0.4rem 0.5rem', width: '64px', textAlign: 'center', fontSize: '0.9rem' }}
                                                value={item.cantidad}
                                                onChange={e => handleItemChange(index, 'cantidad', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                            <input
                                                type="number" min="0" step="0.01"
                                                className="form-input"
                                                style={{ padding: '0.4rem 0.6rem', width: '96px', textAlign: 'right', fontWeight: '600', fontSize: '0.9rem' }}
                                                value={item.mtoPrecioUnitario}
                                                onChange={e => handleItemChange(index, 'mtoPrecioUnitario', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                                            S/. {item.igv.toFixed(2)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                            S/. {item.importe.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-bg-alt)' }}>
                                    <td colSpan={6} style={{ padding: '0.875rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-secondary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Total Bruto</td>
                                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                        S/. {totales.total.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Panel: Forma de Pago y Obs */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-wallet" style={{ color: 'var(--color-primary)' }}></i>
                        Condiciones de Pago
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Forma de Pago</label>
                            <select className="form-select" defaultValue="contado" style={{ padding: '0.75rem' }}>
                                <option value="contado">CONTADO</option>
                                <option value="credito" disabled>CRÉDITO (Pronto)</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Observación (Visible en comprobante)</label>
                            <input type="text" className="form-input" placeholder="Escribe aquí un comentario..." style={{ padding: '0.75rem' }} />
                        </div>
                    </div>
                </div>

            </div> {/* End Left Column */}

            {/* Right Column: Sticky Sidebar Totals */}
            <div className="facturacion-sidebar" style={{ position: 'sticky', top: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(to bottom, var(--color-surface), var(--color-bg-alt))', border: '1px solid var(--color-border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem 0', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-receipt" style={{ color: 'var(--color-text-secondary)' }}></i> Resumen
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                            <span>Operaciones Gravadas</span>
                            <span style={{ fontWeight: '500' }}>S/. {totales.gravada.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                            <span>Descuentos Totales</span>
                            <span style={{ fontWeight: '500' }}>S/. 0.00</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                            <span>IGV (18%)</span>
                            <span style={{ fontWeight: '500' }}>S/. {totales.igv.toFixed(2)}</span>
                        </div>

                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            paddingTop: '1rem', borderTop: '2px dashed var(--color-border)',
                            marginTop: '0.5rem'
                        }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Importe Total</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                S/. {totales.total.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <i className="bi bi-info-circle-fill" style={{ color: 'var(--color-primary)', marginTop: '2px' }}></i>
                        <div style={{ lineHeight: '1.4' }}>
                            Al emitir, el comprobante se enviará a SUNAT inmediatamente. Verifica que el <strong>{tipoComprobante === '01' ? 'RUC' : 'DNI/Doc'}</strong> sea correcto.
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', borderRadius: '12px', transition: 'all 0.2s ease', transform: 'translateY(0)', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}
                        disabled={submitting}
                        onMouseOver={(e) => { if (!submitting) e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(59, 130, 246, 0.4)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3)'; }}
                    >
                        {submitting ? (
                            <>
                                <i className="bi bi-arrow-repeat spin"></i> Procesando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-send-check-fill"></i> Emitir {tipoComprobante === '01' ? 'Factura' : 'Boleta'}
                            </>
                        )}
                    </button>
                </div>
            </div>

        </div>
    );
}
