import React, { useState, useEffect } from 'react';
import Modal from '../../../components/Modal.jsx';
import CustomSelect from '../../../components/CustomSelect.jsx';
import { useAuth } from '../../../state/AuthContext.jsx';
import { API_URL } from '../../../config.js';
import toast from 'react-hot-toast';

const PRESET_RUBROS = [
    'Discos CAD/CAM',
    'Resinas 3D',
    'Fresas',
    'Fresadoras',
    'Impresoras 3D',
    'Merch',
    'Consumibles',
    'Servicios Técnicos'
];

export const ProveedorModal = ({ isOpen, onClose, proveedor = null, onSaved }) => {
    const { getHeaders } = useAuth();
    const isEdit = Boolean(proveedor?.id);
    const [loading, setLoading] = useState(false);
    const [customRubroInput, setCustomRubroInput] = useState('');

    const [form, setForm] = useState({
        razon_social: '',
        nombre_comercial: '',
        tipo_documento: 'RUC',
        numero_documento: '',
        contacto_nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        ciudad: 'Arequipa',
        tipo_proveedor: 'materiales',
        condicion_pago: 'contado',
        notas: '',
        rubros: [],
    });

    useEffect(() => {
        if (proveedor) {
            setForm({
                razon_social: proveedor.razon_social || '',
                nombre_comercial: proveedor.nombre_comercial || '',
                tipo_documento: proveedor.tipo_documento || 'RUC',
                numero_documento: proveedor.numero_documento || '',
                contacto_nombre: proveedor.contacto_nombre || '',
                telefono: proveedor.telefono || '',
                email: proveedor.email || '',
                direccion: proveedor.direccion || '',
                ciudad: proveedor.ciudad || 'Arequipa',
                tipo_proveedor: proveedor.tipo_proveedor || 'materiales',
                condicion_pago: proveedor.condicion_pago || 'contado',
                notas: proveedor.notas || '',
                rubros: Array.isArray(proveedor.rubros) ? proveedor.rubros : [],
            });
        } else {
            setForm({
                razon_social: '',
                nombre_comercial: '',
                tipo_documento: 'RUC',
                numero_documento: '',
                contacto_nombre: '',
                telefono: '',
                email: '',
                direccion: '',
                ciudad: 'Arequipa',
                tipo_proveedor: 'materiales',
                condicion_pago: 'contado',
                notas: '',
                rubros: ['Discos CAD/CAM'],
            });
        }
    }, [proveedor, isOpen]);

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleToggleRubro = (rubro) => {
        setForm(prev => {
            const exists = prev.rubros.includes(rubro);
            return {
                ...prev,
                rubros: exists
                    ? prev.rubros.filter(r => r !== rubro)
                    : [...prev.rubros, rubro]
            };
        });
    };

    const handleAddCustomRubro = (e) => {
        if (e) e.preventDefault();
        const trimmed = customRubroInput.trim();
        if (!trimmed) return;
        if (!form.rubros.includes(trimmed)) {
            setForm(prev => ({ ...prev, rubros: [...prev.rubros, trimmed] }));
        }
        setCustomRubroInput('');
    };

    const handleRemoveRubro = (rubro) => {
        setForm(prev => ({
            ...prev,
            rubros: prev.rubros.filter(r => r !== rubro)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.razon_social.trim()) {
            toast.error('La razón social o nombre es obligatoria');
            return;
        }

        setLoading(true);
        try {
            const url = isEdit ? `${API_URL}/proveedores/${proveedor.id}` : `${API_URL}/proveedores`;
            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    ...getHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al guardar proveedor');
            }

            toast.success(isEdit ? 'Proveedor actualizado con éxito' : 'Proveedor registrado con éxito');
            onSaved?.();
            onClose();
        } catch (error) {
            toast.error(error.message || 'Error al procesar la solicitud');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            subtitle={isEdit ? `Modificando datos de ${proveedor.razon_social}` : 'Registra una empresa proveedora, asesor y especialidades'}
            icon="bi bi-truck"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ marginRight: '6px' }}></span>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check2-circle"></i> {isEdit ? 'Guardar Cambios' : 'Registrar Proveedor'}
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Razón Social / Empresa <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Dental Arequipa S.A.C."
                            value={form.razon_social}
                            onChange={(e) => handleChange('razon_social', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Nombre Comercial / Marca
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Dental Arequipa"
                            value={form.nombre_comercial}
                            onChange={(e) => handleChange('nombre_comercial', e.target.value)}
                        />
                    </div>
                </div>

                {/* Rubros y Especialidades personalizadas */}
                <div style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--color-bg-alt, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px'
                }}>
                    <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-tags-fill text-primary"></i>
                        Rubros y Especialidades que Provee (Múltiples)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                        {PRESET_RUBROS.map(r => {
                            const isSelected = form.rubros.includes(r);
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleToggleRubro(r)}
                                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        padding: '0.25rem 0.75rem',
                                        border: isSelected ? 'none' : '1px solid var(--color-border, #cbd5e1)'
                                    }}
                                >
                                    {isSelected && <i className="bi bi-check-lg" style={{ marginRight: '4px' }}></i>}
                                    {r}
                                </button>
                            );
                        })}
                    </div>

                    {/* Chips personalizados adicionales */}
                    {form.rubros.filter(r => !PRESET_RUBROS.includes(r)).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                            {form.rubros.filter(r => !PRESET_RUBROS.includes(r)).map(r => (
                                <span
                                    key={r}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                        background: 'var(--color-primary-rgb, rgba(8,145,178,0.15))',
                                        color: 'var(--color-primary, #0891b2)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600
                                    }}
                                >
                                    {r}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRubro(r)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, marginLeft: '2px' }}
                                    >
                                        <i className="bi bi-x"></i>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Input para agregar otro rubro */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Otro rubro (ej. Yesos, Articuladores, Embalaje...)"
                            value={customRubroInput}
                            onChange={(e) => setCustomRubroInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomRubro();
                                }
                            }}
                            style={{ fontSize: '0.8rem', height: '34px' }}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleAddCustomRubro}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            <i className="bi bi-plus"></i> Agregar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Tipo Doc.</label>
                        <CustomSelect
                            value={form.tipo_documento}
                            onChange={(e, val) => handleChange('tipo_documento', val !== undefined ? val : e.target.value)}
                            options={[
                                { value: 'RUC', label: 'RUC' },
                                { value: 'DNI', label: 'DNI' },
                                { value: 'OTRO', label: 'Otro' }
                            ]}
                        />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Número de Documento</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. 20501234567"
                            value={form.numero_documento}
                            onChange={(e) => handleChange('numero_documento', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Tipo General</label>
                        <CustomSelect
                            value={form.tipo_proveedor}
                            onChange={(e, val) => handleChange('tipo_proveedor', val !== undefined ? val : e.target.value)}
                            options={[
                                { value: 'materiales', label: '📦 Insumos / Stock' },
                                { value: 'servicios', label: '🛠️ Servicios / Soporte' },
                                { value: 'mixto', label: '🔄 Mixto' }
                            ]}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Asesor / Contacto Comercial</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Ing. Roberto Salas"
                            value={form.contacto_nombre}
                            onChange={(e) => handleChange('contacto_nombre', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Teléfono / WhatsApp</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. 958123456"
                            value={form.telefono}
                            onChange={(e) => handleChange('telefono', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Correo Electrónico</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="ventas@proveedor.pe"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Dirección / Sede</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ej. Calle Mercaderes 320"
                            value={form.direccion}
                            onChange={(e) => handleChange('direccion', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Ciudad</label>
                        <input
                            type="text"
                            className="form-input"
                            value={form.ciudad}
                            onChange={(e) => handleChange('ciudad', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Condición de Pago</label>
                        <CustomSelect
                            value={form.condicion_pago}
                            onChange={(e, val) => handleChange('condicion_pago', val !== undefined ? val : e.target.value)}
                            options={[
                                { value: 'contado', label: 'Contado' },
                                { value: 'credito_15', label: 'Crédito 15 días' },
                                { value: 'credito_30', label: 'Crédito 30 días' },
                                { value: 'otro', label: 'Otro / A convenir' }
                            ]}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Notas y Observaciones</label>
                    <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Ej. Descuento por compras mayores a 10 unidades de discos..."
                        value={form.notas}
                        onChange={(e) => handleChange('notas', e.target.value)}
                    />
                </div>
            </form>
        </Modal>
    );
};

export default ProveedorModal;
