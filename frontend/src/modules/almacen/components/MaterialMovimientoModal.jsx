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
    materiales = [],
    proveedores = [],
    initialTipo = 'ingreso',
    onSuccess
}) => {
    const { getHeaders } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    // Selected material state (permite seleccionar si se abrio desde el boton superior)
    const [selectedMatId, setSelectedMatId] = useState(material ? String(material.id) : '');

    // Form state
    const [tipo, setTipo] = useState(initialTipo || 'ingreso');
    const [cantidad, setCantidad] = useState(1);
    const [proveedorId, setProveedorId] = useState('');
    const [costoUnitario, setCostoUnitario] = useState('');
    const [numeroComprobante, setNumeroComprobante] = useState('');
    const [origen, setOrigen] = useState('taller'); // para merma: 'taller' o 'almacen'
    const [motivo, setMotivo] = useState('');
    const [notas, setNotas] = useState('');

    // Categoria principal del movimiento: 'ingreso' vs 'laboratorio'
    const [categoriaMov, setCategoriaMov] = useState(initialTipo === 'ingreso' ? 'ingreso' : 'laboratorio');

    // Sincronizar tipo y material inicial cuando se abre
    React.useEffect(() => {
        if (isOpen) {
            setSelectedMatId(material ? String(material.id) : (materiales[0] ? String(materiales[0].id) : ''));
            const initialMode = initialTipo === 'ingreso' ? 'ingreso' : 'laboratorio';
            setCategoriaMov(initialMode);
            setTipo(initialTipo || 'ingreso');
            setCantidad(1);
            setProveedorId('');
            setCostoUnitario('');
            setNumeroComprobante('');
            setOrigen('taller');
            setMotivo('');
            setNotas('');
        }
    }, [isOpen, material, initialTipo, materiales]);

    // Material activo a usar
    const activeMaterial = material || materiales.find(m => String(m.id) === String(selectedMatId)) || null;

    if (!isOpen) return null;
    if (!activeMaterial && materiales.length === 0) return null;

    const stockAlmacen = activeMaterial ? (parseFloat(activeMaterial.stock_actual) || 0) : 0;
    const stockEnUso = activeMaterial ? (parseFloat(activeMaterial.stock_en_uso) || 0) : 0;

    const opcionesLaboratorio = [
        { value: 'apertura_taller', label: '🔬 Pasar a Laboratorio (Almacén → Laboratorio para uso)' },
        { value: 'agotado_taller', label: '🗑️ Terminado en Laboratorio (Resta de Laboratorio)' },
        { value: 'consumo_unitario', label: '📤 Salida directa de Almacén (Consumo sin laboratorio)' },
        { value: 'merma_taller', label: '⚠️ Merma / Rotura Técnica' },
    ];

    const handleTabSwitch = (newMode) => {
        setCategoriaMov(newMode);
        if (newMode === 'ingreso') {
            setTipo('ingreso');
        } else {
            setTipo('apertura_taller');
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const cantNum = parseFloat(cantidad);
        if (!cantNum || cantNum <= 0) {
            toast.error('Ingresa una cantidad válida mayor a 0');
            return;
        }

        // Validaciones preventivas de stock
        if (tipo === 'apertura_taller' && cantNum > stockAlmacen) {
            toast.error(`Stock insuficiente en almacén (Disponible: ${stockAlmacen} ${activeMaterial.unidad})`);
            return;
        }
        if (tipo === 'consumo_unitario' && cantNum > stockAlmacen) {
            toast.error(`Stock insuficiente en almacén (Disponible: ${stockAlmacen} ${activeMaterial.unidad})`);
            return;
        }
        if (tipo === 'agotado_taller' && cantNum > stockEnUso) {
            toast.error(`Stock en uso insuficiente para dar de baja (En uso actual: ${stockEnUso} ${activeMaterial.unidad})`);
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

            const res = await fetch(`${API_URL}/inventory/${activeMaterial.id}/movimiento`, {
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
            title={activeMaterial ? `Movimiento: ${activeMaterial.nombre}` : 'Registrar Movimiento'}
            subtitle={activeMaterial ? `${activeMaterial.color ? `Color: ${activeMaterial.color} • ` : ''}Presentación: ${activeMaterial.unidad}` : 'Selecciona un material'}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                        Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !activeMaterial}>
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
                {/* Selector de material si no se fijó uno previamente */}
                {!material && materiales.length > 0 && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Seleccionar Material *</label>
                        <CustomSelect
                            value={selectedMatId}
                            onChange={(e) => setSelectedMatId(e.target.value)}
                            options={materiales.map(m => ({
                                value: String(m.id),
                                label: `${m.nombre}${m.color ? ` (${m.color})` : ''} — Almacén: ${m.stock_actual} ${m.unidad}`
                            }))}
                        />
                    </div>
                )}

                {/* Resumen actual del material */}
                {activeMaterial && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
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
                                {stockAlmacen} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{activeMaterial.unidad}</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                🔬 En Laboratorio
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7' }}>
                                {stockEnUso} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{activeMaterial.unidad}</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                🛡️ Mínimo
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                                {activeMaterial.stock_minimo} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{activeMaterial.unidad}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Selector de Modo Principal: Ingreso vs Laboratorio */}
                <div style={{ display: 'flex', background: 'var(--color-bg-alt, #f1f5f9)', padding: '4px', borderRadius: 'var(--radius-lg, 10px)', gap: '4px' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${categoriaMov === 'ingreso' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-md, 6px)', fontWeight: 600, fontSize: '0.82rem' }}
                        onClick={() => handleTabSwitch('ingreso')}
                    >
                        📥 Ingreso a Almacén (Compra)
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${categoriaMov === 'laboratorio' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-md, 6px)', fontWeight: 600, fontSize: '0.82rem' }}
                        onClick={() => handleTabSwitch('laboratorio')}
                    >
                        🔬 Movimiento en Laboratorio (Uso)
                    </button>
                </div>

                {/* Subtipo para Laboratorio */}
                {categoriaMov === 'laboratorio' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Operación en Laboratorio *</label>
                        <CustomSelect
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            options={opcionesLaboratorio}
                        />
                    </div>
                )}

                {/* Cantidad */}
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                        Cantidad {activeMaterial ? `(${activeMaterial.unidad})` : ''} *
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

                {/* Campos específicos de INGRESO */}
                {categoriaMov === 'ingreso' && (
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

                {/* Campos específicos de LABORATORIO */}
                {categoriaMov === 'laboratorio' && tipo === 'merma_taller' && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Ubicación del descarte / merma</label>
                        <CustomSelect
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            options={[
                                { value: 'taller', label: 'Laboratorio / Máquina (Resta de stock en uso)' },
                                { value: 'almacen', label: 'Almacén Central (Resta de stock en almacén)' }
                            ]}
                        />
                    </div>
                )}

                {categoriaMov === 'laboratorio' && (tipo === 'agotado_taller' || tipo === 'merma_taller') && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Motivo de la baja</label>
                        <input
                            type="text"
                            className="form-input"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder={tipo === 'agotado_taller' ? 'Ej. Producto completado / agotado en máquina' : 'Ej. Rotura técnica, vencimiento, descarte...'}
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
