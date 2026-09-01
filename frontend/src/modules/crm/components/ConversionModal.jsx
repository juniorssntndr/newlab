import React, { useState } from 'react';
import { useCrmMutations, useCrmDoctoresQuery } from '../queries/useCrmQueries.js';
import toast from 'react-hot-toast';

export const ConversionModal = ({ establishment, onClose, onConverted }) => {
    const { convertEstablecimiento, isPending } = useCrmMutations();
    const { data: doctores = [] } = useCrmDoctoresQuery();

    const [form, setForm] = useState({
        ruc: '',
        telefono: establishment?.telefono || '',
        email: establishment?.email || '',
        direccion: establishment?.direccion || '',
        razon_social: establishment?.nombre || '',
        doctor_ids: [],
        doctor_contacto_principal_id: '',
    });

    const handleDoctorToggle = (id) => {
        setForm((prev) => {
            const exists = prev.doctor_ids.includes(id);
            const next = exists ? prev.doctor_ids.filter((item) => item !== id) : [...prev.doctor_ids, id];
            let nextPrincipal = prev.doctor_contacto_principal_id;
            if (exists && String(prev.doctor_contacto_principal_id) === String(id)) {
                nextPrincipal = next[0] ? String(next[0]) : '';
            } else if (!exists && !nextPrincipal) {
                nextPrincipal = String(id);
            }
            return { ...prev, doctor_ids: next, doctor_contacto_principal_id: nextPrincipal };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Contact minimum check: clinic phone OR at least one linked doctor with phone
        const hasClinicPhone = Boolean(form.telefono && form.telefono.trim());
        const selectedDoctors = doctores.filter((d) => form.doctor_ids.includes(d.id));
        const hasDoctorWithPhone = selectedDoctors.some((d) => d.telefono && d.telefono.trim());

        if (!hasClinicPhone && !hasDoctorWithPhone) {
            toast.error('Se requiere un teléfono de la clínica o asociar al menos un doctor con teléfono registrado.');
            return;
        }

        if (form.ruc && !/^\d{11}$/.test(form.ruc.trim())) {
            toast.error('El RUC debe tener exactamente 11 dígitos numéricos');
            return;
        }

        try {
            await convertEstablecimiento({
                id: establishment.id,
                payload: {
                    ruc: form.ruc.trim() || null,
                    telefono: form.telefono.trim() || null,
                    email: form.email.trim() || null,
                    direccion: form.direccion.trim() || null,
                    razon_social: form.razon_social.trim() || null,
                    doctor_ids: form.doctor_ids,
                    doctor_contacto_principal_id: form.doctor_contacto_principal_id
                        ? Number(form.doctor_contacto_principal_id)
                        : null,
                },
            });
            toast.success('¡Prospecto convertido a cliente con éxito!');
            onConverted && onConverted();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error en la conversión');
        }
    };

    return (
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#059669' }}>
                                <i className="bi bi-arrow-repeat" style={{ marginRight: '0.375rem' }}></i>
                                Convertir Prospecto a Cliente
                            </h2>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.125rem 0 0 0' }}>
                                {establishment?.nombre}
                            </p>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body">
                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#065f46' }}>
                            La conversión crea la entidad comercial <strong>nl_clinicas</strong> habilitada para pedidos y facturación, conservando las coordenadas geográficas, historial de visitas y responsable.
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">RUC (Opcional)</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.ruc}
                                onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                                placeholder="11 dígitos numéricos"
                                maxLength={11}
                            />
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Teléfono de la Clínica</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.telefono}
                                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                placeholder="Ej. 987654321"
                            />
                            <div className="crm-form-hint">
                                Si no dispone de teléfono propio, asocie abajo un doctor que sí tenga teléfono.
                            </div>
                        </div>

                        <div className="crm-form-group">
                            <label className="crm-form-label">Razón Social o Nombre Facturación</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.razon_social}
                                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                            />
                        </div>

                        {/* Associating doctors */}
                        <div className="crm-form-group">
                            <label className="crm-form-label">Asociar Doctores al Establecimiento</label>
                            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.5rem' }}>
                                {doctores.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>No hay doctores registrados aún.</p>
                                ) : (
                                    doctores.map((d) => {
                                        const isSelected = form.doctor_ids.includes(d.id);
                                        return (
                                            <div
                                                key={d.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0.375rem 0.5rem',
                                                    borderBottom: '1px solid #f1f5f9',
                                                }}
                                            >
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleDoctorToggle(d.id)}
                                                    />
                                                    <span>{d.nombre_completo} ({d.especialidad})</span>
                                                </label>
                                                {isSelected && (
                                                    <button
                                                        type="button"
                                                        className="crm-btn crm-btn-secondary crm-btn-sm"
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            background: String(form.doctor_contacto_principal_id) === String(d.id) ? '#dcfce7' : '',
                                                        }}
                                                        onClick={() => setForm({ ...form, doctor_contacto_principal_id: String(d.id) })}
                                                    >
                                                        {String(form.doctor_contacto_principal_id) === String(d.id) ? '★ Principal' : 'Hacer Principal'}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="crm-btn crm-btn-success" disabled={isPending}>
                            {isPending ? 'Convirtiendo...' : 'Confirmar Conversión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConversionModal;
