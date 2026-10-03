import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useCrmMutations, useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
import CustomSelect from '../../../components/CustomSelect.jsx';
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

const TIPO_OPTIONS = [
    { value: 'clinica', label: 'Clínica Dental', icon: 'bi-hospital-fill' },
    { value: 'odontologo', label: 'Consultorio Particular', icon: 'bi-person-badge' },
    { value: 'consultorio', label: 'Consultorio Odontológico', icon: 'bi-building' },
    { value: 'otro', label: 'Otro Establecimiento', icon: 'bi-geo-alt' },
];

const DISTRITO_OPTIONS = [
    { value: '', label: 'Seleccionar distrito...' },
    ...DISTRITOS_AREQUIPA.map((d) => ({ value: d, label: d })),
];

export const EstablishmentModal = ({
    establishment = null,
    initialCoords = null,
    onClose,
    onCreated,
    onSaved,
}) => {
    const navigate = useNavigate();
    const { createEstablecimiento, updateEstablecimiento, isPending } = useCrmMutations();
    const isEdit = Boolean(establishment?.id);

    const handleGoToMapToLocate = () => {
        onClose();
        navigate(`/crm/mapa?asignarId=${establishment.id}&nombre=${encodeURIComponent(establishment.nombre)}`);
    };

    // Si viene de un clic en el mapa y no es edición, permitimos elegir entre crear o vincular
    const [activeTab, setActiveTab] = useState('crear'); // 'crear' | 'vincular'
    const [selectedClinicId, setSelectedClinicId] = useState('');
    const [searchExisting, setSearchExisting] = useState('');
    const [vincularLoading, setVincularLoading] = useState(false);

    // Cartera de establecimientos existentes para vincular ubicación
    const { data: establishmentsData, isLoading: loadingExisting } = useCrmEstablecimientosQuery({
        limit: 500,
    });
    const existingClinics = establishmentsData?.rows || [];

    const filteredExistingClinics = existingClinics.filter((c) => {
        if (!searchExisting) return true;
        const q = searchExisting.toLowerCase();
        return (
            (c.nombre && c.nombre.toLowerCase().includes(q)) ||
            (c.direccion && c.direccion.toLowerCase().includes(q)) ||
            (c.telefono && c.telefono.includes(q))
        );
    });

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

    const handleCreateSubmit = async (e) => {
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
                toast.success(`Establecimiento "${cleanNombre}" registrado exitosamente.`);
                onCreated && onCreated(result);
            }
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al guardar.');
        }
    };

    const handleVincularSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClinicId) {
            toast.error('Por favor selecciona una clínica o consultorio para asignar la ubicación.');
            return;
        }
        setVincularLoading(true);
        try {
            const lat = form.latitud ? parseFloat(form.latitud) : null;
            const lng = form.longitud ? parseFloat(form.longitud) : null;
            const target = existingClinics.find((c) => String(c.id) === String(selectedClinicId));

            const result = await updateEstablecimiento({
                id: Number(selectedClinicId),
                payload: { latitud: lat, longitud: lng },
            });
            toast.success(`Ubicación asignada a "${target?.nombre || 'Clínica'}" exitosamente.`);
            onSaved && onSaved(result);
            onCreated && onCreated(result);
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al asignar ubicación.');
        } finally {
            setVincularLoading(false);
        }
    };

    const hasMapCoords = Boolean(form.latitud && form.longitud);

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', overflow: 'hidden' }}>
                <div className="crm-modal-header" style={{ borderBottom: (!isEdit && initialCoords) ? 'none' : undefined }}>
                    <div className="crm-modal-header-main">
                        <div className="crm-modal-avatar-badge" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                            <i className={`bi ${form.tipo === 'clinica' ? 'bi-hospital-fill' : 'bi-building'}`}></i>
                        </div>
                        <div className="crm-modal-header-text">
                            <div className="crm-modal-kicker">CRM • {isEdit ? 'EDICIÓN COMERCIAL' : (initialCoords ? 'PUNTO EN MAPA' : 'PROSPECCIÓN Y CARTERA')}</div>
                            <h2 className="crm-modal-title">
                                {isEdit
                                    ? 'Editar Establecimiento / Prospecto'
                                    : (activeTab === 'vincular' ? 'Vincular Ubicación a Clínica' : 'Registrar Establecimiento')}
                            </h2>
                            <p className="crm-modal-subtitle">
                                {isEdit
                                    ? 'Actualiza los datos de contacto, dirección y notas comerciales'
                                    : (activeTab === 'vincular'
                                        ? 'Asigna estas coordenadas del mapa a una clínica existente'
                                        : 'Registra un consultorio, clínica o prospecto en este punto')}
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

                {/* Selector de Pestañas: Crear vs Vincular (solo cuando se abre desde un clic en el mapa) */}
                {!isEdit && initialCoords && (
                    <div style={{
                        display: 'flex',
                        background: 'var(--color-bg-alt, #f8fafc)',
                        borderBottom: '1px solid var(--color-border, #e2e8f0)',
                        padding: '0.35rem 1.25rem 0',
                        gap: '0.5rem',
                    }}>
                        <button
                            type="button"
                            className={`btn btn-sm ${activeTab === 'crear' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                borderRadius: '6px 6px 0 0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 600,
                                fontSize: '0.8125rem',
                                padding: '0.45rem 0.85rem',
                            }}
                            onClick={() => setActiveTab('crear')}
                        >
                            <i className="bi bi-plus-circle"></i> Crear Nuevo Establecimiento
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${activeTab === 'vincular' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                borderRadius: '6px 6px 0 0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 600,
                                fontSize: '0.8125rem',
                                padding: '0.45rem 0.85rem',
                            }}
                            onClick={() => setActiveTab('vincular')}
                        >
                            <i className="bi bi-link-45deg"></i> Vincular a Clínica Existente
                        </button>
                    </div>
                )}

                {/* CONTENIDO SEGÚN PESTAÑA */}
                {activeTab === 'vincular' && !isEdit && initialCoords ? (
                    <form onSubmit={handleVincularSubmit} style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
                        <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {/* Banner de Coordenadas Capturadas */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '8px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="bi bi-geo-alt-fill text-primary" style={{ fontSize: '1.25rem' }}></i>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary, #0f172a)' }}>
                                            Punto seleccionado en el mapa
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', fontFamily: 'monospace' }}>
                                            Lat: {parseFloat(form.latitud).toFixed(6)}, Lng: {parseFloat(form.longitud).toFixed(6)}
                                        </div>
                                    </div>
                                </div>
                                <span className="badge badge-primary">GPS Capturado</span>
                            </div>

                            {/* Buscador de clínica existente */}
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">
                                    Buscar Clínica o Consultorio en Cartera
                                </label>
                                <div className="crm-search-input-wrap" style={{ width: '100%' }}>
                                    <i className="bi bi-search"></i>
                                    <input
                                        type="text"
                                        className="crm-search-input"
                                        placeholder="Escribe el nombre, dirección o teléfono..."
                                        value={searchExisting}
                                        onChange={(e) => setSearchExisting(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            {/* Lista de clínicas disponibles para vincular */}
                            <div style={{
                                maxHeight: '240px',
                                overflowY: 'auto',
                                border: '1px solid var(--color-border, #e2e8f0)',
                                borderRadius: '8px',
                                padding: '4px',
                                background: 'var(--color-bg, #ffffff)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                            }}>
                                {loadingExisting ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                        <div style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>Cargando clínicas...</div>
                                    </div>
                                ) : filteredExistingClinics.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.8125rem' }}>
                                        No se encontraron clínicas con ese criterio de búsqueda.
                                    </div>
                                ) : (
                                    filteredExistingClinics.map((c) => {
                                        const isSelected = String(c.id) === String(selectedClinicId);
                                        const hasCoords = Boolean(c.latitud && c.longitud);

                                        return (
                                            <div
                                                key={c.id}
                                                onClick={() => setSelectedClinicId(String(c.id))}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    border: isSelected ? '1.5px solid var(--color-primary, #0284c7)' : '1px solid transparent',
                                                    background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                    <input
                                                        type="radio"
                                                        name="clinic_link_selection"
                                                        checked={isSelected}
                                                        onChange={() => setSelectedClinicId(String(c.id))}
                                                        style={{ accentColor: 'var(--color-primary, #0284c7)', cursor: 'pointer' }}
                                                    />
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {c.nombre}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {c.direccion || 'Sin dirección registrada'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                                                    {hasCoords ? (
                                                        <span className="badge badge-enviado" style={{ fontSize: '0.7rem' }}>
                                                            Reubicar
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-advertencia" style={{ fontSize: '0.7rem' }}>
                                                            Sin mapa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="crm-modal-footer">
                            <button
                                type="button"
                                className="crm-btn crm-btn-secondary"
                                onClick={onClose}
                                disabled={vincularLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="crm-btn crm-btn-primary"
                                disabled={vincularLoading || !selectedClinicId}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                {vincularLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                        <span>Asignando...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-geo-alt-fill"></i>
                                        <span>Asignar Ubicación a esta Clínica</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* FORMULARIO DE REGISTRO NUEVO / EDICIÓN */
                    <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
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
                                    <CustomSelect
                                        value={form.tipo}
                                        onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                                        options={TIPO_OPTIONS}
                                    />
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
                                    <CustomSelect
                                        value={form.distrito}
                                        onChange={(e) => setForm({ ...form, distrito: e.target.value })}
                                        options={DISTRITO_OPTIONS}
                                        placeholder="Seleccionar..."
                                    />
                                </div>
                            </div>

                            {/* Georreferenciación sin inputs manuales */}
                            <div
                                style={{
                                    background: hasMapCoords ? 'rgba(16, 185, 129, 0.05)' : 'var(--color-bg-alt, #f8fafc)',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '0.625rem',
                                    border: hasMapCoords ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--color-border-light, #e2e8f0)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="bi bi-pin-map-fill" style={{ color: hasMapCoords ? '#10b981' : 'var(--color-primary, #007BFF)', fontSize: '1.2rem' }}></i>
                                        <div>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                                                Ubicación en el Mapa
                                            </div>
                                            {hasMapCoords ? (
                                                <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500 }}>
                                                    Coordenadas fijadas en Arequipa
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary, #64748b)' }}>
                                                    Sin ubicación asignada
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {isEdit && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-primary"
                                                onClick={handleGoToMapToLocate}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                                title="Ir al mapa territorial para marcar el punto con un clic"
                                            >
                                                <i className="bi bi-map"></i>
                                                {hasMapCoords ? 'Reubicar en el Mapa' : 'Marcar en el Mapa'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="crm-btn crm-btn-secondary crm-btn-sm"
                                            onClick={handleGetCurrentLocation}
                                            disabled={isLocating}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', minHeight: '30px' }}
                                            title="Capturar coordenadas del GPS de tu dispositivo"
                                        >
                                            <i className="bi bi-crosshair"></i> {isLocating ? 'Obteniendo GPS...' : 'Mi Ubicación GPS'}
                                        </button>
                                        {hasMapCoords && (
                                            <button
                                                type="button"
                                                className="crm-btn crm-btn-ghost crm-btn-sm text-danger"
                                                onClick={() => setForm((prev) => ({ ...prev, latitud: '', longitud: '' }))}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: '30px' }}
                                                title="Quitar ubicación"
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {hasMapCoords && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--color-text-secondary, #64748b)',
                                        fontFamily: 'var(--font-mono, monospace)',
                                        background: 'rgba(0, 0, 0, 0.03)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <i className="bi bi-geo"></i>
                                        <span>Lat: {parseFloat(form.latitud).toFixed(6)} | Lng: {parseFloat(form.longitud).toFixed(6)}</span>
                                    </div>
                                )}
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
                                        <span>{isEdit ? 'Guardar Cambios' : 'Registrar Establecimiento'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

export default EstablishmentModal;
