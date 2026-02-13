import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import Modal from '../components/Modal.jsx';

const Clinicas = () => {
    const { getHeaders } = useAuth();
    const [clinicas, setClinicas] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', razon_social: '', ruc: '', dni: '', email: '', telefono: '', direccion: '', contacto_nombre: '' });

    const fetchClinicas = () => {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        fetch(`/api/clinicas${params}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setClinicas(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchClinicas(); }, [search]);

    const openNew = () => {
        setEditing(null);
        setForm({ nombre: '', razon_social: '', ruc: '', dni: '', email: '', telefono: '', direccion: '', contacto_nombre: '' });
        setModalOpen(true);
    };

    const openEdit = (c) => {
        setEditing(c);
        setForm({ nombre: c.nombre || '', razon_social: c.razon_social || '', ruc: c.ruc || '', dni: c.dni || '', email: c.email || '', telefono: c.telefono || '', direccion: c.direccion || '', contacto_nombre: c.contacto_nombre || '' });
        setModalOpen(true);
    };

    const save = async () => {
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `/api/clinicas/${editing.id}` : '/api/clinicas';
        await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(form) });
        setModalOpen(false);
        fetchClinicas();
    };

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
                        <input className="form-input" placeholder="Buscar por nombre, razón social o RUC..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}</div>
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
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Clínica</th><th>RUC / DNI</th><th>Contacto</th><th>Teléfono</th><th>Estado</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {clinicas.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <div>
                                                <strong>{c.nombre}</strong>
                                                {c.razon_social && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{c.razon_social}</div>}
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{c.ruc || c.dni || '—'}</td>
                                        <td>{c.contacto_nombre || '—'}</td>
                                        <td>{c.telefono || '—'}</td>
                                        <td><span className={`badge ${c.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>{c.estado}</span></td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(c)} title="Editar">
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal open={modalOpen} onClose={() => setModalOpen(false)}
                title={editing ? 'Editar Clínica' : 'Nueva Clínica'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={save}>
                            <i className="bi bi-check-lg"></i> {editing ? 'Guardar' : 'Crear'}
                        </button>
                    </>
                }>
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
                        <input className="form-input" value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} maxLength={11} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">DNI</label>
                        <input className="form-input" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} maxLength={8} />
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
            </Modal>
        </div>
    );
};

export default Clinicas;
