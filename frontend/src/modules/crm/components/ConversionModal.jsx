import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCrmMutations, useCrmDoctoresQuery } from '../queries/useCrmQueries.js';
import { consultarRUC, consultarDNI } from '../../identity/api/identityApi.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import toast from 'react-hot-toast';

export const ConversionModal = ({ establishment, onClose, onConverted }) => {
    const { getHeaders } = useAuth();
    const { convertEstablecimiento, isPending } = useCrmMutations();
    const { data: doctores = [] } = useCrmDoctoresQuery();

    const [tipoDoc, setTipoDoc] = useState('ruc'); // 'ruc' | 'dni'
    const [numDoc, setNumDoc] = useState('');
    const [isConsulting, setIsConsulting] = useState(false);
    const [fiscalBadge, setFiscalBadge] = useState(null);

    const [form, setForm] = useState({
        nombre: establishment?.nombre || '',
        razon_social: establishment?.nombre || '',
        telefono: establishment?.telefono || '',
        email: establishment?.email || '',
        direccion: establishment?.direccion || '',
        contacto_nombre: '',
        doctor_ids: [],
        doctor_contacto_principal_id: '',
    });

    const handleLookup = async () => {
        const clean = numDoc.trim().replace(/\D/g, '');
        if (tipoDoc === 'ruc') {
            if (clean.length !== 11) {
                toast.error('El RUC debe tener exactamente 11 dígitos.');
                return;
            }
            setIsConsulting(true);
            try {
                const data = await consultarRUC({ ruc: clean, headers: getHeaders() });
                if (data) {
                    const rSocial = data.razonSocial || data.razon_social || data.nombre || '';
                    const dir = data.direccion || '';
                    setForm((prev) => ({
                        ...prev,
                        razon_social: rSocial || prev.razon_social,
                        direccion: dir || prev.direccion,
                    }));
                    setFiscalBadge({
                        estado: data.estado || 'ACTIVO',
                        condicion: data.condicion || 'HABIDO',
                    });
                    toast.success(`Datos de SUNAT obtenidos: ${rSocial}`);
                }
            } catch (err) {
                toast.error(err.message || 'No se pudo consultar el RUC en SUNAT.');
            } finally {
                setIsConsulting(false);
            }
        } else {
            if (clean.length !== 8) {
                toast.error('El DNI debe tener exactamente 8 dígitos.');
                return;
            }
            setIsConsulting(true);
            try {
                const data = await consultarDNI({ dni: clean, headers: getHeaders() });
                if (data?.fullName) {
                    setForm((prev) => ({
                        ...prev,
                        razon_social: data.fullName,
                        contacto_nombre: prev.contacto_nombre || data.fullName,
                        direccion: data.direccion || prev.direccion,
                    }));
                    setFiscalBadge({ estado: 'RENIEC', condicion: 'VALIDADO' });
                    toast.success(`Datos de RENIEC obtenidos: ${data.fullName}`);
                }
            } catch (err) {
                toast.error(err.message || 'No se pudo consultar el DNI en RENIEC.');
            } finally {
                setIsConsulting(false);
            }
        }
    };

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

        // Check required contact phone
        const hasClinicPhone = Boolean(form.telefono && form.telefono.trim());
        const selectedDoctors = doctores.filter((d) => form.doctor_ids.includes(d.id));
        const hasDoctorWithPhone = selectedDoctors.some((d) => d.telefono && d.telefono.trim());

        if (!hasClinicPhone && !hasDoctorWithPhone) {
            toast.error('Se requiere un teléfono de contacto o asociar un doctor con teléfono registrado.');
            return;
        }

        const cleanDoc = numDoc.trim().replace(/\D/g, '');
        const ruc = tipoDoc === 'ruc' && cleanDoc ? cleanDoc : null;
        const dni = tipoDoc === 'dni' && cleanDoc ? cleanDoc : null;

        if (ruc && ruc.length !== 11) {
            toast.error('El RUC debe tener exactamente 11 dígitos.');
            return;
        }
        if (dni && dni.length !== 8) {
            toast.error('El DNI debe tener exactamente 8 dígitos.');
            return;
        }

        try {
            await convertEstablecimiento({
                id: establishment.id,
                payload: {
                    nombre: form.nombre.trim() || establishment.nombre,
                    razon_social: form.razon_social.trim() || null,
                    ruc,
                    dni,
                    telefono: form.telefono.trim() || null,
                    email: form.email.trim() || null,
                    direccion: form.direccion.trim() || null,
                    contacto_nombre: form.contacto_nombre.trim() || null,
                    doctor_ids: form.doctor_ids,
                    doctor_contacto_principal_id: form.doctor_contacto_principal_id
                        ? Number(form.doctor_contacto_principal_id)
                        : null,
                },
            });
            toast.success('¡Prospecto convertido a cliente activo con éxito!');
            onConverted && onConverted();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error en la conversión');
        }
    };

    return createPortal(
        <div className="crm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="crm-modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="crm-modal-header">
                        <div>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-primary, #0284c7)' }}>
                                <i className="bi bi-person-check-fill" style={{ marginRight: '0.375rem' }}></i>
                                Convertir Prospecto a Cliente Activo
                            </h2>
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.125rem 0 0 0' }}>
                                {establishment?.nombre}
                            </p>
                        </div>
                        <button type="button" className="crm-btn crm-btn-secondary crm-btn-icon" onClick={onClose}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="crm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.8125rem', color: '#0369a1' }}>
                            <i className="bi bi-info-circle-fill" style={{ marginRight: '6px' }}></i>
                            Al convertir, se creará el cliente oficial en <strong>AFINIX LAB</strong> para emitirle órdenes de trabajo y facturación.
                        </div>

                        {/* Document & SUNAT lookup */}
                        <div className="card" style={{ padding: '0.875rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>Documento Fiscal (Opcional):</span>
                                <label style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="radio" name="tipoDoc" value="ruc" checked={tipoDoc === 'ruc'} onChange={() => { setTipoDoc('ruc'); setFiscalBadge(null); }} /> RUC (11 dígitos)
                                </label>
                                <label style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}>
                                    <input type="radio" name="tipoDoc" value="dni" checked={tipoDoc === 'dni'} onChange={() => { setTipoDoc('dni'); setFiscalBadge(null); }} /> DNI (8 dígitos)
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={numDoc}
                                    onChange={(e) => setNumDoc(e.target.value)}
                                    placeholder={tipoDoc === 'ruc' ? 'Ej. 20608941231' : 'Ej. 45892134'}
                                    maxLength={tipoDoc === 'ruc' ? 11 : 8}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleLookup}
                                    disabled={isConsulting || !numDoc.trim()}
                                    style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                                >
                                    {isConsulting ? (
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                    ) : (
                                        <i className="bi bi-search"></i>
                                    )}
                                    {tipoDoc === 'ruc' ? 'Consultar SUNAT' : 'Consultar RENIEC'}
                                </button>
                            </div>

                            {fiscalBadge && (
                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem' }}>
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                                        {fiscalBadge.estado}
                                    </span>
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                        {fiscalBadge.condicion}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Name & Business Name */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Nombre Comercial *</label>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Razón Social</label>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.razon_social}
                                    onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                                    placeholder="Nombre para facturación"
                                />
                            </div>
                        </div>

                        {/* Phone & Email */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Teléfono de Contacto</label>
                                <input
                                    type="text"
                                    className="crm-form-control"
                                    value={form.telefono}
                                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="Ej. 987654321"
                                />
                            </div>
                            <div className="crm-form-group" style={{ margin: 0 }}>
                                <label className="crm-form-label">Correo Electrónico</label>
                                <input
                                    type="email"
                                    className="crm-form-control"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="contacto@clinica.pe"
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">Dirección Fiscal / Sede</label>
                            <input
                                type="text"
                                className="crm-form-control"
                                value={form.direccion}
                                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                                placeholder="Dirección completa"
                            />
                        </div>

                        {/* Associating doctors */}
                        <div className="crm-form-group" style={{ margin: 0 }}>
                            <label className="crm-form-label">Doctores Asociados a esta Clínica</label>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0.35rem 0.5rem' }}>
                                {doctores.length === 0 ? (
                                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem' }}>No hay doctores en el directorio.</p>
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
                                                    padding: '0.3rem 0.5rem',
                                                    borderBottom: '1px solid #f1f5f9',
                                                }}
                                            >
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', margin: 0 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleDoctorToggle(d.id)}
                                                    />
                                                    <span>{d.nombre_completo} {d.especialidad ? `(${d.especialidad})` : ''}</span>
                                                </label>
                                                {isSelected && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            padding: '0.15rem 0.5rem',
                                                            background: String(form.doctor_contacto_principal_id) === String(d.id) ? '#dcfce7' : '',
                                                            borderColor: String(form.doctor_contacto_principal_id) === String(d.id) ? '#86efac' : '',
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
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={isPending}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending} style={{ fontWeight: 600 }}>
                            {isPending ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check2-circle"></i> Confirmar y Convertir a Cliente
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

export default ConversionModal;
