import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { API_URL } from '../config.js';
import { isClientRole } from '../utils/accessControl.js';

const Cuenta = () => {
    const { user, getHeaders, refreshUser, setUser } = useAuth();
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '', clinica_direccion: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [passwordForm, setPasswordForm] = useState({ actual: '', nueva: '', confirmar: '' });
    const [savingPassword, setSavingPassword] = useState(false);
    const isClient = isClientRole(user);
    const hasClinic = user?.clinica_id != null && String(user.clinica_id) !== '';
    const canEditClinicAddress = isClient && hasClinic;
    const showClinicName = Boolean(user?.clinica_nombre) || canEditClinicAddress;

    // Re-sincronizar perfil desde /me al entrar (recupera clinica_id / dirección si el estado local quedó incompleto).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await refreshUser();
            } catch {
                /* ignore: keep current session user */
            }
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshUser]);

    useEffect(() => {
        if (!user) return;
        setForm({
            nombre: user.nombre || '',
            email: user.email || '',
            telefono: user.telefono || '',
            clinica_direccion: user.clinica_direccion || '',
        });
    }, [user?.id, user?.clinica_direccion, user?.nombre, user?.email, user?.telefono]);

    const saveProfile = async () => {
        setSaving(true);
        setMessage(null);
        const previousUser = user;
        try {
            const payload = {
                nombre: form.nombre,
                email: form.email,
                telefono: form.telefono,
            };
            if (canEditClinicAddress) {
                payload.clinica_direccion = form.clinica_direccion;
            }
            const res = await fetch(`${API_URL}/auth/me`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar');

            // Merge: nunca reemplazar el usuario entero (evita perder clinica_id/tipo si la respuesta viene incompleta).
            if (data?.id && typeof setUser === 'function') {
                setUser((prev) => ({ ...(prev || {}), ...data }));
            }
            setForm({
                nombre: data.nombre || form.nombre || '',
                email: data.email || form.email || '',
                telefono: data.telefono ?? form.telefono ?? '',
                clinica_direccion: data.clinica_direccion || form.clinica_direccion || '',
            });
            await refreshUser();
            setMessage({ type: 'success', text: 'Datos actualizados correctamente' });
        } catch (err) {
            if (previousUser && typeof setUser === 'function') {
                setUser(previousUser);
            }
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
                    {showClinicName && (
                        <div className="form-group">
                            <label className="form-label">Clinica</label>
                            <input className="form-input" value={user?.clinica_nombre || ''} disabled />
                        </div>
                    )}
                    {canEditClinicAddress && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="cuenta-clinica-direccion">
                                Dirección del consultorio
                            </label>
                            <input
                                id="cuenta-clinica-direccion"
                                className="form-input"
                                value={form.clinica_direccion}
                                onChange={e => setForm({ ...form, clinica_direccion: e.target.value })}
                                placeholder="Calle, distrito, ciudad"
                                aria-describedby="cuenta-clinica-direccion-help"
                            />
                            <span id="cuenta-clinica-direccion-help" className="form-help">
                                Se usa para recolección en consultorio.
                            </span>
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
