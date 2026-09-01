import React, { useState } from 'react';
import { useCrmMutations, useCrmEstablecimientosQuery } from '../queries/useCrmQueries.js';
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
    const { createDoctor, updateDoctor, isPending } = useCrmMutations();
    const { data: estData } = useCrmEstablecimientosQuery({ limit: 100 });
    const clinicas = estData?.rows || [];

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
                toast.success('Doctor actualizado con éxito');
            } else {
                await createDoctor(payload);
                toast.success('Doctor registrado con éxito');
            }
            onSaved && onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error al guardar doctor');
        }
    };

    return (
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                                {isEdit ? 'Editar Doctor' : 'Nuevo Doctor'}
                            </h2>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.125rem 0 0 0' }}>
                                Alta ágil con especialidad requerida; DNI y RENIEC opcionales
                            </p>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body">
                        {/* DNI & Reniec Check */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">DNI (Opcional)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.dni}
                                    onChange={(e) => setForm({ ...form, dni: e.target.value })}
                                    placeholder="8 dígitos numéricos"
                                    maxLength={8}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="crm-btn crm-btn-secondary"
                                    onClick={handleLookupReniec}
                                    disabled={isConsultingReniec || form.dni.length !== 8}
                                >
                                    {isConsultingReniec ? 'Buscando...' : 'Consultar RENIEC'}
                                </button>
                            </div>
                        </div>

                        {/* Name */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">Nombre Completo *</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.nombre_completo}
                                onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                                placeholder="Ej. Dr. Carlos Rodríguez Mendoza"
                                required
                            />
                        </div>

                        {/* Specialty */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">Especialidad *</label>
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

                        {/* Phone & COP */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group">
                                <label className="crm-form-label">Teléfono / WhatsApp</label>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.telefono}
                                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="Ej. 999888777"
                                />
                            </div>
                            <div className="crm-form-group">
                                <label className="crm-form-label">Colegiatura COP (Opcional)</label>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.cop}
                                    onChange={(e) => setForm({ ...form, cop: e.target.value })}
                                    placeholder="Ej. 12345"
                                />
                            </div>
                        </div>

                        {/* Email & Birthday */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group">
                                <label className="crm-form-label">Email</label>
                                <input
                                    type="email"
                                    className="crm-form-control"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="doctor@ejemplo.com"
                                />
                            </div>
                            <div className="crm-form-group">
                                <label className="crm-form-label">Fecha de Cumpleaños</label>
                                <input
                                    type="date"
                                    className="crm-form-control"
                                    value={form.fecha_nacimiento}
                                    onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">Dirección Particular / Consultorio</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.direccion}
                                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                                placeholder="Av. Principal 456, San Isidro"
                            />
                        </div>

                        {/* Associated clinics */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">Asociar a Clínicas / Consultorios</label>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.5rem' }}>
                                {clinicas.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>Cargando clínicas...</p>
                                ) : (
                                    clinicas.map((c) => (
                                        <label
                                            key={c.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.25rem 0',
                                                cursor: 'pointer',
                                                fontSize: '0.8125rem',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.clinicaIds.includes(c.id)}
                                                onChange={() => handleClinicaToggle(c.id)}
                                            />
                                            <span>{c.nombre}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="crm-btn crm-btn-primary" disabled={isPending}>
                            {isPending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Guardar Doctor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DoctorModal;
