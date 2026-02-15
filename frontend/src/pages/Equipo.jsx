import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';

const Equipo = () => {
    const { user, getHeaders } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '', tipo: 'tecnico', estado: 'activo', password: '' });
    const [saving, setSaving] = useState(false);

    const fetchUsuarios = () => {
        setLoading(true);
        fetch(`${API_URL}/usuarios?tipo=equipo`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => { setUsuarios(data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        if (user?.tipo === 'admin') fetchUsuarios();
    }, [user?.tipo]);

    const openNew = () => {
        setEditing(null);
        setForm({ nombre: '', email: '', telefono: '', tipo: 'tecnico', estado: 'activo', password: '' });
        setModalOpen(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        setForm({
            nombre: u.nombre || '',
            email: u.email || '',
            telefono: u.telefono || '',
            tipo: u.tipo || 'tecnico',
            estado: u.estado || 'activo',
            password: ''
        });
        setModalOpen(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;

            const res = await fetch(
                editing ? `${API_URL}/usuarios/${editing.id}` : `${API_URL}/usuarios`,
                {
                    method: editing ? 'PATCH' : 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            setModalOpen(false);
            fetchUsuarios();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (user?.tipo !== 'admin') {
        return (
            <div className="card">
                <div className="empty-state">
                    <i className="bi bi-shield-lock empty-state-icon"></i>
                    <h3 className="empty-state-title">Acceso restringido</h3>
                    <p className="empty-state-text">Solo administradores pueden ver este apartado</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Equipo</h1>
                    <p>Control de cuentas internas del laboratorio</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <i className="bi bi-person-plus"></i> Nuevo Usuario
                </button>
            </div>

            <div className="card">
                {loading ? (
                    <div>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 8 }} />)}</div>
                ) : usuarios.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-people empty-state-icon"></i>
                        <h3 className="empty-state-title">Sin usuarios registrados</h3>
                        <p className="empty-state-text">Agrega tu primer integrante del equipo</p>
                    </div>
                ) : (
                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Tipo</th>
                                    <th>Estado</th>
                                    <th>Ultimo acceso</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.nombre}</strong></td>
                                        <td>{u.email}</td>
                                        <td><span className="badge badge-enviado">{u.tipo}</span></td>
                                        <td><span className={`badge ${u.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>{u.estado}</span></td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                            {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-PE') : '—'}
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Editar">
                                                <i className="bi bi-pencil"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={save} disabled={saving}>
                            <i className="bi bi-check-lg"></i> {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-2">
                    <div className="form-group">
                        <label className="form-label">Nombre *</label>
                        <input className="form-input" value={form.nombre}
                            onChange={e => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email *</label>
                        <input className="form-input" type="email" value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Teléfono</label>
                        <input className="form-input" value={form.telefono}
                            onChange={e => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Tipo</label>
                        <select className="form-select" value={form.tipo}
                            onChange={e => setForm({ ...form, tipo: e.target.value })}>
                            <option value="admin">Administrador</option>
                            <option value="tecnico">Tecnico</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Estado</label>
                        <select className="form-select" value={form.estado}
                            onChange={e => setForm({ ...form, estado: e.target.value })}>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Contrasena {editing ? '(opcional)' : '*'}</label>
                        <input className="form-input" type="password" value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Equipo;
