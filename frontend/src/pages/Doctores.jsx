import React, { useState, useEffect, useCallback, useId } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import FormDatePicker from '../components/FormDatePicker.jsx';
import { API_URL } from '../config.js';
import { previewDNI, confirmDoctor } from '../modules/identity/api/identityApi.js';
import { toast } from 'react-hot-toast';
import '../styles/doctores-modal.css';

const FORM_EMPTY = {
    nombre: '',
    dni: '',
    cop: '',
    email: '',
    telefono: '',
    especialidad: '',
    fecha_nacimiento: '',
};

/** Normalize PG DATE / ISO string → `YYYY-MM-DD` for FormDatePicker. */
const toIsoDateOnly = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : '';
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getUTCFullYear();
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return '';
};

const todayIsoLocal = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const Doctores = () => {
    const { getHeaders } = useAuth();
    const [doctores, setDoctores] = useState([]);
    const [clinicas, setClinicas] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal crear/editar
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [step, setStep] = useState('dni'); // 'dni' | 'preview' | 'form'
    const [dniInput, setDniInput] = useState('');
    const [dniLoading, setDniLoading] = useState(false);
    const [dniPreview, setDniPreview] = useState(null);
    const [form, setForm] = useState(FORM_EMPTY);
    const [selectedClinicas, setSelectedClinicas] = useState([]);

    const fetchDoctores = useCallback(() => {
        setLoading(true);
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        fetch(`${API_URL}/doctores${params}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                setDoctores(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [search, getHeaders]);

    const fetchClinicas = useCallback(() => {
        fetch(`${API_URL}/clinicas`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => setClinicas(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [getHeaders]);

    useEffect(() => { fetchDoctores(); }, [fetchDoctores]);
    useEffect(() => { fetchClinicas(); }, [fetchClinicas]);

    const openNew = () => {
        setEditing(null);
        setDniInput('');
        setDniPreview(null);
        setForm(FORM_EMPTY);
        setSelectedClinicas([]);
        setStep('dni');
        setModalOpen(true);
    };

    const openEdit = (doc) => {
        setEditing(doc);
        setDniPreview(null);
        setForm({
            nombre: doc.nombre_completo || doc.nombre || '',
            dni: doc.dni || '',
            cop: doc.cop || '',
            email: doc.email || '',
            telefono: doc.telefono || '',
            especialidad: doc.especialidad || '',
            fecha_nacimiento: toIsoDateOnly(doc.fecha_nacimiento),
        });
        setSelectedClinicas((doc.clinicas || []).map(c => String(c.id || c)));
        setStep('form');
        setModalOpen(true);
    };

    // Paso 1: Consultar DNI en RENIEC
    const handleConsultarDNI = async () => {
        const dni = dniInput.trim().replace(/\D/g, '');
        if (dni.length !== 8) {
            toast.error('El DNI debe tener 8 dígitos.');
            return;
        }
        setDniLoading(true);
        try {
            const data = await previewDNI({ dni, headers: getHeaders() });
            const nombreCompleto = [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
                .filter(Boolean)
                .join(' ')
                .trim() || data.nombre || '';
            setDniPreview({ dni, nombre: nombreCompleto });
            setStep('preview');
        } catch (err) {
            toast.error(err.message || 'No se pudo consultar el DNI en RENIEC.');
        } finally {
            setDniLoading(false);
        }
    };

    // Paso 2: Confirmar y guardar
    const handleConfirmDNI = async () => {
        if (!dniPreview) return;
        setSaving(true);
        try {
            await confirmDoctor({
                dni: dniPreview.dni,
                overrides: {
                    cop: form.cop || null,
                    email: form.email || null,
                    telefono: form.telefono || null,
                    fecha_nacimiento: form.fecha_nacimiento || null,
                    clinicaIds: selectedClinicas,
                },
                headers: getHeaders(),
            });
            setModalOpen(false);
            toast.success('Doctor registrado correctamente.');
            fetchDoctores();
        } catch (err) {
            toast.error(err.message || 'Error al guardar el doctor.');
        } finally {
            setSaving(false);
        }
    };

    // Guardar edición
    const save = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/doctores/${editing.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    nombre_completo: form.nombre.trim(),
                    cop: form.cop || null,
                    email: form.email || null,
                    telefono: form.telefono || null,
                    fecha_nacimiento: form.fecha_nacimiento || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error al guardar');
            }

            const clinicaIds = selectedClinicas
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && id > 0);
            const assocRes = await fetch(`${API_URL}/doctores/${editing.id}/clinicas`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ clinicaIds }),
            });
            if (!assocRes.ok) {
                const err = await assocRes.json().catch(() => ({}));
                throw new Error(err.error || 'Error asociando clínicas');
            }

            setModalOpen(false);
            toast.success('Doctor actualizado.');
            fetchDoctores();
        } catch (err) {
            toast.error(err.message || 'Error al guardar el doctor.');
        } finally {
            setSaving(false);
        }
    };

    const toggleClinica = (clinicaId) => {
        const id = String(clinicaId);
        setSelectedClinicas(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const modalTitle = editing
        ? 'Editar Doctor'
        : step === 'dni'
            ? 'Nuevo Doctor — Consultar DNI'
            : step === 'preview'
                ? 'Nuevo Doctor — Confirmar datos'
                : 'Nuevo Doctor';

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Doctores</h1>
                    <p>Gestión de doctores y odontólogos asociados</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <i className="bi bi-plus-lg"></i> Nuevo Doctor
                </button>
            </div>

            <div className="card">
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input
                            className="form-input"
                            placeholder="Buscar por nombre o DNI..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
                    </div>
                ) : doctores.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-person-badge empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin doctores registrados</h3>
                        <p className="empty-state-text">Agrega doctores para asociarlos a clínicas y pedidos</p>
                        <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={openNew}>
                            <i className="bi bi-plus-lg"></i> Agregar Doctor
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Tabla desktop */}
                        <div className="data-table-wrapper desktop-only">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Doctor</th>
                                        <th>DNI</th>
                                        <th>COP</th>
                                        <th>Especialidad</th>
                                        <th>Clínicas</th>
                                        <th>Contacto</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {doctores.map(doc => (
                                        <tr key={doc.id}>
                                            <td>
                                                <div>
                                                    <strong>{doc.nombre_completo || doc.nombre}</strong>
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                                {doc.dni || '—'}
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                                {doc.cop || '—'}
                                            </td>
                                            <td>{doc.especialidad || '—'}</td>
                                            <td>
                                                {doc.clinicas?.length > 0
                                                    ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                            {doc.clinicas.slice(0, 3).map((c, i) => (
                                                                <span key={i} className="badge badge-enviado" style={{ fontSize: '0.7rem' }}>
                                                                    {c.nombre || c}
                                                                </span>
                                                            ))}
                                                            {doc.clinicas.length > 3 && (
                                                                <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                                                                    +{doc.clinicas.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                    : <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>Sin clínica</span>
                                                }
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    {doc.email && <div>{doc.email}</div>}
                                                    {doc.telefono && <div style={{ color: 'var(--color-text-secondary)' }}>{doc.telefono}</div>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        onClick={() => openEdit(doc)}
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

                        {/* Cards mobile */}
                        <div className="mobile-cards mobile-only">
                            {doctores.map(doc => (
                                <div key={doc.id} className="mobile-card">
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{doc.nombre_completo || doc.nombre}</div>
                                        {doc.cop && <span className="badge badge-enviado">COP {doc.cop}</span>}
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">DNI</span>
                                            <span className="mobile-field-value">{doc.dni || '—'}</span>
                                        </div>
                                        <div className="mobile-field">
                                            <span className="mobile-field-label">Especialidad</span>
                                            <span className="mobile-field-value">{doc.especialidad || '—'}</span>
                                        </div>
                                        {doc.email && (
                                            <div className="mobile-field">
                                                <span className="mobile-field-label">Email</span>
                                                <span className="mobile-field-value">{doc.email}</span>
                                            </div>
                                        )}
                                        {doc.telefono && (
                                            <div className="mobile-field">
                                                <span className="mobile-field-label">Teléfono</span>
                                                <span className="mobile-field-value">{doc.telefono}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mobile-card-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(doc)}>
                                            Editar <i className="bi bi-pencil"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal crear / editar */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                size={(!editing && step === 'dni') ? undefined : 'lg'}
                footer={
                    <>
                        {!editing && step === 'dni' && (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleConsultarDNI}
                                    disabled={dniLoading || dniInput.replace(/\D/g, '').length !== 8}
                                >
                                    {dniLoading
                                        ? <><span className="spinner doctor-modal-footer-spinner" aria-hidden="true" /> Consultando...</>
                                        : <><i className="bi bi-search" aria-hidden="true" /> Consultar RENIEC</>
                                    }
                                </button>
                            </>
                        )}

                        {!editing && step === 'preview' && (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setStep('dni')}>
                                    <i className="bi bi-arrow-left" aria-hidden="true" /> Volver
                                </button>
                                <button type="button" className="btn btn-primary" onClick={handleConfirmDNI} disabled={saving}>
                                    {saving
                                        ? <><span className="spinner doctor-modal-footer-spinner" aria-hidden="true" /> Guardando...</>
                                        : <><i className="bi bi-check-lg" aria-hidden="true" /> Confirmar y guardar</>
                                    }
                                </button>
                            </>
                        )}

                        {(editing || step === 'form') && (
                            <>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                                    {saving
                                        ? 'Guardando...'
                                        : <><i className="bi bi-check-lg" aria-hidden="true" /> {editing ? 'Guardar cambios' : 'Crear'}</>
                                    }
                                </button>
                            </>
                        )}
                    </>
                }
            >
                {/* ──────── Paso 1: Ingresar DNI ──────── */}
                {!editing && step === 'dni' && (
                    <div className="doctor-modal-stack">
                        <div className="doctor-modal-callout" role="note">
                            <i className="bi bi-info-circle-fill" aria-hidden="true" />
                            <span>
                                Ingresa el DNI del doctor para consultar su nombre en RENIEC automáticamente.
                                Luego podrás completar el COP y asociar clínicas.
                            </span>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="doctor-dni-input">
                                DNI del doctor <span className="doctor-modal-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="doctor-dni-input"
                                className="form-input doctor-modal-dni-input"
                                placeholder="12345678 (8 dígitos)"
                                value={dniInput}
                                onChange={e => setDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && dniInput.replace(/\D/g, '').length === 8) handleConsultarDNI();
                                }}
                                maxLength={8}
                                inputMode="numeric"
                                autoComplete="off"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* ──────── Paso 2: Preview RENIEC ──────── */}
                {!editing && step === 'preview' && dniPreview && (
                    <div className="doctor-modal-stack">
                        <div className="doctor-modal-callout doctor-modal-callout--summary" role="status">
                            <p className="doctor-modal-callout-kicker">
                                <i className="bi bi-person-vcard" aria-hidden="true" />
                                Datos obtenidos de RENIEC
                            </p>
                            <p className="doctor-modal-callout-title">{dniPreview.nombre}</p>
                            <p className="doctor-modal-callout-meta">DNI: {dniPreview.dni}</p>
                        </div>

                        <div className="doctor-modal-fields">
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-preview-cop">N° COP (opcional)</label>
                                <input
                                    id="doctor-preview-cop"
                                    className="form-input doctor-modal-mono-input"
                                    placeholder="Ej: 12345"
                                    value={form.cop}
                                    onChange={e => setForm(p => ({ ...p, cop: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-preview-esp">Especialidad (opcional)</label>
                                <input
                                    id="doctor-preview-esp"
                                    className="form-input"
                                    placeholder="Ej: Ortodoncia"
                                    value={form.especialidad}
                                    onChange={e => setForm(p => ({ ...p, especialidad: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-preview-email">Email (opcional)</label>
                                <input
                                    id="doctor-preview-email"
                                    className="form-input"
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-preview-tel">Teléfono (opcional)</label>
                                <input
                                    id="doctor-preview-tel"
                                    className="form-input"
                                    value={form.telefono}
                                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-preview-bday">Cumpleaños (opcional)</label>
                                <FormDatePicker
                                    id="doctor-preview-bday"
                                    value={form.fecha_nacimiento}
                                    onChange={(fecha_nacimiento) => setForm((p) => ({ ...p, fecha_nacimiento }))}
                                    max={todayIsoLocal()}
                                    aria-label="Fecha de cumpleaños"
                                />
                            </div>
                        </div>

                        <ClinicasSelector
                            clinicas={clinicas}
                            selected={selectedClinicas}
                            onToggle={toggleClinica}
                        />
                    </div>
                )}

                {/* ──────── Edición / formulario completo ──────── */}
                {(editing || step === 'form') && (
                    <div className="doctor-modal-stack doctor-modal-stack--tight">
                        <div className="doctor-modal-fields">
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-nombre">
                                    Nombre <span className="doctor-modal-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="doctor-edit-nombre"
                                    className="form-input"
                                    value={form.nombre}
                                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-dni">DNI</label>
                                <input
                                    id="doctor-edit-dni"
                                    className="form-input doctor-modal-mono-input"
                                    value={form.dni}
                                    maxLength={8}
                                    inputMode="numeric"
                                    onChange={e => setForm(p => ({ ...p, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-cop">N° COP</label>
                                <input
                                    id="doctor-edit-cop"
                                    className="form-input doctor-modal-mono-input"
                                    placeholder="Ej: 12345"
                                    value={form.cop}
                                    onChange={e => setForm(p => ({ ...p, cop: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-esp">Especialidad</label>
                                <input
                                    id="doctor-edit-esp"
                                    className="form-input"
                                    placeholder="Ej: Ortodoncia"
                                    value={form.especialidad}
                                    onChange={e => setForm(p => ({ ...p, especialidad: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-email">Email</label>
                                <input
                                    id="doctor-edit-email"
                                    className="form-input"
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-tel">Teléfono</label>
                                <input
                                    id="doctor-edit-tel"
                                    className="form-input"
                                    value={form.telefono}
                                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="doctor-edit-bday">Cumpleaños</label>
                                <FormDatePicker
                                    id="doctor-edit-bday"
                                    value={form.fecha_nacimiento}
                                    onChange={(fecha_nacimiento) => setForm((p) => ({ ...p, fecha_nacimiento }))}
                                    max={todayIsoLocal()}
                                    aria-label="Fecha de cumpleaños"
                                />
                            </div>
                        </div>

                        <ClinicasSelector
                            clinicas={clinicas}
                            selected={selectedClinicas}
                            onToggle={toggleClinica}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
};

/** Sub-componente: selector multi-clínica */
const CLINICAS_SEARCH_THRESHOLD = 5;

const ClinicasSelector = ({ clinicas, selected, onToggle }) => {
    const [query, setQuery] = useState('');
    const searchId = useId();
    const showSearch = clinicas.length >= CLINICAS_SEARCH_THRESHOLD;
    const normalizedQuery = query.trim().toLowerCase();

    const visibleClinicas = !normalizedQuery
        ? clinicas
        : clinicas.filter((c) => String(c.nombre || '').toLowerCase().includes(normalizedQuery));

    return (
        <div className="form-group">
            <label className="form-label" htmlFor={showSearch ? searchId : undefined}>
                Clínicas asociadas (opcional)
            </label>
            {clinicas.length === 0 ? (
                <p className="doctor-modal-empty-hint">
                    No hay clínicas registradas aún.
                </p>
            ) : (
                <div className="doctor-modal-clinicas-wrap">
                    {showSearch ? (
                        <div className="search-box doctor-modal-clinicas-search">
                            <i className="bi bi-search" aria-hidden="true" />
                            <input
                                id={searchId}
                                className="form-input"
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar clínica..."
                                autoComplete="off"
                            />
                        </div>
                    ) : null}
                    <div className="doctor-modal-clinicas" role="group" aria-label="Lista de clínicas">
                        {visibleClinicas.length > 0 ? (
                            visibleClinicas.map((c) => {
                                const id = String(c.id);
                                const active = selected.includes(id);
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`doctor-modal-clinica-chip${active ? ' is-active' : ''}`}
                                        onClick={() => onToggle(id)}
                                        aria-pressed={active}
                                    >
                                        {active ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                                        {c.nombre}
                                    </button>
                                );
                            })
                        ) : (
                            <p className="doctor-modal-empty-hint">
                                Ninguna clínica coincide con “{query.trim()}”.
                            </p>
                        )}
                    </div>
                </div>
            )}
            {selected.length > 0 && (
                <span className="form-help">
                    {selected.length} clínica{selected.length !== 1 ? 's' : ''} seleccionada{selected.length !== 1 ? 's' : ''}
                </span>
            )}
        </div>
    );
};

export default Doctores;
