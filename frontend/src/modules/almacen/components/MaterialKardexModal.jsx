import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal.jsx';
import { useAuth } from '../../../state/AuthContext.jsx';
import { API_URL } from '../../../config.js';

export const MaterialKardexModal = ({ isOpen, onClose, material }) => {
    const { getHeaders } = useAuth();
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !material?.id) {
            setMovimientos([]);
            return;
        }

        setLoading(true);
        fetch(`${API_URL}/inventory/${material.id}/kardex`, { headers: getHeaders() })
            .then(res => res.json())
            .then(data => {
                setMovimientos(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error cargando kardex:', err);
                setLoading(false);
            });
    }, [isOpen, material?.id, getHeaders]);

    if (!material) return null;

    const getTipoBadge = (tipo) => {
        switch (tipo) {
            case 'ingreso':
                return <span className="badge badge-en_produccion">📥 Ingreso</span>;
            case 'apertura_taller':
                return <span className="badge badge-primary">⚙️ A Taller</span>;
            case 'consumo_unitario':
                return <span className="badge badge-warning">🦷 Consumo</span>;
            case 'agotado_taller':
                return <span className="badge badge-inactive">🗑️ Agotado</span>;
            case 'merma_taller':
                return <span className="badge badge-error">⚠️ Merma</span>;
            case 'ajuste':
                return <span className="badge">🔄 Ajuste</span>;
            default:
                return <span className="badge">{tipo}</span>;
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        try {
            const d = new Date(isoString);
            return d.toLocaleString('es-PE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            icon="bi-journal-text"
            kicker="Auditoría y Trazabilidad"
            title={`Kárdex: ${material.nombre}`}
            subtitle={`Historial cronológico de ingresos, salidas y mermas de almacén y taller`}
            footer={
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Cerrar
                </button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Resumen actual */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-bg-alt, #f8fafc)',
                    borderRadius: 'var(--radius-md, 8px)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    fontSize: '0.85rem'
                }}>
                    <div>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Almacén Actual: </span>
                        <strong>{material.stock_actual} {material.unidad}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--color-text-secondary)' }}>En Taller / Uso: </span>
                        <strong style={{ color: '#0284c7' }}>{material.stock_en_uso || '0.00'} {material.unidad}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Tipo de Control: </span>
                        <strong>{material.tipo_control === 'multiuso' ? 'Multiuso (Discos/Resina)' : 'Unitario (1 a 1)'}</strong>
                    </div>
                </div>

                {/* Tabla de movimientos */}
                <div className="data-table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                        <thead>
                            <tr>
                                <th>Fecha / Hora</th>
                                <th>Operación</th>
                                <th style={{ textAlign: 'right' }}>Cantidad</th>
                                <th>Balance Almacén</th>
                                <th>Balance Taller</th>
                                <th>Detalle / Motivo</th>
                                <th>Usuario</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center" style={{ padding: '2rem' }}>
                                        Cargando historial del kárdex...
                                    </td>
                                </tr>
                            ) : movimientos.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center" style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>
                                        No hay movimientos registrados para este material todavía.
                                    </td>
                                </tr>
                            ) : (
                                movimientos.map(mov => (
                                    <tr key={mov.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(mov.created_at)}</td>
                                        <td>{getTipoBadge(mov.tipo)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {mov.cantidad} {material.unidad}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>{mov.stock_almacen_anterior}</span>
                                            {' → '}
                                            <strong>{mov.stock_almacen_nuevo}</strong>
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span style={{ color: 'var(--color-text-secondary)' }}>{mov.stock_en_uso_anterior}</span>
                                            {' → '}
                                            <strong style={{ color: '#0284c7' }}>{mov.stock_en_uso_nuevo}</strong>
                                        </td>
                                        <td>
                                            {mov.numero_comprobante && (
                                                <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                                    Doc: {mov.numero_comprobante}
                                                </div>
                                            )}
                                            {mov.proveedor_nombre && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                    Prov: {mov.proveedor_nombre}
                                                </div>
                                            )}
                                            {mov.motivo && <div>{mov.motivo}</div>}
                                            {mov.notas && <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>{mov.notas}</div>}
                                            {!mov.numero_comprobante && !mov.proveedor_nombre && !mov.motivo && !mov.notas && '—'}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {mov.usuario_nombre || 'Sistema'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default MaterialKardexModal;
