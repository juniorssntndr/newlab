import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCrmMutations, useCrmClinicasQuery } from '../queries/useCrmQueries.js';
import { consultarDNI } from '../../identity/api/identityApi.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import toast from 'react-hot-toast';

const ESPECIALIDADES_DENTALES = [
    'Odontología General',
    'Ortodoncia y Ortopedia Maxilar',
    'Endodoncia',
    'Rehabilitación Oral / Prótesis',
    'Periodoncia e Implantología',
    'Cirugía Bucal y Maxilofacial',
    'Odontopediatría',
    'Estética Dental',
    'Radiología Bucal y Maxilofacial',
    'Otra',
];

export const DoctorModal = ({ doctor, onClose, onSaved }) => {
    const { getHeaders } = useAuth();
    const { createDoctor, updateDoctor, updateDoctorClinicas, isPending } = useCrmMutations();
    const { data: clinicasData = [], isLoading: isLoadingClinicas } = useCrmClinicasQuery();
    const clinicas = Array.isArray(clinicasData) ? clinicasData : clinicasData?.rows || [];
    const [clinicSearch, setClinicSearch] = useState('');

    const filteredClinicas = useMemo(() => {
        if (!clinicSearch.trim()) return clinicas;
        const q = clinicSearch.toLowerCase();
        return clinicas.filter((c) =>
            (c.nombre && c.nombre.toLowerCase().includes(q)) ||
            (c.razon_social && c.razon_social.toLowerCase().includes(q)) ||
            (c.ruc && c.ruc.includes(q))
        );
    }, [clinicas, clinicSearch]);

    const isEdit = Boolean(doctor?.id);

    const [form, setForm] = useState({
        dni: doctor?.dni || '',
        nombre_completo: doctor?.nombre_completo || '',
        especialidad: doctor?.especialidad || 'Odontología General',
        cop: doctor?.cop || '',
        telefono: doctor?.telefono || '',
        email: doctor?.email || '',
        direccion: doctor?.direccion || '',
        fecha_nacimiento: doctor?.fecha_nacimiento
            ? new Date(doctor.fecha_nacimiento).toISOString().slice(0, 10)
            : '',
        clinicaIds: doctor?.clinicas ? doctor.clinicas.map((c) => c.id) : [],
    });

    const [isConsultingReniec, setIsConsultingReniec] = useState(false);

    const handleLookupReniec = async () => {
        const cleanDni = form.dni.trim();
        if (!cleanDni || cleanDni.length !== 8 || !/^\d{8}$/.test(cleanDni)) {
            toast.error('Ingresa un DNI de 8 dígitos para consultar RENIEC');
            return;
        }

        setIsConsultingReniec(true);
        try {
            const data = await consultarDNI({ dni: cleanDni, headers: getHeaders() });
            if (data?.fullName) {
                setForm((prev) => ({
                    ...prev,
                    nombre_completo: data.fullName,
                    direccion: data.direccion || prev.direccion,
                }));
                toast.success(`Datos obtenidos de RENIEC: ${data.fullName}`);
            } else {
                toast('DNI consultado pero sin datos de nombre.', { icon: 'ℹ️' });
            }
        } catch (err) {
            toast.error(err.message || 'No se pudo consultar RENIEC. Puedes ingresar el nombre manualmente.');
        } finally {
            setIsConsultingReniec(false);
        }
    };

    const handleClinicaToggle = (clinicaId) => {
        setForm((prev) => {
            const exists = prev.clinicaIds.includes(clinicaId);
            return {
                ...prev,
                clinicaIds: exists
                    ? prev.clinicaIds.filter((id) => id !== clinicaId)
                    : [...prev.clinicaIds, clinicaId],
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre_completo.trim()) {
            toast.error('El nombre completo es obligatorio');
            return;
        }
        if (!form.especialidad.trim()) {
            toast.error('La especialidad es obligatoria');
            return;
        }

        const payload = {
            ...form,
            nombre_completo: form.nombre_completo.trim(),
            dni: form.dni.trim() || null,
            cop: form.cop.trim() || null,
            telefono: form.telefono.trim() || null,
            email: form.email.trim() || null,
            direccion: form.direccion.trim() || null,
            fecha_nacimiento: form.fecha_nacimiento || null,
        };

        try {
            if (isEdit) {
                await updateDoctor({ id: doctor.id, payload });
                await updateDoctorClinicas({ id: doctor.id, clinicaIds: form.clinicaIds });
                toast.success('Doctor actualizado con éxito');
            } else {
                await createDoctor({ ...payload, clinicaIds: form.clinicaIds });
                toast.success('Doctor registrado con éxito');
            }
            onSaved && onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al guardar doctor');
        }
    };

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal crm-doctor-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="crm-modal-header">
                        <div className="crm-modal-header-main">
                            <div className="crm-modal-avatar-badge" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                                <i className="bi bi-person-badge-fill"></i>
                            </div>
                            <div className="crm-modal-header-text">
                                <div className="crm-modal-kicker">
                                    {isEdit ? 'Actualización de Perfil' : 'Registro de Profesional'}
                                </div>
                                <h2 className="crm-modal-title">
                                    {isEdit ? form.nombre_completo || 'Editar Doctor' : 'Nuevo Doctor'}
                                </h2>
                                <p className="crm-modal-subtitle">
                                    Alta ágil con especialidad requerida; DNI y RENIEC opcionales
                                </p>
                            </div>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose} aria-label="Cerrar">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="crm-modal-body">
                        {/* Section 1: Informacion Profesional */}
                        <div className="crm-form-section">
                            <h3 className="crm-form-section-title">
                                <i className="bi bi-mortarboard-fill text-primary"></i> Información Profesional
                            </h3>

                            {/* DNI & COP */}
                            <div className="crm-form-row-2col">
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">DNI (Opcional)</label>
                                    <div className="crm-input-action-group">
                                        <div className="form-input-box has-lead" style={{ flex: 1 }}>
                                            <i className="bi bi-person-vcard input-icon-lead"></i>
                                            <input
                                                type="text"
                                                className="crm-form-control"
                                                value={form.dni}
                                                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                                                placeholder="8 dígitos"
                                                maxLength={8}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="crm-btn crm-btn-secondary"
                                            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                            onClick={handleLookupReniec}
                                            disabled={isConsultingReniec || form.dni.length !== 8}
                                            title="Consultar nombre en RENIEC"
                                        >
                                            {isConsultingReniec ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '0.85rem', height: '0.85rem', marginRight: '0.25rem' }}></span>
                                                    Buscando...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-search"></i> RENIEC
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">Colegiatura COP (Opcional)</label>
                                    <div className="form-input-box has-lead">
                                        <i className="bi bi-award input-icon-lead"></i>
                                        <input
                                            type="text"
                                            className="crm-form-control"
                                            value={form.cop}
                                            onChange={(e) => setForm({ ...form, cop: e.target.value })}
                                            placeholder="Ej. 12345"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Nombre Completo */}
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Nombre Completo *</label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-person input-icon-lead"></i>
                                    <input
                                        type="text"
                                        className="crm-form-control"
                                        value={form.nombre_completo}
                                        onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                                        placeholder="Ej. Dr. Carlos Rodríguez Mendoza"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Especialidad */}
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Especialidad *</label>
                                <div className="form-input-box has-lead">
                                    <i className="bi bi-mortarboard input-icon-lead"></i>
                                    <select
                                        className="crm-form-control"
                                        value={form.especialidad}
                                        onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                                        required
                                    >
                                        {ESPECIALIDADES_DENTALES.map((esp) => (
                                            <option key={esp} value={esp}>
                                                {esp}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Contacto y Ubicación */}
                        <div className="crm-form-section">
                            <h3 className="crm-form-section-title">
                                <i className="bi bi-person-lines-fill text-primary"></i> Contacto y Datos Personales
                            </h3>

                            <div className="crm-form-row-2col">
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">Teléfono / WhatsApp</label>
                                    <div className="form-input-box has-lead">
                                        <i className="bi bi-telephone input-icon-lead"></i>
                                        <input
                                            type="text"
                                            className="crm-form-control"
                                            value={form.telefono}
                                            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                            placeholder="Ej. 999888777"
                                        />
                                    </div>
                                </div>
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">Email</label>
                                    <div className="form-input-box has-lead">
                                        <i className="bi bi-envelope input-icon-lead"></i>
                                        <input
                                            type="email"
                                            className="crm-form-control"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            placeholder="doctor@ejemplo.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="crm-form-row-2col">
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">Fecha de Cumpleaños</label>
                                    <div className="form-input-box has-lead">
                                        <i className="bi bi-calendar-event input-icon-lead"></i>
                                        <input
                                            type="date"
                                            className="crm-form-control"
                                            value={form.fecha_nacimiento}
                                            onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="crm-form-group" style={{ margin: 0 }}>
                                    <label className="crm-form-label">Dirección Particular / Consultorio</label>
                                    <div className="form-input-box has-lead">
                                        <i className="bi bi-geo-alt input-icon-lead"></i>
                                        <input
                                            type="text"
                                            className="crm-form-control"
                                            value={form.direccion}
                                            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                                            placeholder="Av. Principal 456, San Isidro"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Clínicas Cliente Asociadas */}
                        <div className="crm-form-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 className="crm-form-section-title" style={{ margin: 0 }}>
                                    <i className="bi bi-building-check text-primary"></i> Asociar a Clínicas Cliente (AFINIX LAB)
                                </h3>
                                <span className="crm-count-pill" style={{ background: '#dbeafe', color: '#1e40af' }}>
                                    {form.clinicaIds.length} seleccionada{form.clinicaIds.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            {/* Buscador en vivo de clínicas cliente */}
                            <div style={{ position: 'relative' }}>
                                <i className="bi bi-search" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.8125rem' }}></i>
                                <input
                                    type="text"
                                    className="crm-form-control crm-form-control-sm"
                                    style={{ paddingLeft: '2.25rem', paddingRight: '2rem' }}
                                    placeholder="Buscar clínica por nombre, razón social o RUC..."
                                    value={clinicSearch}
                                    onChange={(e) => setClinicSearch(e.target.value)}
                                />
                                {clinicSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setClinicSearch('')}
                                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px 6px' }}
                                        title="Limpiar búsqueda"
                                    >
                                        <i className="bi bi-x-circle-fill"></i>
                                    </button>
                                )}
                            </div>

                            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', background: '#f8fafc' }}>
                                {isLoadingClinicas ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0, padding: '0.5rem' }}>Cargando clínicas cliente...</p>
                                ) : filteredClinicas.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0, padding: '0.5rem' }}>
                                        {clinicSearch ? 'No se encontraron clínicas coincidentes con la búsqueda.' : 'No hay clínicas cliente registradas en el laboratorio.'}
                                    </p>
                                ) : (
                                    filteredClinicas.map((c) => {
                                        const isSelected = form.clinicaIds.includes(c.id);
                                        return (
                                            <label
                                                key={c.id}
                                                className={`crm-clinic-select-card${isSelected ? ' is-selected' : ''}`}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleClinicaToggle(c.id)}
                                                        style={{ accentColor: 'var(--color-primary, #007BFF)', width: '15px', height: '15px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontWeight: isSelected ? 600 : 400, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {c.nombre}
                                                    </span>
                                                </div>
                                                {c.ruc && (
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0, marginLeft: '8px' }}>
                                                        RUC {c.ruc}
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="crm-btn crm-btn-primary" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '0.85rem', height: '0.85rem', marginRight: '0.35rem' }}></span>
                                    Guardando...
                                </>
                            ) : isEdit ? (
                                <>
                                    <i className="bi bi-check2"></i> Actualizar
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-plus-lg"></i> Guardar Doctor
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

export default DoctorModal;
