import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import Modal from '../components/Modal.jsx';
import '../styles/equipo-modal.css';

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
            toast.success(editing ? 'Usuario actualizado.' : 'Usuario creado.');
            fetchUsuarios();
        } catch (err) {
            toast.error(err.message || 'Error al guardar');
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
                    <>
                        <div className="data-table-wrapper desktop-only" style={{ border: 'none' }}>
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
                        <div className="mobile-cards mobile-only">
                            {usuarios.map(u => (
                                <div key={u.id} className="mobile-card">
                                    <div className="mobile-card-head">
                                        <div className="mobile-card-title">{u.nombre}</div>
                                        <span className={`badge ${u.estado === 'activo' ? 'badge-terminado' : 'badge-enviado'}`}>{u.estado}</span>
                                    </div>
                                    <div className="mobile-card-grid">
                                        <div className="mobile-field"><span className="mobile-field-label">Email</span><span className="mobile-field-value">{u.email}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Tipo</span><span className="mobile-field-value">{u.tipo}</span></div>
                                        <div className="mobile-field"><span className="mobile-field-label">Ultimo acceso</span><span className="mobile-field-value">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-PE') : '—'}</span></div>
                                    </div>
                                    <div className="mobile-card-actions">
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                                            Editar <i className="bi bi-pencil"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Editar Usuario' : 'Nuevo Usuario'}
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                            {saving ? (
                                <><span className="spinner equipo-modal-footer-spinner" aria-hidden="true" /> Guardando...</>
                            ) : (
                                <><i className="bi bi-check-lg" aria-hidden="true" /> Guardar</>
                            )}
                        </button>
                    </>
                }
            >
                <div className="equipo-modal-fields">
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-nombre">
                            Nombre <span className="equipo-modal-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="equipo-user-nombre"
                            className="form-input"
                            value={form.nombre}
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                            autoComplete="name"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-email">
                            Email <span className="equipo-modal-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="equipo-user-email"
                            className="form-input"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-tel">Teléfono</label>
                        <input
                            id="equipo-user-tel"
                            className="form-input"
                            value={form.telefono}
                            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                            autoComplete="tel"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-tipo">Tipo</label>
                        <select
                            id="equipo-user-tipo"
                            className="form-select"
                            value={form.tipo}
                            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                        >
                            <option value="admin">Administrador</option>
                            <option value="tecnico">Técnico</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-estado">Estado</label>
                        <select
                            id="equipo-user-estado"
                            className="form-select"
                            value={form.estado}
                            onChange={(e) => setForm({ ...form, estado: e.target.value })}
                        >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="equipo-user-password">
                            Contraseña {editing ? '(opcional)' : <span className="equipo-modal-required" aria-hidden="true">*</span>}
                        </label>
                        <input
                            id="equipo-user-password"
                            className="form-input"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            autoComplete={editing ? 'new-password' : 'new-password'}
                            placeholder={editing ? 'Dejar vacío para no cambiar' : undefined}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Equipo;
