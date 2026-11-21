import React, { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { optimizeImageForUpload } from '../../utils/imageOptimizer.js';
import { uploadSustentoReceipt } from '../../modules/finance/api/financeApi.js';
import { resolveImageUrl } from '../../utils/resolveImageUrl.js';

export default function ReceiptAttachmentField({
    value,
    onChange,
    label = 'Comprobante / Foto del Sustento',
    helpText = 'Sube foto o factura (se comprimirá a WebP para máxima velocidad)',
    disabled = false,
    onView
}) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input value so same file can be re-selected if needed
        e.target.value = '';

        try {
            setIsUploading(true);
            let fileToUpload = file;

            // Compress image if it's an image file
            if (file.type && file.type.startsWith('image/')) {
                fileToUpload = await optimizeImageForUpload(file, {
                    maxWidth: 1600,
                    maxHeight: 1600,
                    quality: 0.85
                });
            }

            const response = await uploadSustentoReceipt({ file: fileToUpload });
            if (response && response.url) {
                onChange(response.url);
                toast.success('Comprobante adjuntado con éxito');
            } else {
                throw new Error('No se recibió la URL del comprobante');
            }
        } catch (err) {
            console.error('Error al subir comprobante:', err);
            toast.error(err.message || 'Error al subir la imagen');
        } finally {
            setIsUploading(false);
        }
    };

    const isPdf = value && (value.toLowerCase().endsWith('.pdf') || value.includes('application/pdf'));
    const fullUrl = resolveImageUrl(value);

    return (
        <div className="receipt-attachment-field form-group" style={{ marginBottom: 0 }}>
            {label && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="bi bi-camera text-primary"></i>
                        {label}
                    </label>
                    {value && (
                        <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                            <i className="bi bi-check-circle-fill" style={{ marginRight: '3px' }}></i> Adjuntado
                        </span>
                    )}
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={disabled || isUploading}
            />

            {value ? (
                <div className="receipt-preview-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: 'var(--color-bg-alt, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    marginTop: '4px'
                }}>
                    {isPdf ? (
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem',
                            flexShrink: 0
                        }}>
                            <i className="bi bi-file-earmark-pdf"></i>
                        </div>
                    ) : (
                        <div
                            onClick={() => onView ? onView(value) : window.open(fullUrl, '_blank')}
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                background: '#000',
                                cursor: 'pointer',
                                flexShrink: 0,
                                border: '1px solid var(--color-border, #cbd5e1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="Haz clic para ver en tamaño completo"
                        >
                            <img
                                src={fullUrl}
                                alt="Comprobante"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentNode.innerHTML = '<i class="bi bi-image" style="color: #94a3b8; font-size: 1.2rem;"></i>';
                                }}
                            />
                        </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-text-primary, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {isPdf ? 'Documento PDF Adjunto' : 'Foto / Comprobante Adjunto'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary, #64748b)' }}>
                            Almacenado en VPS Afinix Lab
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto' }}
                            onClick={() => onView ? onView(value) : window.open(value, '_blank')}
                            title="Ver comprobante en pantalla completa"
                        >
                            <i className="bi bi-eye"></i> Ver
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto' }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || isUploading}
                            title="Cambiar foto o documento"
                        >
                            <i className="bi bi-arrow-repeat"></i>
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger, #ef4444)', height: 'auto' }}
                            onClick={() => onChange('')}
                            disabled={disabled || isUploading}
                            title="Quitar comprobante"
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isUploading}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1.5px dashed var(--color-border, #cbd5e1)',
                        background: 'var(--color-bg-alt, #f8fafc)',
                        color: 'var(--color-text-primary, #0f172a)',
                        cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                        marginTop: '4px'
                    }}
                    onMouseEnter={(e) => {
                        if (!disabled && !isUploading) {
                            e.currentTarget.style.borderColor = 'var(--color-primary, #0284c7)';
                            e.currentTarget.style.background = 'rgba(2, 132, 199, 0.04)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!disabled && !isUploading) {
                            e.currentTarget.style.borderColor = 'var(--color-border, #cbd5e1)';
                            e.currentTarget.style.background = 'var(--color-bg-alt, #f8fafc)';
                        }
                    }}
                >
                    {isUploading ? (
                        <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></span>
                            <span>Comprimiendo y subiendo foto...</span>
                        </>
                    ) : (
                        <>
                            <i className="bi bi-camera-fill text-primary" style={{ fontSize: '1rem' }}></i>
                            <span>Adjuntar Foto / Factura / Voucher</span>
                        </>
                    )}
                </button>
            )}

            {helpText && !value && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary, #64748b)', marginTop: '4px', textAlign: 'center' }}>
                    {helpText}
                </div>
            )}
        </div>
    );
}
