import React, { useState } from 'react';
import CrmNavigation from '../components/CrmNavigation.jsx';
import DoctorModal from '../components/DoctorModal.jsx';
import { useCrmDoctoresQuery } from '../queries/useCrmQueries.js';
import '../styles/crm.css';

export const CrmDoctoresPage = () => {
    const [search, setSearch] = useState('');
    const [modalDoctor, setModalDoctor] = useState(null); // null = closed, {} = new, doctor = edit

    const { data: doctores = [], isLoading, refetch } = useCrmDoctoresQuery({
        search: search || undefined,
    });

    return (
        <div>
            <CrmNavigation
                title="Directorio de Doctores"
                subtitle="Gestión de relaciones personales con odontólogos, especialistas y consultorios asociados"
                actions={
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="crm-btn crm-btn-secondary" onClick={() => refetch()}>
                            <i className="bi bi-arrow-clockwise"></i>
                        </button>
                        <button
                            type="button"
                            className="crm-btn crm-btn-primary"
                            onClick={() => setModalDoctor({})}
                        >
                            <i className="bi bi-person-plus-fill"></i> Nuevo Doctor
                        </button>
                    </div>
                }
            />

            <div className="crm-container">
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
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
