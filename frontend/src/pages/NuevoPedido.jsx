import React, { useState, useEffect } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const NuevoPedido = () => {
    const { getHeaders, user } = useAuth();
    const navigate = useNavigate();
    const [clinicas, setClinicas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [form, setForm] = useState({ clinica_id: '', paciente_nombre: '', fecha_entrega: '', observaciones: '' });
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => {
        Promise.all([
            fetch('/api/clinicas', { headers: getHeaders() }).then(r => r.json()),
            fetch('/api/productos', { headers: getHeaders() }).then(r => r.json()),
            fetch('/api/categorias', { headers: getHeaders() }).then(r => r.json())
        ]).then(([c, p, cat]) => {
            setClinicas(c);
            setProductos(p);
            setCategorias(cat);
            // If client, auto-select their clinic
            if (user?.clinica_id) setForm(f => ({ ...f, clinica_id: user.clinica_id }));
        });
    }, []);

    const addItem = (producto) => {
        const exists = items.find(i => i.producto_id === producto.id);
        if (exists) {
            setItems(items.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
        } else {
            setItems([...items, {
                producto_id: producto.id,
                nombre: producto.nombre,
                cantidad: 1,
                precio_unitario: parseFloat(producto.precio_base),
                color: '', material: producto.material_default || '',
                pieza_dental: '', observaciones: ''
            }]);
        }
    };

    const updateItem = (idx, field, value) => {
        setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const removeItem = (idx) => {
        setItems(items.filter((_, i) => i !== idx));
    };

    const total = items.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);

    const handleSubmit = async () => {
        if (!form.clinica_id || !form.paciente_nombre || items.length === 0) {
            setError('Completa los campos requeridos y agrega al menos un producto');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    ...form,
                    items: items.map(i => ({
                        producto_id: i.producto_id,
                        cantidad: i.cantidad,
                        precio_unitario: i.precio_unitario,
                        color: i.color,
                        material: i.material,
                        pieza_dental: i.pieza_dental,
                        observaciones: i.observaciones
                    }))
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al crear pedido');
            }
            const pedido = await res.json();
            navigate(`/pedidos/${pedido.id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div className="page-header-left">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/pedidos')}>
                        <i className="bi bi-arrow-left"></i>
                    </button>
                    <div>
                        <h1>Nuevo Pedido</h1>
                        <p>Prescripción digital de trabajo dental</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="login-error" style={{ marginBottom: 'var(--space-4)', maxWidth: '100%' }}>
                    <i className="bi bi-exclamation-circle"></i> {error}
                </div>
            )}

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                {['Datos del Paciente', 'Productos', 'Resumen'].map((label, i) => (
                    <button key={i}
                        className={`btn ${step === i + 1 ? 'btn-primary' : i + 1 < step ? 'btn-accent' : 'btn-ghost'} btn-sm`}
                        onClick={() => setStep(i + 1)}
                        style={{ flex: 1 }}>
                        <span style={{ marginRight: 6, fontWeight: 700 }}>{i + 1}</span> {label}
                    </button>
                ))}
            </div>

            {/* Step 1: Patient Data */}
            {step === 1 && (
                <div className="card animate-slide-up">
                    <div className="card-header"><h3 className="card-title">Datos del Paciente</h3></div>
                    <div className="grid grid-cols-2">
                        <div className="form-group">
                            <label className="form-label">Clínica *</label>
                            <select className="form-select" value={form.clinica_id}
                                onChange={e => setForm({ ...form, clinica_id: e.target.value })}
                                disabled={!!user?.clinica_id}>
                                <option value="">Seleccionar clínica...</option>
                                {clinicas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nombre del Paciente *</label>
                            <input className="form-input" placeholder="Nombre completo del paciente"
                                value={form.paciente_nombre} onChange={e => setForm({ ...form, paciente_nombre: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha de Entrega</label>
                            <input className="form-input" type="date" value={form.fecha_entrega}
                                onChange={e => setForm({ ...form, fecha_entrega: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Observaciones Generales</label>
                        <textarea className="form-textarea" rows={3} value={form.observaciones}
                            onChange={e => setForm({ ...form, observaciones: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-primary" onClick={() => setStep(2)}
                            disabled={!form.paciente_nombre || !form.clinica_id}>
                            Siguiente <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Select Products */}
            {step === 2 && (
                <div className="animate-slide-up">
                    <div className="grid grid-cols-2" style={{ gap: 'var(--space-6)' }}>
                        {/* Product catalog */}
                        <div className="card" style={{ maxHeight: 500, overflowY: 'auto' }}>
                            <div className="card-header"><h3 className="card-title">Catálogo</h3></div>
                            {categorias.map(cat => {
                                const catProds = productos.filter(p => p.categoria_id === cat.id);
                                if (catProds.length === 0) return null;
                                return (
                                    <div key={cat.id} style={{ marginBottom: 'var(--space-4)' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                                            {cat.nombre}
                                        </div>
                                        {catProds.map(p => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid var(--color-border)' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.nombre}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>S/. {parseFloat(p.precio_base).toFixed(2)}</div>
                                                </div>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => addItem(p)}>
                                                    <i className="bi bi-plus-circle"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Selected items */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Items del Pedido ({items.length})</h3>
                            </div>
                            {items.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    <i className="bi bi-cart empty-state-icon" style={{ fontSize: '2rem' }}></i>
                                    <p className="empty-state-text">Agrega productos del catálogo</p>
                                </div>
                            ) : (
                                items.map((item, idx) => (
                                    <div key={idx} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <strong style={{ fontSize: '0.875rem' }}>{item.nombre}</strong>
                                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItem(idx)}
                                                style={{ color: '#EF4444' }}><i className="bi bi-trash"></i></button>
                                        </div>
                                        <div className="grid grid-cols-3" style={{ gap: 'var(--space-2)' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.6875rem' }}>Cantidad</label>
                                                <input className="form-input" type="number" min={1} value={item.cantidad}
                                                    onChange={e => updateItem(idx, 'cantidad', parseInt(e.target.value) || 1)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.6875rem' }}>Pieza dental</label>
                                                <input className="form-input" placeholder="ej: 1.1"
                                                    value={item.pieza_dental} onChange={e => updateItem(idx, 'pieza_dental', e.target.value)} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.6875rem' }}>Color</label>
                                                <input className="form-input" placeholder="ej: A2"
                                                    value={item.color} onChange={e => updateItem(idx, 'color', e.target.value)} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                            {item.cantidad} × S/. {item.precio_unitario.toFixed(2)} = <strong>S/. {(item.cantidad * item.precio_unitario).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-3)', textAlign: 'right', fontSize: '1.125rem', fontWeight: 700 }}>
                                Total: S/. {total.toFixed(2)}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
                        <button className="btn btn-ghost" onClick={() => setStep(1)}>
                            <i className="bi bi-arrow-left"></i> Anterior
                        </button>
                        <button className="btn btn-primary" onClick={() => setStep(3)} disabled={items.length === 0}>
                            Siguiente <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Summary */}
            {step === 3 && (
                <div className="card animate-slide-up">
                    <div className="card-header"><h3 className="card-title">Resumen del Pedido</h3></div>
                    <div className="grid grid-cols-2" style={{ marginBottom: 'var(--space-4)' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Clínica</div>
                            <div style={{ fontWeight: 600 }}>{clinicas.find(c => c.id == form.clinica_id)?.nombre}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Paciente</div>
                            <div style={{ fontWeight: 600 }}>{form.paciente_nombre}</div>
                        </div>
                        {form.fecha_entrega && <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 2 }}>Fecha de Entrega</div>
                            <div style={{ fontWeight: 600 }}>{form.fecha_entrega}</div>
                        </div>}
                    </div>

                    <div className="data-table-wrapper" style={{ marginBottom: 'var(--space-4)' }}>
                        <table className="data-table">
                            <thead><tr><th>Producto</th><th>Pieza</th><th>Color</th><th>Cant.</th><th>P.U.</th><th>Subtotal</th></tr></thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i}>
                                        <td>{item.nombre}</td>
                                        <td>{item.pieza_dental || '—'}</td>
                                        <td>{item.color || '—'}</td>
                                        <td>{item.cantidad}</td>
                                        <td>S/. {item.precio_unitario.toFixed(2)}</td>
                                        <td><strong>S/. {(item.cantidad * item.precio_unitario).toFixed(2)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 700 }}>
                        Total: S/. {total.toFixed(2)}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
                        <button className="btn btn-ghost" onClick={() => setStep(2)}>
                            <i className="bi bi-arrow-left"></i> Anterior
                        </button>
                        <button className="btn btn-accent" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Creando...' : '✓ Crear Pedido'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NuevoPedido;
