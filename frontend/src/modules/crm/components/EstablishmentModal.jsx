import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCrmMutations } from '../queries/useCrmQueries.js';
import toast from 'react-hot-toast';

const DISTRITOS_AREQUIPA = [
    'Cercado',
    'José Luis Bustamante y Rivero',
    'Yanahuara',
    'Cayma',
    'Paucarpata',
    'Cerro Colorado',
    'Miraflores',
    'Mariano Melgar',
    'Alto Selva Alegre',
    'Socabaya',
    'Jacobo Hunter',
    'Sachaca',
    'Tiabaya',
    'Characato',
    'Uchumayo',
    'Otro',
];

export const EstablishmentModal = ({
    establishment = null,
    initialCoords = null,
    onClose,
    onCreated,
    onSaved,
}) => {
    const { createEstablecimiento, updateEstablecimiento, isPending } = useCrmMutations();
    const isEdit = Boolean(establishment?.id);

    const [form, setForm] = useState({
        nombre: establishment?.nombre || '',
        tipo: establishment?.tipo || 'clinica',
        telefono: establishment?.telefono || '',
        email: establishment?.email || '',
        direccion: establishment?.direccion || '',
        distrito: '',
        latitud: establishment?.latitud != null ? String(establishment.latitud) : (initialCoords?.lat ? String(initialCoords.lat) : ''),
        longitud: establishment?.longitud != null ? String(establishment.longitud) : (initialCoords?.lng ? String(initialCoords.lng) : ''),
        notas: establishment?.notas || '',
        etapa: establishment?.etapa || 'nuevo',
    });

    const [isLocating, setIsLocating] = useState(false);

    useEffect(() => {
        if (establishment) {
            setForm({
                nombre: establishment.nombre || '',
                tipo: establishment.tipo || 'clinica',
                telefono: establishment.telefono || '',
                email: establishment.email || '',
                direccion: establishment.direccion || '',
                distrito: '',
                latitud: establishment.latitud != null ? String(establishment.latitud) : '',
                longitud: establishment.longitud != null ? String(establishment.longitud) : '',
                notas: establishment.notas || '',
                etapa: establishment.etapa || 'nuevo',
            });
        }
    }, [establishment]);

    useEffect(() => {
        if (initialCoords && !establishment) {
            setForm((prev) => ({
                ...prev,
                latitud: initialCoords.lat ? String(initialCoords.lat) : prev.latitud,
                longitud: initialCoords.lng ? String(initialCoords.lng) : prev.longitud,
            }));
        }
    }, [initialCoords, establishment]);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Tu navegador no soporta geolocalización GPS.');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm((prev) => ({
                    ...prev,
                    latitud: pos.coords.latitude.toFixed(6),
                    longitud: pos.coords.longitude.toFixed(6),
                }));
                setIsLocating(false);
                toast.success('Ubicación GPS capturada con éxito.');
            },
            (err) => {
                setIsLocating(false);
                toast.error('No se pudo obtener la ubicación GPS: ' + (err.message || 'Permiso denegado'));
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanNombre = form.nombre.trim();
        if (!cleanNombre) {
            toast.error('El nombre del consultorio o clínica es obligatorio.');
            return;
        }

        const fullDireccion = form.distrito && !form.direccion.toLowerCase().includes(form.distrito.toLowerCase())
            ? `${form.direccion.trim()}, ${form.distrito}, Arequipa`
            : form.direccion.trim();

        const payload = {
            nombre: cleanNombre,
            tipo: form.tipo,
            telefono: form.telefono.trim() || null,
            email: form.email.trim() || null,
            direccion: fullDireccion || null,
            latitud: form.latitud ? parseFloat(form.latitud) : null,
            longitud: form.longitud ? parseFloat(form.longitud) : null,
            notas: form.notas.trim() || null,
            etapa: form.etapa || 'nuevo',
        };

        try {
            if (isEdit) {
                const result = await updateEstablecimiento({ id: establishment.id, payload });
                toast.success(`Establecimiento "${cleanNombre}" actualizado exitosamente.`);
                onSaved && onSaved(result);
                onCreated && onCreated(result);
            } else {
                const result = await createEstablecimiento(payload);
                toast.success(`Prospecto "${cleanNombre}" creado exitosamente.`);
                onCreated && onCreated(result);
            }
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al guardar.');
        }
    };

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
                    <div className="crm-modal-header">
                        <div className="crm-modal-header-main">
                            <div className="crm-modal-avatar-badge" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                                <i className={`bi ${form.tipo === 'clinica' ? 'bi-hospital-fill' : 'bi-building'}`}></i>
                            </div>
                            <div className="crm-modal-header-text">
                                <div className="crm-modal-kicker">CRM • {isEdit ? 'EDICIÓN COMERCIAL' : 'PROSPECCIÓN Y CARTERA'}</div>
                                <h2 className="crm-modal-title">{isEdit ? 'Editar Establecimiento / Prospecto' : 'Registrar Nuevo Prospecto'}</h2>
                                <p className="crm-modal-subtitle">
                                    {isEdit ? 'Actualiza los datos de contacto, dirección y notas comerciales' : 'Ingresa los datos comerciales básicos para seguimiento o visitas'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="crm-btn crm-btn-secondary crm-btn-icon"
                            onClick={onClose}
                            title="Cerrar"
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {/* Nombre del consultorio */}
                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">
                                Nombre del Consultorio o Clínica <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div className="form-input-box has-lead">
                                <i className="bi bi-building input-icon-lead"></i>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Consultorio Dental OdontoSalud"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    className="crm-form-control"
                                />
                            </div>
                        </div>

                        {/* Tipo & Teléfono */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">
                                    Tipo de Establecimiento
                                </label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-tag input-icon-lead"></i>
                                    <select
                                        value={form.tipo}
                                        onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                                        className="crm-form-control"
                                    >
                                        <option value="clinica">Clínica Dental</option>
                                        <option value="odontologo">Consultorio Particular</option>
                                    </select>
                                </div>
                            </div>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">
                                    Teléfono / WhatsApp
                                </label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-telephone input-icon-lead"></i>
                                    <input
                                        type="text"
                                        placeholder="Ej. 958 123 456"
                                        value={form.telefono}
                                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                        className="crm-form-control"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dirección & Distrito */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">
                                    Dirección (Calle, Nro., Urb.)
                                </label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-geo-alt input-icon-lead"></i>
                                    <input
                                        type="text"
                                        placeholder="Ej. Av. Ejército 405, Of. 302"
                                        value={form.direccion}
                                        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                                        className="crm-form-control"
                                    />
                                </div>
                            </div>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">
                                    Distrito (Arequipa)
                                </label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-pin-map input-icon-lead"></i>
                                    <select
                                        value={form.distrito}
                                        onChange={(e) => setForm({ ...form, distrito: e.target.value })}
                                        className="crm-form-control"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {DISTRITOS_AREQUIPA.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Georreferenciación */}
                        <div
                            style={{
                                background: 'var(--color-bg-alt, #f8fafc)',
                                padding: '0.875rem 1rem',
                                borderRadius: '0.625rem',
                                border: '1px solid var(--color-border-light, #e2e8f0)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text, #0f172a)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="bi bi-pin-map-fill" style={{ color: 'var(--color-primary, #007BFF)' }}></i>
                                    Ubicación Georreferenciada (Mapa)
                                </span>
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                    onClick={handleGetCurrentLocation}
                                    disabled={isLocating}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', minHeight: '30px' }}
                                >
                                    <i className="bi bi-crosshair"></i> {isLocating ? 'Obteniendo GPS...' : 'Mi Ubicación GPS'}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label className="crm-form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', marginBottom: '0.25rem' }}>
                                        Latitud
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="-16.409047"
                                        value={form.latitud}
                                        onChange={(e) => setForm({ ...form, latitud: e.target.value })}
                                        className="crm-form-control crm-form-control-sm"
                                        style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}
                                    />
                                </div>
                                <div>
                                    <label className="crm-form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', marginBottom: '0.25rem' }}>
                                        Longitud
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="-71.537451"
                                        value={form.longitud}
                                        onChange={(e) => setForm({ ...form, longitud: e.target.value })}
                                        className="crm-form-control crm-form-control-sm"
                                        style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Observaciones Comerciales */}
                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">
                                Observaciones Comerciales / Datos del Odontólogo
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Ej. Dr. Mario Ramos, especialista en prótesis. Visitar de preferencia por las tardes."
                                value={form.notas}
                                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                                className="crm-form-control"
                            />
                        </div>
                    </div>

                    <div className="crm-modal-footer">
                        <button
                            type="button"
                            className="crm-btn crm-btn-secondary"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="crm-btn crm-btn-primary"
                            disabled={isPending}
                        >
                            {isPending ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-lg"></i>
                                    <span>{isEdit ? 'Guardar Cambios' : 'Guardar Prospecto'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default EstablishmentModal;
