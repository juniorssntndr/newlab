import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import { ModalPagoMasivo } from '../components/ModalPagoMasivo.jsx';
import { API_URL } from '../config.js';
import { previewRUC, confirmClinica } from '../modules/identity/api/identityApi.js';
import { toast } from 'react-hot-toast';

// Estado fiscal seguro para uso tributario
const isRucApto = (preview) => {
    if (!preview) return true; // sin preview, no bloqueamos
    const estadoOk = !preview.estado || String(preview.estado).toUpperCase().includes('ACTIVO');
    const condicionOk = !preview.condicion || String(preview.condicion).toUpperCase().includes('HABIDO');
    return estadoOk && condicionOk;
};

const FORM_EMPTY = {
    nombre: '',
    razon_social: '',
    ruc: '',
    email: '',
    telefono: '',
    direccion: '',
    contacto_nombre: '',
};

const Clinicas = () => {
    const { getHeaders } = useAuth();
    const [clinicas, setClinicas] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(FORM_EMPTY);

    // Flujo RUC-first (solo en crear)
    const [step, setStep] = useState('ruc'); // 'ruc' | 'preview' | 'form'
    const [rucInput, setRucInput] = useState('');
    const [rucLoading, setRucLoading] = useState(false);
    const [rucPreview, setRucPreview] = useState(null); // datos de SUNAT
    const [rucWarning, setRucWarning] = useState(''); // advertencia fiscal
    const [saving, setSaving] = useState(false);

    // Mass payment modal state
    const [massPaymentModalOpen, setMassPaymentModalOpen] = useState(false);
    const [selectedClinica, setSelectedClinica] = useState(null);

    const fetchClinicas = () => {
        setLoading(true);
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        fetch(`${API_URL}/clinicas${params}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setClinicas(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchClinicas(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    const openNew = () => {
        setEditing(null);
        setRucInput('');
        setRucPreview(null);
        setRucWarning('');
        setForm(FORM_EMPTY);
        setStep('ruc');
        setModalOpen(true);
    };

    const openEdit = (c) => {
        setEditing(c);
        setRucPreview(null);
        setRucWarning('');
        setForm({
            nombre: c.nombre || '',
            razon_social: c.razon_social || '',
            ruc: c.ruc || '',
            email: c.email || '',
            telefono: c.telefono || '',
            direccion: c.direccion || '',
            contacto_nombre: c.contacto_nombre || '',
        });
        setStep('form'); // edición siempre va directo al formulario
        setModalOpen(true);
    };

    // Paso 1: Consultar RUC en SUNAT
    const handleConsultarRUC = async () => {
        const ruc = rucInput.trim().replace(/\D/g, '');
        if (ruc.length !== 11) {
            toast.error('El RUC debe tener 11 dígitos.');
            return;
        }
        setRucLoading(true);
        setRucWarning('');
        try {
            const data = await previewRUC({ ruc, headers: getHeaders() });
            const preview = {
                ruc,
                razon_social: data.razonSocial || data.razon_social || data.nombre || '',
                estado: data.estado || '',
                condicion: data.condicion || '',
                direccion: data.direccion || '',
                ubigeo: data.ubigeo || '',
            };
            setRucPreview(preview);

            if (!isRucApto(preview)) {
                setRucWarning(
                    `Este RUC figura como ${preview.estado || '?'} / ${preview.condicion || '?'} en SUNAT. ` +
                    `Puedes guardar la clínica pero no será apta para emisión fiscal hasta regularizar.`
                );
            }
            setStep('preview');
        } catch (err) {
            toast.error(err.message || 'No se pudo consultar el RUC en SUNAT.');
        } finally {
            setRucLoading(false);
        }
    };

    // Paso 2: Confirmar y guardar (vía preview)
    const handleConfirmRUC = async () => {
        if (!rucPreview) return;
        setSaving(true);
        try {
            await confirmClinica({
                ruc: rucPreview.ruc,
                overrides: {
                    nombre: rucPreview.razon_social,
                    razon_social: rucPreview.razon_social,
                    direccion: rucPreview.direccion,
                },
                headers: getHeaders(),
            });
            setModalOpen(false);
            toast.success('Clínica registrada correctamente.');
            fetchClinicas();
        } catch (err) {
            toast.error(err.message || 'Error al guardar la clínica.');
        } finally {
            setSaving(false);
        }
    };

    // Guardar edición o nueva con formulario manual
    const save = async () => {
        setSaving(true);
        try {
            const method = editing ? 'PUT' : 'POST';
            const url = editing ? `${API_URL}/clinicas/${editing.id}` : `${API_URL}/clinicas`;
            const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(form) });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }
            setModalOpen(false);
            toast.success(editing ? 'Clínica actualizada.' : 'Clínica creada.');
            fetchClinicas();
        } catch (err) {
            toast.error(err.message || 'Error al guardar la clínica.');
        } finally {
            setSaving(false);
        }
    };

    // Re-validar RUC desde edición
    const handleRevalidarRUC = async () => {
        const ruc = form.ruc.trim().replace(/\D/g, '');
        if (ruc.length !== 11) {
            toast.error('Ingresa un RUC de 11 dígitos primero.');
            return;
        }
        setRucLoading(true);
        try {
            const data = await previewRUC({ ruc, headers: getHeaders() });
            const preview = {
                ruc,
                razon_social: data.razonSocial || data.razon_social || data.nombre || '',
                estado: data.estado || '',
                condicion: data.condicion || '',
                direccion: data.direccion || '',
            };
            setForm(p => ({
                ...p,
                razon_social: preview.razon_social || p.razon_social,
                direccion: preview.direccion || p.direccion,
            }));
            if (!isRucApto(preview)) {
                setRucWarning(`RUC ${preview.estado} / ${preview.condicion} — no apto para emisión fiscal.`);
            } else {
                setRucWarning('');
                toast.success('RUC verificado correctamente.');
            }
        } catch (err) {
            toast.error(err.message || 'No se pudo consultar el RUC.');
        } finally {
            setRucLoading(false);
        }
    };

    const openMassPayment = (c) => {
        setSelectedClinica(c);
        setMassPaymentModalOpen(true);
    };

    const modalTitle = editing
        ? 'Editar Clínica'
        : step === 'ruc'
            ? 'Nueva Clínica — Consultar RUC'
            : step === 'preview'
                ? 'Nueva Clínica — Confirmar datos'
                : 'Nueva Clínica';

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Clientes / CRM</h1>
                    <p>Gestión de clínicas y odontólogos</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <i className="bi bi-plus-lg"></i> Nueva Clínica
                </button>
            </div>

            <div className="card">
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder="Buscar por nombre, razón social o RUC..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
                    </div>
                ) : clinicas.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-building empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin clínicas registradas</h3>
                        <p className="empty-state-text">Agrega tu primera clínica para empezar a recibir pedidos</p>
                        <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={openNew}>
                            <i className="bi bi-plus-lg"></i> Agregar Clínica
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="data-table-wrapper desktop-only">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Clínica</th>
                                        <th>RUC</th>
                                        <th>Contacto</th>
                                        <th>Teléfono</th>
                                        <th>Estado</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clinicas.map(c => (
                                        <tr key={c.id}>
                                            <td>
                                                <div>
                                                    <strong>{c.nombre}</strong>
                                                    {c.razon_social && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                            {c.razon_social}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                                {c.ruc || '—'}
                                            </td>
                                            <td>{c.contacto_nombre || '—'}</td>
                                            <td>{c.telefono || '—'}</td>
                                            <td>
                                                <span className={`badge ${c.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>
                                                    {c.estado}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="btn btn-ghost btn-sm btn-icon text-success"
                                                        onClick={() => openMassPayment(c)}
                                                        title="Estado de Cuenta / Pagos"
                                                    >
                                                        <i className="bi bi-wallet2"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        onClick={() => openEdit(c)}
                                                        title="Editar"
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mobile-cards mobile-only">
                            {clinicas.map(c => (
                                <div key={c.id} className="mobile-card">
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{c.nombre}</div>
                                        <span className={`badge ${c.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>
                                            {c.estado}
                                        </span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">RUC</span>
                                            <span className="mobile-field-value">{c.ruc || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Contacto</span>
                                            <span className="mobile-field-value">{c.contacto_nombre || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Teléfono</span>
                                            <span className="mobile-field-value">{c.telefono || '—'}</span>
                                        </div>
                                        {c.razon_social && (
                                            <div className="mobile-field">
                                                <span className="mobile-field-label">Razón social</span>
                                                <span className="mobile-field-value">{c.razon_social}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mobile-card-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-ghost btn-sm text-success" onClick={() => openMassPayment(c)}>
                                            Pagos <i className="bi bi-wallet2"></i>
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                                            Editar <i className="bi bi-pencil"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal pago masivo */}
            <ModalPagoMasivo
                clinica={selectedClinica}
                open={massPaymentModalOpen}
                onClose={() => setMassPaymentModalOpen(false)}
                onPaymentSuccess={fetchClinicas}
            />

            {/* Modal crear / editar */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                footer={
                    <>
                        {/* Paso RUC: solo botón consultar */}
                        {!editing && step === 'ruc' && (
                            <>
                                <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConsultarRUC}
                                    disabled={rucLoading || rucInput.replace(/\D/g, '').length !== 11}
                                >
                                    {rucLoading
                                        ? <><span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', display: 'inline-block' }} /> Consultando...</>
                                        : <><i className="bi bi-search" /> Consultar SUNAT</>
                                    }
                                </button>
                            </>
                        )}

                        {/* Paso preview: confirmar o volver */}
                        {!editing && step === 'preview' && (
                            <>
                                <button className="btn btn-ghost" onClick={() => setStep('ruc')}>
                                    <i className="bi bi-arrow-left" /> Volver
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConfirmRUC}
                                    disabled={saving}
                                >
                                    {saving
                                        ? <><span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', display: 'inline-block' }} /> Guardando...</>
                                        : <><i className="bi bi-check-lg" /> Confirmar y guardar</>
                                    }
                                </button>
                            </>
                        )}

                        {/* Edición o creación manual */}
                        {(editing || step === 'form') && (
                            <>
                                <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={save} disabled={saving}>
                                    {saving
                                        ? 'Guardando...'
                                        : <><i className="bi bi-check-lg" /> {editing ? 'Guardar cambios' : 'Crear'}</>
                                    }
                                </button>
                            </>
                        )}
                    </>
                }
            >
                {/* ──────── Paso 1: Ingresar RUC ──────── */}
                {!editing && step === 'ruc' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{
                            background: 'rgba(59,130,246,0.06)',
                            border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: '8px',
                            padding: '0.875rem 1rem',
                            fontSize: '0.875rem',
                            color: 'var(--color-text-secondary)',
                            lineHeight: 1.45,
                            display: 'flex',
                            gap: '0.5rem',
                        }}>
                            <i className="bi bi-info-circle-fill" style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '1px' }} />
                            <span>
                                Ingresa el RUC de la clínica para obtener su razón social y datos de SUNAT automáticamente.
                                Los doctores se gestionan en la sección <strong>Doctores</strong>.
                            </span>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">RUC de la clínica <span style={{ color: 'red' }}>*</span></label>
                            <input
                                className="form-input"
                                style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '1.1rem', letterSpacing: '0.05em' }}
                                placeholder="20xxxxxxxxx (11 dígitos)"
                                value={rucInput}
                                onChange={e => setRucInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && rucInput.replace(/\D/g, '').length === 11) handleConsultarRUC();
                                }}
                                maxLength={11}
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* ──────── Paso 2: Preview SUNAT ──────── */}
                {!editing && step === 'preview' && rucPreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Advertencia fiscal */}
                        {rucWarning && (
                            <div style={{
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                borderLeft: '4px solid #d97706',
                                borderRadius: '0 8px 8px 0',
                                padding: '0.875rem 1rem',
                                display: 'flex',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                color: '#92400e',
                                lineHeight: 1.4,
                            }}>
                                <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0, marginTop: '1px', color: '#d97706' }} />
                                <span>{rucWarning}</span>
                            </div>
                        )}

                        {/* Datos obtenidos */}
                        <div style={{
                            background: 'var(--color-bg-alt)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg-alt))',
                                borderBottom: '1px solid var(--color-border)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: 'var(--color-text-secondary)',
                            }}>
                                Datos obtenidos de SUNAT
                            </div>
                            {[
                                { label: 'RUC', value: rucPreview.ruc, mono: true },
                                { label: 'Razón social', value: rucPreview.razon_social },
                                { label: 'Estado', value: rucPreview.estado, badge: rucPreview.estado?.toUpperCase().includes('ACTIVO') ? 'badge-terminado' : 'badge-por_cancelar' },
                                { label: 'Condición', value: rucPreview.condicion, badge: rucPreview.condicion?.toUpperCase().includes('HABIDO') ? 'badge-terminado' : 'badge-por_cancelar' },
                                { label: 'Dirección', value: rucPreview.direccion },
                            ].map(({ label, value, mono, badge }) => value ? (
                                <div key={label} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.625rem 1rem',
                                    borderBottom: '1px solid var(--color-border)',
                                    gap: '0.5rem',
                                }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>{label}</span>
                                    {badge
                                        ? <span className={`badge ${badge}`}>{value}</span>
                                        : <span style={{ fontFamily: mono ? 'var(--font-mono, monospace)' : undefined, fontWeight: 600, textAlign: 'right', fontSize: '0.875rem' }}>{value}</span>
                                    }
                                </div>
                            ) : null)}
                        </div>
                    </div>
                )}

                {/* ──────── Edición o creación manual ──────── */}
                {(editing || step === 'form') && (
                    <div>
                        {rucWarning && (
                            <div style={{
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                borderLeft: '4px solid #d97706',
                                borderRadius: '0 8px 8px 0',
                                padding: '0.75rem 1rem',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                gap: '0.5rem',
                                fontSize: '0.82rem',
                                color: '#92400e',
                            }}>
                                <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0, color: '#d97706' }} />
                                <span>{rucWarning}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2">
                            <div className="form-group">
                                <label className="form-label">Nombre *</label>
                                <input className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Razón Social</label>
                                <input className="form-input" value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">RUC</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        className="form-input"
                                        value={form.ruc}
                                        onChange={e => { setForm({ ...form, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) }); setRucWarning(''); }}
                                        maxLength={11}
                                        style={{ fontFamily: 'var(--font-mono, monospace)' }}
                                        placeholder="20xxxxxxxxx"
                                    />
                                    {editing && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-icon"
                                            title="Revalidar RUC en SUNAT"
                                            onClick={handleRevalidarRUC}
                                            disabled={rucLoading}
                                        >
                                            {rucLoading
                                                ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', display: 'inline-block' }} />
                                                : <i className="bi bi-arrow-repeat" />
                                            }
                                        </button>
                                    )}
                                </div>
                                {editing && (
                                    <span className="form-help">Haz clic en el botón para revalidar con SUNAT</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Teléfono</label>
                                <input className="form-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dirección</label>
                            <input className="form-input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nombre de Contacto</label>
                            <input className="form-input" value={form.contacto_nombre} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Clinicas;
