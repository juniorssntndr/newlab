import React, { useState, useMemo } from 'react';
import Modal from '../Modal.jsx';
import { apiClient } from '../../services/http/apiClient.js';
import { extractCoordsFromInput } from '../../utils/mapCoordsParser.js';
import toast from 'react-hot-toast';

export const QuickClinicModal = ({
    open,
    isOpen,
    onClose,
    onCreated,
    headers = {}
}) => {
    const isModalOpen = Boolean(open ?? isOpen);

    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [documento, setDocumento] = useState('');
    const [mapsInput, setMapsInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Automatically detect coordinates from Maps/WhatsApp link
    const detectedCoords = useMemo(() => {
        return extractCoordsFromInput(mapsInput);
    }, [mapsInput]);

    const resetForm = () => {
        setNombre('');
        setTelefono('');
        setDireccion('');
        setDocumento('');
        setMapsInput('');
        setError('');
    };

    const handleClose = () => {
        resetForm();
        onClose?.();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const cleanNombre = nombre.trim();
        const cleanPhone = telefono.replace(/\D/g, '');

        if (!cleanNombre) {
            setError('Por favor ingresa el nombre de la clínica o del doctor.');
            return;
        }

        if (!cleanPhone || cleanPhone.length < 8) {
            setError('Ingresa un número de celular/WhatsApp válido (mínimo 8 o 9 dígitos).');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                nombre: cleanNombre,
                telefono: cleanPhone,
                direccion: direccion.trim() || null,
                crm: detectedCoords
                    ? { latitud: detectedCoords.lat, longitud: detectedCoords.lng, tipo: 'clinica' }
                    : { tipo: 'clinica' }
            };

            const docTrim = documento.trim();
            if (docTrim) {
                if (docTrim.length === 11) {
                    payload.ruc = docTrim;
                    payload.tipo_doc = '6';
                } else if (docTrim.length === 8) {
                    payload.dni = docTrim;
                    payload.tipo_doc = '1';
                } else {
                    payload.dni = docTrim;
                }
            }

            const res = await apiClient('/clinicas', {
                method: 'POST',
                headers,
                body: payload
            });

            const createdClinic = res?.clinic || res?.clinica || res;
            toast.success(`¡Clínica "${cleanNombre}" creada y seleccionada!`, {
                icon: '🏥',
                duration: 4000
            });

            onCreated?.(createdClinic);
            handleClose();
        } catch (err) {
            setError(err.message || 'Error al registrar la clínica.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={isModalOpen}
            onClose={handleClose}
            title="Nueva Clínica o Doctor"
            subtitle="Registro rápido para asociar a esta orden técnica"
            icon="bi-hospital"
            kicker="AFINIX LAB • CLIENTE"
            size="md"
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: 0 }}>
                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="bi bi-exclamation-circle" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="quick-clinica-nombre" style={{ fontWeight: 650, fontSize: '0.85rem' }}>
                        Nombre de Clínica o Doctor <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        id="quick-clinica-nombre"
                        type="text"
                        className="form-input"
                        placeholder="Ej: Consultorio Dr. Juan Pérez o Clínica Dental Sur"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        autoFocus
                        required
                    />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="quick-clinica-telefono" style={{ fontWeight: 650, fontSize: '0.85rem' }}>
                        Celular / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        id="quick-clinica-telefono"
                        type="tel"
                        className="form-input"
                        placeholder="Ej: 987654321"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        required
                    />
                    <small style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                        Indispensable para enviarle el link de seguimiento y visor 3D sin cuenta.
                    </small>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="quick-clinica-direccion" style={{ fontWeight: 650, fontSize: '0.85rem' }}>
                        Dirección o Ciudad (Opcional)
                    </label>
                    <input
                        id="quick-clinica-direccion"
                        type="text"
                        className="form-input"
                        placeholder="Ej: Av. Cayma 205, Arequipa o Cusco"
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                    />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="quick-clinica-maps" style={{ fontWeight: 650, fontSize: '0.85rem' }}>
                        Enlace de Google Maps / WhatsApp (Opcional)
                    </label>
                    <input
                        id="quick-clinica-maps"
                        type="text"
                        className="form-input"
                        placeholder="Pega aquí el link de Google Maps o coordenadas..."
                        value={mapsInput}
                        onChange={(e) => setMapsInput(e.target.value)}
                    />
                    {detectedCoords ? (
                        <div style={{ marginTop: '0.35rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#059669', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                            <i className="bi bi-geo-alt-fill" />
                            <span>Ubicación detectada: ({detectedCoords.lat.toFixed(4)}, {detectedCoords.lng.toFixed(4)}) • Aparecerá en el mapa CRM</span>
                        </div>
                    ) : mapsInput.trim() ? (
                        <small style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                            No se detectaron coordenadas en el texto ingresado. Puedes ubicarlo luego en el mapa.
                        </small>
                    ) : null}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="quick-clinica-doc" style={{ fontWeight: 650, fontSize: '0.85rem' }}>
                        RUC o DNI (Opcional)
                    </label>
                    <input
                        id="quick-clinica-doc"
                        type="text"
                        className="form-input"
                        placeholder="RUC de 11 dígitos o DNI de 8 dígitos"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        maxLength={11}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" style={{ marginRight: '0.4rem' }} />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg" style={{ marginRight: '0.35rem' }} />
                                Guardar y Seleccionar
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default QuickClinicModal;
