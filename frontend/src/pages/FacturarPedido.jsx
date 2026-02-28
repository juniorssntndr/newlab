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
            // If the client has a 11-digit RUC, default to Factura (01)
            let defaultTipoDoc = '1';
            let defaultNum = data.dni || '';
            let isFactura = false;

            if (data.ruc && data.ruc.length === 11) {
                defaultTipoDoc = '6';
                defaultNum = data.ruc;
                isFactura = true;
                setTipoComprobante('01');
            }

            setCliente({
                tipoDoc: defaultTipoDoc,
                numDoc: defaultNum,
                rznSocial: data.razon_social || data.paciente_nombre || '',
                direccion: data.direccion || 'Lima, Peru',
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
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)', gap: '1rem' }}>
                <button
                    onClick={() => navigate(`/finanzas/${id}`)}
                    className="btn btn-secondary"
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                >
                    <i className="bi bi-arrow-left" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)' }}></i>
                </button>
                <h1 style={{ margin: 0 }}>Emitir Comprobante Electrónico</h1>
            </div>

            <form onSubmit={handleSubmit}>

                {/* Panel Superior: Tipo y Cliente */}
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                        <div style={{ flex: '1 1 300px' }}>
                            <h3 className="card-title">Documento</h3>
                            <div className="form-group">
                                <label>Tipo de Comprobante</label>
                                <select
                                    className="input-field"
                                    value={tipoComprobante}
                                    onChange={handleTipoComprobanteChange}
                                >
                                    <option value="03">Boleta Electrónica</option>
                                    <option value="01">Factura Electrónica</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ flex: '2 1 600px' }}>
                            <h3 className="card-title">Datos del Receptor (Cliente)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Tipo Doc. Ident. *</label>
                                    <select
                                        className="input-field"
                                        value={cliente.tipoDoc}
                                        onChange={e => setCliente({ ...cliente, tipoDoc: e.target.value })}
                                    >
                                        <option value="1">DNI</option>
                                        <option value="6">RUC</option>
                                        <option value="4">Carnet Extranjería</option>
                                        <option value="-">Varios (Sin Doc)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>N° de Documento *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Número..."
                                        value={cliente.numDoc}
                                        onChange={e => setCliente({ ...cliente, numDoc: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Razón Social / Nombres y Apellidos *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Nombre del cliente..."
                                    value={cliente.rznSocial}
                                    onChange={e => setCliente({ ...cliente, rznSocial: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Dirección del Receptor</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Dirección fiscal..."
                                        value={cliente.direccion}
                                        onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ubigeo</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Ej: 150101"
                                        value={cliente.ubigeo}
                                        onChange={e => setCliente({ ...cliente, ubigeo: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Panel Central: Productos */}
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <h3 className="card-title">Listado de Productos / Servicios tributarios</h3>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem 0' }}>Descripción</th>
                                    <th>Unidad</th>
                                    <th>Tipo IGV</th>
                                    <th>V.U (Sin IGV)</th>
                                    <th>Cant.</th>
                                    <th>P.U (Con IGV)</th>
                                    <th>IGV Fila</th>
                                    <th>Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productosFacturacion.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem 0' }}>
                                            <input
                                                className="input-field" style={{ padding: '0.25rem', height: 'auto', minWidth: '180px' }}
                                                value={item.descripcion}
                                                onChange={e => handleItemChange(index, 'descripcion', e.target.value)}
                                            />
                                        </td>
                                        <td>{item.unidad}</td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Gravado (Onerosa)
                                            </span>
                                        </td>
                                        <td>S/. {item.mtoValorUnitario.toFixed(2)}</td>
                                        <td>
                                            <input
                                                type="number" min="0.1" step="any"
                                                className="input-field" style={{ padding: '0.25rem', height: 'auto', width: '60px' }}
                                                value={item.cantidad}
                                                onChange={e => handleItemChange(index, 'cantidad', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number" min="0" step="0.01"
                                                className="input-field" style={{ padding: '0.25rem', height: 'auto', width: '90px' }}
                                                value={item.mtoPrecioUnitario}
                                                onChange={e => handleItemChange(index, 'mtoPrecioUnitario', e.target.value)}
                                            />
                                        </td>
                                        <td>S/. {item.igv.toFixed(2)}</td>
                                        <td style={{ fontWeight: '600' }}>S/. {item.importe.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Panel Inferior: Totales y Envío */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 300px', gap: '2rem', alignItems: 'start' }}>

                    <div className="card">
                        <h3 className="card-title">Forma de Pago</h3>
                        <div className="form-group">
                            <select className="input-field" defaultValue="contado">
                                <option value="contado">CONTADO</option>
                                <option value="credito" disabled>CRÉDITO (Pronto)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Observación (Visible en comprobante)</label>
                            <textarea className="input-field" placeholder="Escribe aquí un comentario..." rows="3"></textarea>
                        </div>
                    </div>

                    <div className="card" style={{ background: 'var(--bg-secondary)' }}>
                        <h3 className="card-title">Resumen de Totales</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Operaciones Gravadas:</span>
                            <span>S/. {totales.gravada.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Descuento Total:</span>
                            <span>S/. 0.00</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span>IGV (18%):</span>
                            <span>S/. {totales.igv.toFixed(2)}</span>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            paddingTop: '1rem', borderTop: '2px solid var(--border-color)',
                            fontWeight: '600', fontSize: '1.25rem', color: 'var(--primary-color)'
                        }}>
                            <span>Importe Total:</span>
                            <span>S/. {totales.total.toFixed(2)}</span>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <span><i className="bi bi-arrow-repeat spin"></i> Procesando con SUNAT...</span>
                                ) : (
                                    <span><i className="bi bi-send-check"></i> Emitir Comprobante ({tipoComprobante === '01' ? 'Factura' : 'Boleta'})</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

            </form>
        </div>
    );
}
