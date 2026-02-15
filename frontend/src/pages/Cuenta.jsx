import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';

const Cuenta = () => {
    const { user, getHeaders, refreshUser } = useAuth();
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [passwordForm, setPasswordForm] = useState({ actual: '', nueva: '', confirmar: '' });
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setForm({
                nombre: user.nombre || '',
                email: user.email || '',
                telefono: user.telefono || ''
            });
        }
    }, [user]);

    const saveProfile = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');
            await refreshUser();
            setMessage({ type: 'success', text: 'Datos actualizados correctamente' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const savePassword = async () => {
        if (!passwordForm.actual || !passwordForm.nueva) {
            setMessage({ type: 'error', text: 'Completa los campos de contrasena' });
            return;
        }
        if (passwordForm.nueva !== passwordForm.confirmar) {
            setMessage({ type: 'error', text: 'La nueva contrasena no coincide' });
            return;
        }
        setSavingPassword(true);
        setMessage(null);
        try {
            const res = await fetch(`${API_URL}/auth/password`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({
                    current_password: passwordForm.actual,
                    new_password: passwordForm.nueva
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al actualizar contrasena');
            setMessage({ type: 'success', text: 'Contrasena actualizada' });
            setPasswordForm({ actual: '', nueva: '', confirmar: '' });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Mi cuenta</h1>
                    <p>Gestiona tus datos personales y seguridad</p>
                </div>
            </div>

            {message && (
                <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                    <i className={`bi ${message.type === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'}`}></i>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Perfil</h3></div>
                    <div className="form-group">
                        <label className="form-label">Nombre</label>
                        <input className="form-input" value={form.nombre}
                            onChange={e => setForm({ ...form, nombre: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Telefono</label>
                        <input className="form-input" value={form.telefono}
                            onChange={e => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    {user?.clinica_nombre && (
                        <div className="form-group">
                            <label className="form-label">Clinica</label>
                            <input className="form-input" value={user.clinica_nombre} disabled />
                        </div>
                    )}
                    <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>

                <div className="card">
                    <div className="card-header"><h3 className="card-title">Seguridad</h3></div>
                    <div className="form-group">
                        <label className="form-label">Contrasena actual</label>
                        <input className="form-input" type="password" value={passwordForm.actual}
                            onChange={e => setPasswordForm({ ...passwordForm, actual: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nueva contrasena</label>
                        <input className="form-input" type="password" value={passwordForm.nueva}
                            onChange={e => setPasswordForm({ ...passwordForm, nueva: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirmar nueva contrasena</label>
                        <input className="form-input" type="password" value={passwordForm.confirmar}
                            onChange={e => setPasswordForm({ ...passwordForm, confirmar: e.target.value })} />
                    </div>
                    <button className="btn btn-accent" onClick={savePassword} disabled={savingPassword}>
                        {savingPassword ? 'Actualizando...' : 'Actualizar contrasena'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Cuenta;
