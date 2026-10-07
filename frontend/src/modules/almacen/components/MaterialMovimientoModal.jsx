import React, { useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import CustomSelect from '../../../components/CustomSelect.jsx';
import { useAuth } from '../../../state/AuthContext.jsx';
import { API_URL } from '../../../config.js';
import toast from 'react-hot-toast';

export const MaterialMovimientoModal = ({
    isOpen,
    onClose,
    material,
    proveedores = [],
    initialTipo = 'ingreso',
    onSuccess
}) => {
    const { getHeaders } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [tipo, setTipo] = useState(initialTipo || 'ingreso');
    const [cantidad, setCantidad] = useState(1);
    const [proveedorId, setProveedorId] = useState('');
    const [costoUnitario, setCostoUnitario] = useState('');
    const [numeroComprobante, setNumeroComprobante] = useState('');
    const [origen, setOrigen] = useState('taller'); // para merma: 'taller' o 'almacen'
    const [motivo, setMotivo] = useState('');
    const [notas, setNotas] = useState('');

    // Sincronizar tipo inicial cuando se abre
    React.useEffect(() => {
        if (isOpen) {
            setTipo(initialTipo || 'ingreso');
            setCantidad(1);
            setProveedorId('');
            setCostoUnitario('');
            setNumeroComprobante('');
            setOrigen('taller');
            setMotivo('');
            setNotas('');
        }
    }, [isOpen, initialTipo]);

    if (!material) return null;

    const stockAlmacen = parseFloat(material.stock_actual) || 0;
    const stockEnUso = parseFloat(material.stock_en_uso) || 0;
    const isMultiuso = material.tipo_control === 'multiuso' || ['disco', 'resina', 'liquido'].includes((material.categoria || '').toLowerCase());

    const opcionesTipo = [
        { value: 'ingreso', label: '📥 Ingreso / Compra (Suma a Almacén)' },
        ...(isMultiuso ? [
            { value: 'apertura_taller', label: '⚙️ Abrir a Taller / Máquina (Almacén → Taller)' },
            { value: 'agotado_taller', label: '🗑️ Marcar Agotado / Descarte (Resta de Taller)' },
        ] : [
            { value: 'consumo_unitario', label: '🦷 Consumo Unitario (Resta de Almacén)' },
        ]),
        { value: 'merma_taller', label: '⚠️ Merma / Rotura Técnica' },
    ];

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const cantNum = parseFloat(cantidad);
        if (!cantNum || cantNum <= 0) {
            toast.error('Ingresa una cantidad válida mayor a 0');
            return;
        }

        // Validaciones preventivas de stock
        if (tipo === 'apertura_taller' && cantNum > stockAlmacen) {
            toast.error(`Stock insuficiente en almacén (Disponible: ${stockAlmacen} ${material.unidad})`);
            return;
        }
        if (tipo === 'consumo_unitario' && cantNum > stockAlmacen) {
            toast.error(`Stock insuficiente en almacén (Disponible: ${stockAlmacen} ${material.unidad})`);
            return;
        }
        if (tipo === 'agotado_taller' && cantNum > stockEnUso) {
            toast.error(`Stock en uso insuficiente para dar de baja (En uso actual: ${stockEnUso} ${material.unidad})`);
            return;
        }
        if (tipo === 'merma_taller') {
            if (origen === 'almacen' && cantNum > stockAlmacen) {
                toast.error(`Stock insuficiente en almacén para registrar merma (Disponible: ${stockAlmacen})`);
                return;
            }
            if (origen === 'taller' && cantNum > stockEnUso) {
                toast.error(`Stock en uso insuficiente para registrar merma (En uso: ${stockEnUso})`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const body = {
                tipo,
                cantidad: cantNum,
                proveedor_id: proveedorId ? parseInt(proveedorId, 10) : null,
                costo_unitario: costoUnitario ? parseFloat(costoUnitario) : null,
                numero_comprobante: numeroComprobante.trim() || null,
                origen,
                motivo: motivo.trim() || null,
                notas: notas.trim() || null
            };

            const res = await fetch(`${API_URL}/inventory/${material.id}/movimiento`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error al registrar movimiento');
            }

            toast.success('Movimiento registrado correctamente');
            if (onSuccess) onSuccess(data.material);
            onClose();
        } catch (err) {
            console.error('Error registrando movimiento:', err);
            toast.error(err.message || 'Error de conexión');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            icon="bi-arrow-left-right"
            kicker="Control de Existencias"
            title={`Registrar Movimiento: ${material.nombre}`}
            subtitle={`${isMultiuso ? 'Material Multiuso (Disco / Resina)' : 'Material Unitario'} • Unidad: ${material.unidad}`}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg"></i> Confirmar Movimiento
                            </>
                        )}
                    </button>
                </>
            }
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Resumen actual del material */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: 'var(--color-bg-alt, #f8fafc)',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--color-border, #e2e8f0)'
                }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            📦 En Almacén
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                            {stockAlmacen} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{material.unidad}</span>
                        </div>
                    </div>
                    {isMultiuso && (
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                ⚙️ En Uso (Taller)
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7' }}>
                                {stockEnUso} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{material.unidad}</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                            🛡️ Mínimo
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                            {material.stock_minimo} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{material.unidad}</span>
                        </div>
                    </div>
                </div>

                {/* Tipo de movimiento */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Tipo de Movimiento *</label>
                    <CustomSelect
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        options={opcionesTipo}
                    />
                </div>

                {/* Cantidad */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        Cantidad ({material.unidad}) *
                    </label>
                    <div className="form-input-box has-lead">
                        <i className="bi bi-123 input-icon-lead"></i>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-input"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            placeholder="1"
                            required
                        />
                    </div>
                </div>

                {/* Campos específicos según el tipo */}
                {tipo === 'ingreso' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Proveedor</label>
                            <CustomSelect
                                value={proveedorId}
                                onChange={(e) => setProveedorId(e.target.value)}
                                options={[
                                    { value: '', label: '— Seleccionar proveedor (opcional) —' },
                                    ...proveedores.map(p => ({
                                        value: String(p.id),
                                        label: `${p.razon_social}${p.nombre_comercial ? ` (${p.nombre_comercial})` : ''}`
                                    }))
                                ]}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Costo Unitario (S/.)</label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-cash input-icon-lead"></i>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        value={costoUnitario}
                                        onChange={(e) => setCostoUnitario(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">N° Factura / Guía</label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-receipt input-icon-lead"></i>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={numeroComprobante}
                                        onChange={(e) => setNumeroComprobante(e.target.value)}
                                        placeholder="F001-1234..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tipo === 'merma_taller' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Ubicación del descarte / merma</label>
                        <CustomSelect
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            options={[
                                { value: 'taller', label: 'Taller / Máquina (Resta de stock en uso)' },
                                { value: 'almacen', label: 'Almacén Central (Resta de stock en almacén)' }
                            ]}
                        />
                    </div>
                )}

                {(tipo === 'agotado_taller' || tipo === 'merma_taller') && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Motivo / Causa de la baja</label>
                        <input
                            type="text"
                            className="form-input"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder={tipo === 'agotado_taller' ? 'Ej. Desgaste completo de fresado (22 piezas)' : 'Ej. Rotura de fresa durante desbaste, caída, etc.'}
                        />
                    </div>
                )}

                {/* Notas generales */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Observaciones / Notas (Opcional)</label>
                    <textarea
                        className="form-textarea"
                        rows={2}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder="Detalles adicionales para trazabilidad..."
                    />
                </div>
            </form>
        </Modal>
    );
};

export default MaterialMovimientoModal;
