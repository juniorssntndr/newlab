import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import DoctorModal from '../components/DoctorModal.jsx';
import { useCrmDoctoresQuery, useCrmMutations } from '../queries/useCrmQueries.js';
import { useAuth } from '../../../state/AuthContext.jsx';
import { isAdminRole } from '../../../utils/accessControl.js';
import toast from 'react-hot-toast';
import '../styles/crm.css';

export const CrmDoctoresPage = () => {
    const { user } = useAuth();
    const isAdmin = isAdminRole(user);
    const { deleteDoctor } = useCrmMutations();

    const [search, setSearch] = useState('');
    const [modalDoctor, setModalDoctor] = useState(null); // null = closed, {} = new, doctor = edit

    const { data: doctores = [], isLoading, refetch } = useCrmDoctoresQuery({
        search: search || undefined,
    });

    const handleDeleteDoctor = async (doc) => {
        const confirmMsg = `¿Estás seguro de dar de baja al Dr(a). "${doc.nombre_completo}"?\n\nEsta acción cambiará su estado a inactivo en el sistema.`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await deleteDoctor(doc.id);
            toast.success(`Dr(a). "${doc.nombre_completo}" dado(a) de baja exitosamente.`);
            refetch();
        } catch (err) {
            toast.error(err.message || 'Error al dar de baja al doctor');
        }
    };

    return (
        <div className="animate-fade-in page-container">
            <CrmNavigation
                title="Directorio de Doctores"
                subtitle="Gestión de relaciones personales con odontólogos, especialistas y consultorios asociados"
                actions={
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setModalDoctor({})}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                    >
                        <i className="bi bi-person-plus-fill"></i> Nuevo Doctor
                    </button>
                }
            />

            <div>
                <div className="crm-filter-bar">
                    <div className="crm-search-input-wrap">
                        <i className="bi bi-search"></i>
                        <input
                            type="text"
                            className="crm-search-input"
                            placeholder="Buscar doctor por nombre, especialidad o DNI..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="crm-table-container">
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Cargando directorio de doctores...</p>
                        </div>
                    ) : doctores.length === 0 ? (
                        <div className="crm-empty-state">
                            <i className="bi bi-person-badge"></i>
                            <h3>No hay doctores registrados</h3>
                            <p>Registra un nuevo odontólogo de forma ágil sin obligatoriedad de DNI.</p>
                            <button
                                type="button"
                                className="crm-btn crm-btn-primary"
                                style={{ marginTop: '1rem' }}
                                onClick={() => setModalDoctor({})}
                            >
                                Registrar Primer Doctor
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="crm-table-container desktop-only">
                                <table className="crm-table">
                                    <thead>
                                        <tr>
                                            <th>Doctor(a)</th>
                                            <th>Especialidad</th>
                                            <th>Clínicas / Consultorios Asociados</th>
                                            <th>Contacto Directo</th>
                                            <th>Cumpleaños</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doctores.map((d) => (
                                            <tr key={d.id}>
                                                <td>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{d.nombre_completo}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {d.dni ? `DNI: ${d.dni}` : 'Sin DNI'} {d.cop ? `• COP: ${d.cop}` : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="crm-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                                                        {d.especialidad || 'Odontología General'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {d.clinicas && d.clinicas.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                            {d.clinicas.map((c) => (
                                                                <span
                                                                    key={c.id}
                                                                    className="crm-badge"
                                                                    style={{
                                                                        background: c.es_principal ? '#e0f2fe' : '#f8fafc',
                                                                        color: c.es_principal ? '#0369a1' : '#475569',
                                                                        border: '1px solid #e2e8f0',
                                                                    }}
                                                                >
                                                                    {c.nombre} {c.es_principal ? '★' : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Sin clínicas asociadas</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', fontSize: '0.8125rem' }}>
                                                        {d.telefono && (
                                                            <a href={`tel:${d.telefono}`} style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'none', fontWeight: 600 }}>
                                                                <i className="bi bi-telephone-fill" style={{ marginRight: '0.25rem' }}></i>
                                                                {d.telefono}
                                                            </a>
                                                        )}
                                                        {d.email && <span style={{ color: '#64748b' }}>{d.email}</span>}
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                                    {d.fecha_nacimiento
                                                        ? new Date(d.fecha_nacimiento).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                                        {d.telefono && (
                                                            <a href={`tel:${d.telefono}`} className="crm-btn crm-btn-secondary crm-btn-icon crm-btn-sm" title="Llamar">
                                                                <i className="bi bi-telephone-fill text-primary"></i>
                                                            </a>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="crm-btn crm-btn-secondary crm-btn-sm"
                                                            onClick={() => setModalDoctor(d)}
                                                        >
                                                            <i className="bi bi-pencil"></i> Editar
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                className="crm-btn crm-btn-danger crm-btn-sm"
                                                                onClick={() => handleDeleteDoctor(d)}
                                                                title="Dar de baja doctor"
                                                                style={{ color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="crm-mobile-cards mobile-only">
                                {doctores.map((d) => (
                                    <div key={d.id} className="crm-mobile-card">
                                        <div className="crm-mobile-card-head">
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div className="crm-mobile-card-title">{d.nombre_completo}</div>
                                                <div className="crm-mobile-card-sub">
                                                    {d.dni ? `DNI: ${d.dni}` : 'Sin DNI'} {d.cop ? `• COP: ${d.cop}` : ''}
                                                </div>
                                            </div>
                                            <div style={{ flexShrink: 0 }}>
                                                <span className="crm-badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 600 }}>
                                                    {d.especialidad || 'Odontología General'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="crm-mobile-card-meta">
                                            <div className="crm-mobile-meta-item" style={{ gridColumn: 'span 2' }}>
                                                <span className="crm-mobile-meta-label">Clínicas / Consultorios</span>
                                                <span className="crm-mobile-meta-value">
                                                    {d.clinicas && d.clinicas.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '2px' }}>
                                                            {d.clinicas.map((c) => (
                                                                <span
                                                                    key={c.id}
                                                                    className="crm-badge"
                                                                    style={{
                                                                        background: c.es_principal ? '#e0f2fe' : '#ffffff',
                                                                        color: c.es_principal ? '#0369a1' : '#475569',
                                                                        border: '1px solid #e2e8f0',
                                                                        fontSize: '0.75rem'
                                                                    }}
                                                                >
                                                                    {c.nombre} {c.es_principal ? '★' : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        'Sin clínicas asociadas'
                                                    )}
                                                </span>
                                            </div>

                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Teléfono</span>
                                                <span className="crm-mobile-meta-value">
                                                    {d.telefono ? (
                                                        <a href={`tel:${d.telefono}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                            <i className="bi bi-telephone-fill" style={{ fontSize: '0.7rem' }}></i> {d.telefono}
                                                        </a>
                                                    ) : '—'}
                                                </span>
                                            </div>

                                            <div className="crm-mobile-meta-item">
                                                <span className="crm-mobile-meta-label">Cumpleaños</span>
                                                <span className="crm-mobile-meta-value">
                                                    {d.fecha_nacimiento
                                                        ? new Date(d.fecha_nacimiento).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                                        : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="crm-mobile-card-actions">
                                            {d.telefono && (
                                                <a
                                                    href={`tel:${d.telefono}`}
                                                    className="crm-btn crm-btn-secondary crm-btn-sm"
                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                >
                                                    <i className="bi bi-telephone-fill text-primary"></i> Llamar
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                className="crm-btn crm-btn-secondary crm-btn-sm"
                                                onClick={() => setModalDoctor(d)}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                            >
                                                <i className="bi bi-pencil"></i> Editar Doctor
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    className="crm-btn crm-btn-danger crm-btn-sm"
                                                    onClick={() => handleDeleteDoctor(d)}
                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                                                >
                                                    <i className="bi bi-trash"></i> Eliminar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {modalDoctor && (
                <DoctorModal
                    doctor={modalDoctor.id ? modalDoctor : null}
                    onClose={() => setModalDoctor(null)}
                    onSaved={refetch}
                />
            )}
        </div>
    );
};

export default CrmDoctoresPage;
