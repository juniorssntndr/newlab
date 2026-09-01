import React, { useState } from 'react';
import * as crmApi from '../api/crmApi.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import toast from 'react-hot-toast';

export const ImportModal = ({ onClose, onImportCompleted }) => {
    const { getHeaders } = useAuth();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [filterStatus, setFilterStatus] = useState('todos');

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (selected) {
            const ext = selected.name.split('.').pop().toLowerCase();
            if (ext !== 'csv' && ext !== 'xlsx') {
                toast.error('Formato no soportado. Debe ser un archivo .csv o .xlsx');
                return;
            }
            setFile(selected);
        }
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error('Selecciona un archivo para procesar');
            return;
        }

        setLoading(true);
        try {
            const res = await crmApi.previewImport({ file, headers: getHeaders() });
            setPreviewData(res);
            toast.success(`Previsualización generada: ${res.importacion.total_filas} filas procesadas`);
        } catch (err) {
            toast.error(err.message || 'Error al procesar archivo');
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!previewData?.importacion?.id) return;
        setLoading(true);
        try {
            const res = await crmApi.commitImport({
                id: previewData.importacion.id,
                headers: getHeaders(),
            });
            toast.success(`¡Importación completada! Se crearon ${res.imported} establecimientos.`);
            onImportCompleted && onImportCompleted();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al importar');
        } finally {
            setLoading(false);
        }
    };

    const rows = previewData?.filas || [];
    const filteredRows = rows.filter((r) => {
        if (filterStatus === 'todos') return true;
        return r.estado === filterStatus;
    });

    return (
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
                <div className="crm-modal-header">
                    <div>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                            <i className="bi bi-cloud-arrow-up text-primary" style={{ marginRight: '0.375rem' }}></i>
                            Importación Territorial (CSV / Excel)
                        </h2>
                        <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.125rem 0 0 0' }}>
                            Previsualiza, detecta duplicados y consolida prospectos en el CRM
                        </p>
                    </div>
                    <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <div className="crm-modal-body">
                    {!previewData ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '0.75rem', padding: '2rem', background: '#f8fafc' }}>
                                <i className="bi bi-file-earmark-spreadsheet" style={{ fontSize: '3rem', color: 'var(--color-primary, #3b82f6)' }}></i>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1rem' }}>
                                    Selecciona tu archivo de establecimientos
                                </h3>
                                <p style={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: '460px', margin: '0.5rem auto 1.5rem' }}>
                                    Admite columnas como Nombre, Teléfono, Dirección, Latitud, Longitud, Email y Origen. La deduplicación detecta coincidencias en el archivo y en la base de datos.
                                </p>

                                <input
                                    type="file"
                                    id="crm-import-file-input"
                                    accept=".csv, .xlsx"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="crm-import-file-input" className="crm-btn crm-btn-secondary" style={{ cursor: 'pointer' }}>
                                    <i className="bi bi-folder2-open"></i> {file ? file.name : 'Buscar archivo en tu equipo'}
                                </label>
                            </div>

                            {file && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <button
                                        type="button"
                                        className="crm-btn crm-btn-primary"
                                        onClick={handlePreview}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                                <span>Analizando archivo y duplicados...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-play-fill"></i> Previsualizar Importación
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* Summary indicators */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{previewData.importacion.total_filas}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Filas</div>
                                </div>
                                <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>{previewData.importacion.filas_validas}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#065f46' }}>Válidas para Alta</div>
                                </div>
                                <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fde68a', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>{previewData.importacion.filas_duplicadas}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Duplicadas</div>
                                </div>
                                <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fecaca', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>{previewData.importacion.filas_error}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Con Error</div>
                                </div>
                            </div>

                            {/* Filter tabs */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                {['todos', 'valida', 'duplicada', 'error'].map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        className={`crm-btn crm-btn-sm ${filterStatus === s ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
                                        onClick={() => setFilterStatus(s)}
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            {/* Rows table */}
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                                <table className="crm-table">
                                    <thead>
                                        <tr>
                                            <th>Fila</th>
                                            <th>Nombre</th>
                                            <th>Teléfono</th>
                                            <th>Dirección</th>
                                            <th>Estado</th>
                                            <th>Observación</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.slice(0, 100).map((r) => (
                                            <tr key={r.id || r.numero_fila}>
                                                <td>#{r.numero_fila}</td>
                                                <td style={{ fontWeight: 600 }}>{r.datos_normalizados?.nombre || r.datos_originales?.nombre || '—'}</td>
                                                <td>{r.datos_normalizados?.telefono || '—'}</td>
                                                <td>{r.datos_normalizados?.direccion || '—'}</td>
                                                <td>
                                                    <span className={`crm-badge ${r.estado === 'valida' ? 'salud-verde' : r.estado === 'duplicada' ? 'salud-amarillo' : 'salud-rojo'}`}>
                                                        {r.estado}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    {r.duplicado ? (
                                                        <span>Coincide con: {r.duplicado.nombre || r.duplicado.criterio}</span>
                                                    ) : r.errores && r.errores.length > 0 ? (
                                                        <span style={{ color: '#dc2626' }}>{r.errores.join(', ')}</span>
                                                    ) : (
                                                        'Lista para crear'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredRows.length > 100 && (
                                <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '0.5rem' }}>
                                    Mostrando las primeras 100 filas de {filteredRows.length} coincidentes.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="crm-modal-footer">
                    {previewData ? (
                        <>
                            <button
                                type="button"
                                className="crm-btn crm-btn-secondary"
                                onClick={() => {
                                    setPreviewData(null);
                                    setFile(null);
                                }}
                                disabled={loading}
                            >
                                Cambiar Archivo
                            </button>
                            <button
                                type="button"
                                className="crm-btn crm-btn-success"
                                onClick={handleCommit}
                                disabled={loading || previewData.importacion.filas_validas === 0}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check2-circle"></i> Importar {previewData.importacion.filas_validas} Filas Aprobadas
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
