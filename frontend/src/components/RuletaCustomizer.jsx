import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/http/apiClient.js';
import CustomSelect from './CustomSelect.jsx';
import Modal from './Modal.jsx';
import isoLight from '../assets/branding/iso-light.png';

export default function RuletaCustomizer({
    sectores = [],
    totalPesoActivo = 0,
    onUpdateSectoresLocally,
    onReloadSectores,
    getHeaders,
    onLaunchKiosk
}) {
    // Cálculo de peso y sectores activos para probabilidades en tiempo real
    const activeSectors = sectores.filter(s => s.activo && (!s.stock_disponible || s.stock_entregado < s.stock_disponible));
    const effectiveTotalPeso = totalPesoActivo || activeSectors.reduce((acc, s) => acc + (Number(s.probabilidad_peso) || 0), 0);

    // Pestaña activa en el panel izquierdo: 'sectores' | 'general'
    const [activeTab, setActiveTab] = useState('sectores');

    // Confirmación modal de eliminación de sector
    const [sectorToDelete, setSectorToDelete] = useState(null);

    // Configuración general de la ruleta (nl_ruleta_config)
    const [config, setConfig] = useState({
        fondo_url: '',
        pasador_url: '',
        tiempo_animacion_segundos: 4
    });
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [uploadingSectorImg, setUploadingSectorImg] = useState(false);

    // Sector seleccionado para edición (o null si se está creando uno nuevo)
    const [selectedSectorId, setSelectedSectorId] = useState(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // Formulario de edición del sector activo
    const [sectorForm, setSectorForm] = useState({
        id: null,
        titulo: '',
        tipo_premio: 'porcentaje',
        valor: '10',
        descripcion: '',
        color_hex: '#0284c7',
        texto_color: '#ffffff',
        probabilidad_peso: '10',
        stock_disponible: '',
        imagen_url: '',
        resultado_titulo: '',
        resultado_descripcion: ''
    });
    const [savingSector, setSavingSector] = useState(false);

    // Estado del canvas de previsualización
    const previewCanvasRef = useRef(null);
    const previewAngleRef = useRef(0);
    const testSpinAnimRef = useRef(null);
    const [isPreviewSpinning, setIsPreviewSpinning] = useState(false);
    const loadedImagesRef = useRef(new Map());

    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (testSpinAnimRef.current) {
                cancelAnimationFrame(testSpinAnimRef.current);
            }
        };
    }, []);

    // Opciones para CustomSelect de Tipo de Premio
    const prizeTypeOptions = [
        { value: 'porcentaje', label: '% Porcentaje de Descuento (Cupón)' },
        { value: 'monto_fijo', label: 'S/. Monto Fijo en Soles (Cupón)' },
        { value: 'merch', label: 'Merchandising / Regalo Físico' },
        { value: 'sin_premio', label: 'Sin Premio ("Sigue Intentando")' }
    ];

    // Presets de Probabilidad estilo Interacty
    const probabilityPresets = [
        { label: 'Baja (5%)', weight: 5 },
        { label: 'Media (15%)', weight: 15 },
        { label: 'Alta (30%)', weight: 30 },
        { label: 'Muy Alta (50%)', weight: 50 }
    ];

    // Paleta oficial de colores AFINIX LAB
    const afinixPalette = [
        { hex: '#0284c7', label: 'Azul AFINIX' },
        { hex: '#0f172a', label: 'Azul Marino Oscuro' },
        { hex: '#024873', label: 'Azul Zafiro' },
        { hex: '#38bdf8', label: 'Celeste Brillante' },
        { hex: '#f59e0b', label: 'Dorado Ámbar' },
        { hex: '#10b981', label: 'Verde Éxito' },
        { hex: '#8b5cf6', label: 'Púrpura Neón' },
        { hex: '#ef4444', label: 'Rojo Coral' }
    ];

    // Cargar configuración general
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoadingConfig(true);
                const res = await apiClient.get('/api/marketing/ruleta/config', { headers: getHeaders?.() });
                if (res?.data) {
                    setConfig({
                        fondo_url: res.data.fondo_url || '',
                        pasador_url: res.data.pasador_url || '',
                        tiempo_animacion_segundos: res.data.tiempo_animacion_segundos || 4
                    });
                }
            } catch {
                // Silencioso o default
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchConfig();
    }, [getHeaders]);

    // Seleccionar por defecto el primer sector si no hay ninguno seleccionado
    useEffect(() => {
        if (!selectedSectorId && !isCreatingNew && sectores.length > 0) {
            handleSelectSector(sectores[0]);
        } else if (selectedSectorId && !isCreatingNew) {
            const current = sectores.find(s => s.id === selectedSectorId);
            if (!current && sectores.length > 0) {
                handleSelectSector(sectores[0]);
            }
        }
    }, [sectores, selectedSectorId, isCreatingNew]);

    const handleSelectSector = (sector) => {
        setIsCreatingNew(false);
        setSelectedSectorId(sector.id);
        setSectorForm({
            id: sector.id,
            titulo: sector.titulo || '',
            tipo_premio: sector.tipo_premio || 'porcentaje',
            valor: sector.valor !== null && sector.valor !== undefined ? String(sector.valor) : '',
            descripcion: sector.descripcion || '',
            color_hex: sector.color_hex || '#0284c7',
            texto_color: sector.texto_color || '#ffffff',
            probabilidad_peso: String(sector.probabilidad_peso || 10),
            stock_disponible: sector.stock_disponible !== null && sector.stock_disponible !== undefined ? String(sector.stock_disponible) : '',
            imagen_url: sector.imagen_url || '',
            resultado_titulo: sector.resultado_titulo || '',
            resultado_descripcion: sector.resultado_descripcion || ''
        });
    };

    const handleStartNewSector = () => {
        setIsCreatingNew(true);
        setSelectedSectorId(null);
        // Sugerir el siguiente color alternado
        const nextColor = afinixPalette[sectores.length % afinixPalette.length].hex;
        setSectorForm({
            id: null,
            titulo: '',
            tipo_premio: 'porcentaje',
            valor: '15',
            descripcion: '',
            color_hex: nextColor,
            texto_color: '#ffffff',
            probabilidad_peso: '15',
            stock_disponible: '',
            imagen_url: '',
            resultado_titulo: '',
            resultado_descripcion: ''
        });
    };

    // Subir imagen para el sector actual
    const handleUploadSectorImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('imagen', file);

        try {
            setUploadingSectorImg(true);
            const headers = getHeaders?.() || {};
            delete headers['Content-Type'];
            const res = await apiClient.post('/api/marketing/campanas/imagen', formData, {
                headers: { ...headers }
            });
            if (res?.imagen_url) {
                setSectorForm((prev) => ({ ...prev, imagen_url: res.imagen_url }));
                // Si estamos editando un sector existente, reflejar optimistamente en la lista
                if (!isCreatingNew && selectedSectorId && onUpdateSectoresLocally) {
                    onUpdateSectoresLocally(prev => prev.map(s => s.id === selectedSectorId ? { ...s, imagen_url: res.imagen_url } : s));
                }
                toast.success('Imagen del sector subida exitosamente');
            }
        } catch {
            toast.error('Error al subir la imagen del sector');
        } finally {
            setUploadingSectorImg(false);
            e.target.value = '';
        }
    };

    // Subir imagen de fondo general de la ruleta
    const handleUploadBgImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('imagen', file);

        try {
            setUploadingBg(true);
            const headers = getHeaders?.() || {};
            delete headers['Content-Type'];
            const res = await apiClient.post('/api/marketing/campanas/imagen', formData, {
                headers: { ...headers }
            });
            if (res?.imagen_url) {
                const newConfig = { ...config, fondo_url: res.imagen_url };
                setConfig(newConfig);
                await apiClient.put('/api/marketing/ruleta/config', newConfig, { headers: getHeaders?.() });
                toast.success('Imagen de fondo guardada');
            }
        } catch {
            toast.error('Error al subir imagen de fondo');
        } finally {
            setUploadingBg(false);
            e.target.value = '';
        }
    };

    // Guardar configuración general (tiempo de animación, fondo, etc.)
    const handleSaveGeneralConfig = async (e) => {
        e?.preventDefault();
        try {
            setSavingConfig(true);
            await apiClient.put('/api/marketing/ruleta/config', config, { headers: getHeaders?.() });
            toast.success('Configuración general de la ruleta guardada');
        } catch {
            toast.error('Error al guardar configuración');
        } finally {
            setSavingConfig(false);
        }
    };

    // Guardar sector (crear o actualizar) de forma optimista y en tiempo real
    const handleSaveSector = async (e) => {
        e?.preventDefault();
        if (!sectorForm.titulo.trim()) {
            toast.error('El título o etiqueta del sector es obligatorio');
            return;
        }

        try {
            setSavingSector(true);
            const payload = {
                ...sectorForm,
                orden: isCreatingNew ? sectores.length : (sectores.find(s => s.id === sectorForm.id)?.orden ?? 0)
            };

            if (isCreatingNew) {
                const res = await apiClient.post('/api/marketing/ruleta/premios', payload, { headers: getHeaders?.() });
                toast.success('Nuevo sector añadido a la ruleta');
                const createdSector = res?.data;
                if (createdSector && onUpdateSectoresLocally) {
                    onUpdateSectoresLocally(prev => [...prev, createdSector]);
                    handleSelectSector(createdSector);
                } else {
                    await onReloadSectores?.();
                }
            } else {
                // Actualización optimista inmediata
                if (onUpdateSectoresLocally) {
                    onUpdateSectoresLocally(prev => prev.map(s => s.id === sectorForm.id ? { ...s, ...payload } : s));
                }
                const res = await apiClient.put(`/api/marketing/ruleta/premios/${sectorForm.id}`, payload, { headers: getHeaders?.() });
                toast.success('Sector actualizado con éxito');
                if (res?.data && onUpdateSectoresLocally) {
                    onUpdateSectoresLocally(prev => prev.map(s => s.id === sectorForm.id ? res.data : s));
                }
            }
        } catch {
            toast.error('Error al guardar los datos del sector');
            // Revertir sincronizando desde el backend en caso de fallo
            await onReloadSectores?.();
        } finally {
            setSavingSector(false);
        }
    };

    // Duplicar sector
    const handleDuplicateSector = async (sector) => {
        try {
            const payload = {
                titulo: `${sector.titulo} (Copia)`,
                tipo_premio: sector.tipo_premio,
                valor: sector.valor,
                descripcion: sector.descripcion,
                color_hex: sector.color_hex,
                texto_color: sector.texto_color,
                probabilidad_peso: sector.probabilidad_peso,
                stock_disponible: sector.stock_disponible,
                imagen_url: sector.imagen_url,
                resultado_titulo: sector.resultado_titulo,
                resultado_descripcion: sector.resultado_descripcion,
                orden: sectores.length
            };
            const res = await apiClient.post('/api/marketing/ruleta/premios', payload, { headers: getHeaders?.() });
            toast.success('Sector duplicado exitosamente');
            if (res?.data && onUpdateSectoresLocally) {
                onUpdateSectoresLocally(prev => [...prev, res.data]);
                handleSelectSector(res.data);
            } else {
                await onReloadSectores?.();
            }
        } catch {
            toast.error('Error al duplicar el sector');
        }
    };

    // Eliminar sector con remoción inmediata optimista tras confirmación modal
    const handleConfirmDeleteSector = async () => {
        if (!sectorToDelete) return;
        const id = sectorToDelete.id;
        const previousSectores = [...sectores];
        const remaining = sectores.filter(s => s.id !== id);
        if (onUpdateSectoresLocally) {
            onUpdateSectoresLocally(remaining);
        }
        if (remaining.length > 0) handleSelectSector(remaining[0]);
        else handleStartNewSector();
        setSectorToDelete(null);

        try {
            await apiClient.delete(`/api/marketing/ruleta/premios/${id}`, { headers: getHeaders?.() });
            toast.success('Sector eliminado de la ruleta');
        } catch {
            toast.error('Error al eliminar sector');
            if (onUpdateSectoresLocally) onUpdateSectoresLocally(previousSectores);
        }
    };

    // Reordenar sectores en tiempo real optimista (Mover arriba / abajo sin flickers)
    const handleMoveSector = async (index, direction) => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= sectores.length) return;

        const previousOrder = [...sectores];
        const newOrder = [...sectores];
        const temp = newOrder[index];
        newOrder[index] = newOrder[targetIndex];
        newOrder[targetIndex] = temp;

        // Actualización optimista instantánea (0ms de lag visual)
        if (onUpdateSectoresLocally) {
            onUpdateSectoresLocally(newOrder);
        }

        const ordenIds = newOrder.map(s => s.id);
        try {
            await apiClient.put('/api/marketing/ruleta/premios/reordenar', { ordenIds }, { headers: getHeaders?.() });
            toast.success('Orden de sectores actualizado');
        } catch {
            toast.error('Error al reordenar sectores');
            // Revertir si falló
            if (onUpdateSectoresLocally) onUpdateSectoresLocally(previousOrder);
        }
    };

    // Toggle activo/pausado instantáneo
    const handleToggleSector = async (id) => {
        if (onUpdateSectoresLocally) {
            onUpdateSectoresLocally(prev => prev.map(s => s.id === id ? { ...s, activo: !s.activo } : s));
        }
        try {
            await apiClient.patch(`/api/marketing/ruleta/premios/${id}/toggle`, {}, { headers: getHeaders?.() });
            toast.success('Estado del sector actualizado');
        } catch {
            toast.error('Error al cambiar estado del sector');
            await onReloadSectores?.();
        }
    };

    // Cargar imagen en caché para renderizado en Canvas
    const getImage = (url) => {
        if (!url) return null;
        if (loadedImagesRef.current.has(url)) {
            const cached = loadedImagesRef.current.get(url);
            return cached.complete && cached.naturalWidth > 0 ? cached : null;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            loadedImagesRef.current.set(url, img);
            drawPreviewWheel(previewAngleRef.current);
        };
        loadedImagesRef.current.set(url, img);
        return null;
    };

    // DIBUJAR RULETA EN VISTA PREVIA (CANVAS)
    const drawPreviewWheel = (angle = 0) => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 16;

        ctx.clearRect(0, 0, width, height);

        // Previsualizar sectores: usar la lista actual, pero si se está editando uno en el form,
        // reflejar sus cambios en tiempo real en la rebanada correspondiente
        let previewSlices = sectores.map(s => {
            if (s.id === sectorForm.id) {
                return { ...s, ...sectorForm };
            }
            return s;
        });

        if (isCreatingNew && sectorForm.titulo) {
            previewSlices = [...previewSlices, { ...sectorForm, id: 'temp-new' }];
        }

        if (!previewSlices.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin sectores configurados', centerX, centerY);
            return;
        }

        const numSegments = previewSlices.length;
        const arc = (2 * Math.PI) / numSegments;

        // Borde exterior AFINIX LAB (Neón celeste con base azul cobalto profundo)
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 12, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        // Aro de base azul AFINIX
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        // Helper para dibujar piña vectorial 100% simétrica, estética y centrada en el eje radial
        const drawSymmetricPineapple = (c, size) => {
            c.save();
            const w = size * 0.54;
            const h = size * 0.74;

            // 1. Sombra suave de contacto
            c.save();
            c.beginPath();
            c.ellipse(h * 0.58, 0, h * 0.14, w * 0.46, 0, 0, 2 * Math.PI);
            c.fillStyle = 'rgba(15, 23, 42, 0.08)';
            c.fill();
            c.restore();

            // 2. Corona de hojas tropicales estilizadas (multicapa con nervaduras)
            c.save();
            // Capa trasera (verde bosque oscuro para profundidad)
            c.fillStyle = '#047857';
            c.strokeStyle = '#064e3b';
            c.lineWidth = 1.1;

            // Hoja trasera superior
            c.beginPath();
            c.moveTo(-h * 0.22, -w * 0.12);
            c.quadraticCurveTo(-h * 0.65, -w * 0.60, -h * 0.84, -w * 0.58);
            c.quadraticCurveTo(-h * 0.55, -w * 0.25, -h * 0.20, -w * 0.05);
            c.fill();
            c.stroke();

            // Hoja trasera inferior (simetría perfecta)
            c.beginPath();
            c.moveTo(-h * 0.22, w * 0.12);
            c.quadraticCurveTo(-h * 0.65, w * 0.60, -h * 0.84, w * 0.58);
            c.quadraticCurveTo(-h * 0.55, w * 0.25, -h * 0.20, w * 0.05);
            c.fill();
            c.stroke();

            // Capa intermedia (verde esmeralda brillante)
            c.fillStyle = '#059669';
            c.strokeStyle = '#047857';

            // Hoja intermedia superior
            c.beginPath();
            c.moveTo(-h * 0.24, -w * 0.10);
            c.quadraticCurveTo(-h * 0.72, -w * 0.38, -h * 0.94, -w * 0.34);
            c.quadraticCurveTo(-h * 0.62, -w * 0.12, -h * 0.22, 0);
            c.fill();
            c.stroke();

            // Hoja intermedia inferior (simetría perfecta)
            c.beginPath();
            c.moveTo(-h * 0.24, w * 0.10);
            c.quadraticCurveTo(-h * 0.72, w * 0.38, -h * 0.94, w * 0.34);
            c.quadraticCurveTo(-h * 0.62, w * 0.12, -h * 0.22, 0);
            c.fill();
            c.stroke();

            // Capa frontal: Hoja central majestuosa
            c.fillStyle = '#10b981';
            c.strokeStyle = '#047857';
            c.lineWidth = 1.3;
            c.beginPath();
            c.moveTo(-h * 0.26, -w * 0.14);
            c.quadraticCurveTo(-h * 0.70, -w * 0.16, -h * 1.05, 0);
            c.quadraticCurveTo(-h * 0.70, w * 0.16, -h * 0.26, w * 0.14);
            c.closePath();
            c.fill();
            c.stroke();

            // Nervadura / resplandor de hojas en verde lima
            c.strokeStyle = '#6ee7b7';
            c.lineWidth = 1.1;
            c.beginPath();
            c.moveTo(-h * 0.26, 0);
            c.lineTo(-h * 0.96, 0);
            c.moveTo(-h * 0.24, -w * 0.08);
            c.quadraticCurveTo(-h * 0.58, -w * 0.22, -h * 0.86, -w * 0.28);
            c.moveTo(-h * 0.24, w * 0.08);
            c.quadraticCurveTo(-h * 0.58, w * 0.22, -h * 0.86, w * 0.28);
            c.stroke();
            c.restore();

            // 3. Cuerpo de la piña (silueta curva orgánica y gradiente cálido con volumen)
            c.save();
            c.beginPath();
            c.moveTo(-h * 0.22, 0);
            c.bezierCurveTo(-h * 0.22, -w * 0.52, h * 0.18, -w * 0.55, h * 0.54, -w * 0.26);
            c.bezierCurveTo(h * 0.66, -w * 0.12, h * 0.66, w * 0.12, h * 0.54, w * 0.26);
            c.bezierCurveTo(h * 0.18, w * 0.55, -h * 0.22, w * 0.52, -h * 0.22, 0);
            c.closePath();

            const grad = c.createLinearGradient(-h * 0.22, -w * 0.35, h * 0.65, w * 0.35);
            grad.addColorStop(0, '#fef08a'); // resplandor amarillo superior
            grad.addColorStop(0.3, '#fbbf24'); // ámbar cálido
            grad.addColorStop(0.7, '#f59e0b'); // dorado miel
            grad.addColorStop(1, '#d97706'); // sombra caramelo
            c.fillStyle = grad;
            c.shadowColor = 'rgba(180, 83, 9, 0.25)';
            c.shadowBlur = 6;
            c.fill();
            c.shadowBlur = 0;
            c.lineWidth = 1.4;
            c.strokeStyle = '#b45309';
            c.stroke();

            // Textura y escamas internas (recortadas al cuerpo)
            c.save();
            c.clip();

            // Rejilla de escamas biseladas
            c.strokeStyle = 'rgba(180, 83, 9, 0.45)';
            c.lineWidth = 1.2;
            const step = w * 0.28;
            for (let off = -h; off <= h * 1.6; off += step) {
                c.beginPath();
                c.moveTo(off, -w);
                c.lineTo(off + w * 0.9, w);
                c.stroke();

                c.beginPath();
                c.moveTo(off + w * 0.9, -w);
                c.lineTo(off, w);
                c.stroke();
            }

            // Ojos / acentos dorados simétricos en cada escama
            const scalePoints = [
                { x: 0, y: 0 },
                { x: h * 0.22, y: 0 },
                { x: h * 0.42, y: 0 },
                { x: -h * 0.05, y: -w * 0.22 },
                { x: -h * 0.05, y: w * 0.22 },
                { x: h * 0.18, y: -w * 0.24 },
                { x: h * 0.18, y: w * 0.24 },
                { x: h * 0.38, y: -w * 0.18 },
                { x: h * 0.38, y: w * 0.18 }
            ];
            scalePoints.forEach(pt => {
                c.beginPath();
                c.arc(pt.x, pt.y, Math.max(1.1, size * 0.024), 0, 2 * Math.PI);
                c.fillStyle = 'rgba(180, 83, 9, 0.75)';
                c.fill();

                c.beginPath();
                c.arc(pt.x - 0.7, pt.y - 0.7, Math.max(0.6, size * 0.013), 0, 2 * Math.PI);
                c.fillStyle = 'rgba(254, 240, 138, 0.95)';
                c.fill();
            });

            // Brillo especular lateral superior (look moderno)
            c.beginPath();
            c.ellipse(h * 0.08, -w * 0.26, h * 0.28, w * 0.12, -0.2, 0, 2 * Math.PI);
            c.fillStyle = 'rgba(255, 255, 255, 0.25)';
            c.fill();

            c.restore();

            // Corona collar en la base de las hojas
            c.fillStyle = '#047857';
            c.beginPath();
            c.moveTo(-h * 0.25, -w * 0.16);
            c.lineTo(-h * 0.16, -w * 0.08);
            c.lineTo(-h * 0.25, 0);
            c.lineTo(-h * 0.16, w * 0.08);
            c.lineTo(-h * 0.25, w * 0.16);
            c.lineTo(-h * 0.20, 0);
            c.closePath();
            c.fill();

            c.restore();
            c.restore();
        };

        // Dibujar sectores alternados (Azul AFINIX y Blanco)
        previewSlices.forEach((slice, i) => {
            const startAngle = angle + i * arc;
            const endAngle = startAngle + arc;

            const isPina = slice.tipo_premio === 'sin_premio' || (slice.titulo && slice.titulo.toUpperCase().includes('PIÑA'));

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            if (!isPina) {
                const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                grad.addColorStop(0, '#0284c7');
                grad.addColorStop(1, '#0369a1');
                ctx.fillStyle = grad;
            } else {
                const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(1, '#f8fafc');
                ctx.fillStyle = grad;
            }
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff'; // divisor blanco limpio
            ctx.stroke();

            // Contenido en el sector
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + arc / 2);

            const sliceImg = getImage(slice.imagen_url);

            if (!isPina) {
                // SECTOR CON PREMIO: Descuento explícito en alto contraste
                const dist = radius * 0.77;
                ctx.translate(dist, 0);
                ctx.rotate(Math.PI / 2); // perpendicular al radio

                // Extraer el monto limpio para jerarquía visual
                const rawTitle = (slice.titulo || '').trim();
                let amountText = rawTitle;
                if (rawTitle.toUpperCase().includes('DCTO')) {
                    amountText = rawTitle.replace(/DCTO\.?/i, '').trim();
                } else if (rawTitle.toUpperCase().includes('DESCUENTO')) {
                    amountText = rawTitle.replace(/DESCUENTO/i, '').trim();
                }
                if (!amountText) amountText = `S/. ${slice.valor || 0}`;

                // 1. Monto grande y destacado
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const fontSize = Math.max(11, Math.round(radius * 0.082));
                ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
                ctx.shadowBlur = 4;
                ctx.fillText(amountText, 0, -fontSize * 0.88);

                // 2. Badge cápsula "DESCUENTO" (aclara 100% que no es dinero regalado)
                ctx.shadowBlur = 0;
                const badgeW = Math.max(50, Math.round(fontSize * 3.4));
                const badgeH = Math.max(12, Math.round(fontSize * 0.78));
                const bx = -badgeW / 2;
                const by = -badgeH * 0.35;

                ctx.save();
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, badgeW, badgeH, badgeH / 2);
                } else {
                    ctx.rect(bx, by, badgeW, badgeH);
                }
                ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#38bdf8';
                ctx.stroke();

                ctx.font = `800 ${Math.max(7, Math.round(fontSize * 0.44))}px system-ui, sans-serif`;
                ctx.fillStyle = '#e0f2fe';
                ctx.letterSpacing = '0.05em';
                ctx.fillText('DESCUENTO', 0, by + badgeH / 2 + 0.5);
                ctx.restore();

                // 3. Ícono abajo hacia el centro
                if (sliceImg) {
                    const imgSize = Math.max(18, Math.round(radius * 0.15));
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(0, imgSize * 0.85, imgSize / 2, 0, 2 * Math.PI);
                    ctx.clip();
                    ctx.drawImage(sliceImg, -imgSize / 2, imgSize * 0.35, imgSize, imgSize);
                    ctx.restore();
                } else {
                    const val = Number(slice.valor) || 0;
                    let icon = '💰';
                    if (val >= 100) icon = '🏆';
                    else if (val >= 50) icon = '🎉';
                    else if (val >= 30) icon = '💰';
                    else icon = '⭐';

                    const iconSize = Math.max(14, Math.round(radius * 0.12));
                    ctx.font = `${iconSize}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                    ctx.fillText(icon, 0, iconSize * 1.15);
                }
            } else {
                // SECTOR PIÑA: 100% alineada en su eje central con el centro de la ruleta y situada en el tercio exterior
                const dist = radius * 0.73;
                ctx.translate(dist, 0);
                // Invertimos para que las hojas apunten hacia el exterior y la base al centro
                ctx.rotate(Math.PI);

                const pinaSize = Math.max(26, Math.round(radius * 0.20));
                drawSymmetricPineapple(ctx, pinaSize);
            }

            ctx.restore();
        });

        // Luces / Pines exteriores alrededor de la ruleta (24 bombillas neón)
        for (let i = 0; i < numSegments * 2; i++) {
            const pinAngle = angle + (i * Math.PI) / numSegments;
            const pinX = centerX + Math.cos(pinAngle) * (radius + 6);
            const pinY = centerY + Math.sin(pinAngle) * (radius + 6);

            ctx.save();
            ctx.beginPath();
            ctx.arc(pinX, pinY, 3.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();
            ctx.restore();
        }

        // Centro / Hub BLANCO Oficial AFINIX con Logo
        const hubRadius = Math.round(radius * 0.22);
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(2, 132, 199, 0.4)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();

        // Aro interno celeste en el buje blanco
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius - 5, 0, 2 * Math.PI);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#bae6fd';
        ctx.stroke();

        const logoImg = getImage(isoLight);
        if (logoImg) {
            const logoSize = hubRadius * 1.35;
            ctx.drawImage(logoImg, centerX - logoSize / 2, centerY - logoSize / 2, logoSize, logoSize);
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0f172a';
            ctx.font = `900 ${Math.round(hubRadius * 0.38)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('AFINIX', centerX, centerY - hubRadius * 0.18);
            ctx.font = `800 ${Math.round(hubRadius * 0.26)}px system-ui, sans-serif`;
            ctx.fillStyle = '#0284c7';
            ctx.fillText('LAB', centerX, centerY + hubRadius * 0.24);
        }
        ctx.restore();
    };

    // Redibujar canvas cuando cambian los sectores o el formulario
    useEffect(() => {
        drawPreviewWheel(previewAngleRef.current);
    }, [sectores, sectorForm, isCreatingNew]);

    // Giro de prueba en la vista previa (direct canvas redraw without React re-renders)
    const handleTestSpin = () => {
        if (isPreviewSpinning || !sectores.length) return;
        setIsPreviewSpinning(true);

        const duration = (config.tiempo_animacion_segundos || 4) * 1000;
        const startAngle = previewAngleRef.current;
        const totalDistance = 5 * (2 * Math.PI) + Math.random() * (2 * Math.PI);
        const targetAngle = startAngle + totalDistance;
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = startAngle + (targetAngle - startAngle) * ease;
            previewAngleRef.current = current;
            drawPreviewWheel(current);

            if (progress < 1) {
                testSpinAnimRef.current = requestAnimationFrame(animate);
            } else {
                testSpinAnimRef.current = null;
                setIsPreviewSpinning(false);
            }
        };

        testSpinAnimRef.current = requestAnimationFrame(animate);
    };

    return (
        <div className="ruleta-interacty-customizer animate-fade-in">
            {/* ======================================================== */}
            {/* COLUMNA IZQUIERDA: PESTAÑAS Y CONFIGURADOR INTERACTY     */}
            {/* ======================================================== */}
            <div className="ruleta-customizer-controls card" style={{
                padding: '1.25rem',
                borderRadius: '16px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {/* Pestañas de configuración estilo Interacty */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.75rem',
                    marginBottom: '1.25rem'
                }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${activeTab === 'sectores' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('sectores')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                    >
                        <i className="bi bi-pie-chart-fill" aria-hidden="true"></i>
                        Sectores de la Ruleta ({sectores.length})
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${activeTab === 'general' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('general')}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                    >
                        <i className="bi bi-palette-fill" aria-hidden="true"></i>
                        Diseño & Animación
                    </button>
                </div>

                {/* ==================================================== */}
                {/* PESTAÑA 1: SECTORES & PREMIOS                        */}
                {/* ==================================================== */}
                {activeTab === 'sectores' && (
                    <div>
                        {/* Selector / Lista ordenable de sectores (Top bar) */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <label className="form-label" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Lista de Sectores (Orden en Ruleta)
                                </label>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={handleStartNewSector}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.2rem 0.55rem' }}
                                >
                                    <i className="bi bi-plus-lg" aria-hidden="true"></i>
                                    Añadir Sector
                                </button>
                            </div>

                            {/* Resumen de probabilidad activa */}
                            <div style={{
                                display: 'flex',
                                gap: '0.85rem',
                                flexWrap: 'wrap',
                                background: 'var(--color-bg-alt)',
                                padding: '0.55rem 0.85rem',
                                borderRadius: '8px',
                                marginBottom: '0.75rem',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.8rem'
                            }}>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Sectores Totales:</span>{' '}
                                    <strong>{sectores.length}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>En Giro Activo:</span>{' '}
                                    <strong style={{ color: 'var(--color-primary)' }}>{activeSectors.length}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-secondary)' }}>Peso Total Acumulado:</span>{' '}
                                    <strong>{effectiveTotalPeso} pts</strong>
                                </div>
                            </div>

                            {/* Mini tarjetas horizontales de cada sector */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem',
                                maxHeight: '220px',
                                overflowY: 'auto',
                                paddingRight: '4px',
                                border: '1px solid var(--color-border)',
                                borderRadius: '10px',
                                padding: '0.5rem',
                                background: 'var(--color-bg-alt)'
                            }}>
                                {sectores.map((s, idx) => {
                                    const isSelected = !isCreatingNew && selectedSectorId === s.id;
                                    const probPct = s.probabilidad_porcentaje ?? (effectiveTotalPeso > 0 ? Number(((Number(s.probabilidad_peso || 0) / effectiveTotalPeso) * 100).toFixed(1)) : 0);
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => handleSelectSector(s)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.45rem 0.65rem',
                                                borderRadius: '8px',
                                                background: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                                                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                                                {/* Color Swatch & Index */}
                                                <div style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '4px',
                                                    backgroundColor: s.color_hex || '#0284c7',
                                                    flexShrink: 0
                                                }} />
                                                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                                                    #{idx + 1}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.84rem',
                                                    fontWeight: isSelected ? 700 : 500,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: 'var(--color-text)'
                                                }}>
                                                    {s.titulo}
                                                </span>
                                                {s.imagen_url && (
                                                    <i className="bi bi-image text-primary" title="Tiene imagen" style={{ fontSize: '0.75rem' }}></i>
                                                )}
                                                {!s.activo && (
                                                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 5px', background: 'var(--color-bg-alt)', color: 'var(--color-text-secondary)' }}>
                                                        Pausado
                                                    </span>
                                                )}
                                            </div>

                                            {/* Peso y Porcentaje de Probabilidad */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                flexShrink: 0,
                                                marginRight: '0.5rem'
                                            }}>
                                                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                                    {s.probabilidad_peso || 10} pts
                                                </span>
                                                <span className="badge" style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    background: s.activo ? 'rgba(2, 132, 199, 0.12)' : 'var(--color-bg-alt)',
                                                    color: s.activo ? '#0284c7' : 'var(--color-text-secondary)'
                                                }}>
                                                    {s.activo ? `${probPct}%` : '0%'}
                                                </span>
                                            </div>

                                            {/* Acciones de reordenamiento */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleMoveSector(idx, 'up')}
                                                    disabled={idx === 0}
                                                    title="Mover arriba"
                                                    style={{ padding: '0.15rem 0.3rem', fontSize: '0.75rem' }}
                                                >
                                                    <i className="bi bi-chevron-up"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleMoveSector(idx, 'down')}
                                                    disabled={idx === sectores.length - 1}
                                                    title="Mover abajo"
                                                    style={{ padding: '0.15rem 0.3rem', fontSize: '0.75rem' }}
                                                >
                                                    <i className="bi bi-chevron-down"></i>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Editor del Sector Seleccionado */}
                        <div style={{
                            borderTop: '1px solid var(--color-border)',
                            paddingTop: '1rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <i className="bi bi-pencil-square text-primary"></i>
                                    {isCreatingNew ? 'Añadir Nuevo Sector' : `Editando Sector #${sectores.findIndex(s => s.id === selectedSectorId) + 1}`}
                                </h4>
                                {!isCreatingNew && selectedSectorId && (
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => {
                                                const current = sectores.find(s => s.id === selectedSectorId);
                                                if (current) handleDuplicateSector(current);
                                            }}
                                            title="Duplicar este sector"
                                            style={{ fontSize: '0.78rem' }}
                                        >
                                            <i className="bi bi-copy" style={{ marginRight: '3px' }}></i> Duplicar
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-ghost marketing-danger-action"
                                            onClick={() => setSectorToDelete(sectores.find(s => s.id === selectedSectorId))}
                                            title="Eliminar este sector"
                                            style={{ fontSize: '0.78rem' }}
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSaveSector}>
                                {/* Título y Tipo de Premio */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                            Etiqueta / Título <span style={{ color: 'var(--color-error)' }}>*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ej. 15% DCTO, Agenda 2026, S/. 50"
                                            value={sectorForm.titulo}
                                            onChange={(e) => setSectorForm(prev => ({ ...prev, titulo: e.target.value }))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                            Tipo de Premio <span style={{ color: 'var(--color-error)' }}>*</span>
                                        </label>
                                        <CustomSelect
                                            options={prizeTypeOptions}
                                            value={sectorForm.tipo_premio}
                                            onChange={(_, val) => setSectorForm(prev => ({ ...prev, tipo_premio: val }))}
                                        />
                                    </div>
                                </div>

                                {/* Valor numérico (si es porcentaje o soles) */}
                                {['porcentaje', 'monto_fijo'].includes(sectorForm.tipo_premio) && (
                                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                            {sectorForm.tipo_premio === 'porcentaje' ? 'Porcentaje de Descuento (%)' : 'Monto de Descuento en Soles (S/.)'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="form-input"
                                            placeholder={sectorForm.tipo_premio === 'porcentaje' ? '15' : '50.00'}
                                            value={sectorForm.valor}
                                            onChange={(e) => setSectorForm(prev => ({ ...prev, valor: e.target.value }))}
                                            required
                                        />
                                    </div>
                                )}

                                {/* Imagen del Sector (Interacty Style) */}
                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Imagen del Sector (Ícono / Regalo)</span>
                                        {sectorForm.imagen_url && (
                                            <button
                                                type="button"
                                                className="btn btn-link btn-sm"
                                                onClick={() => setSectorForm(prev => ({ ...prev, imagen_url: '' }))}
                                                style={{ padding: 0, fontSize: '0.72rem', color: 'var(--color-error)' }}
                                            >
                                                Quitar imagen
                                            </button>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {sectorForm.imagen_url ? (
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--color-border)',
                                                overflow: 'hidden',
                                                background: '#000',
                                                flexShrink: 0
                                            }}>
                                                <img src={sectorForm.imagen_url} alt="Premio" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            </div>
                                        ) : (
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '8px',
                                                border: '1px dashed var(--color-border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-text-secondary)',
                                                fontSize: '1.1rem',
                                                flexShrink: 0
                                            }}>
                                                <i className="bi bi-image"></i>
                                            </div>
                                        )}
                                        <label className={`btn btn-sm btn-secondary ${uploadingSectorImg ? 'disabled' : ''}`} style={{ cursor: 'pointer', margin: 0 }}>
                                            <i className="bi bi-upload" style={{ marginRight: '4px' }}></i>
                                            {uploadingSectorImg ? 'Subiendo...' : sectorForm.imagen_url ? 'Cambiar Imagen' : 'Subir Imagen'}
                                            <input type="file" accept="image/*" onChange={handleUploadSectorImage} style={{ display: 'none' }} disabled={uploadingSectorImg} />
                                        </label>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '3px', display: 'block' }}>
                                        Aparecerá centrada en la rebanada de la ruleta (PNG transparente recomendado).
                                    </span>
                                </div>

                                {/* Probabilidad (Presets rápidos estilo Interacty) */}
                                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                                    {(() => {
                                        const otherActiveWeight = sectores
                                            .filter(s => s.id !== sectorForm.id && s.activo && (!s.stock_disponible || s.stock_entregado < s.stock_disponible))
                                            .reduce((sum, s) => sum + (Number(s.probabilidad_peso) || 0), 0);
                                        const formWeight = Number(sectorForm.probabilidad_peso) || 0;
                                        const totalFormWeight = otherActiveWeight + formWeight;
                                        const formProbPct = totalFormWeight > 0 ? ((formWeight / totalFormWeight) * 100).toFixed(1) : 0;
                                        return (
                                            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span>
                                                    Probabilidad de Salida: <strong>{sectorForm.probabilidad_peso} pts</strong>
                                                </span>
                                                <span className="badge" style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px' }}>
                                                    {formProbPct}% de probabilidad
                                                </span>
                                            </label>
                                        );
                                    })()}
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                        {probabilityPresets.map(preset => (
                                            <button
                                                key={preset.weight}
                                                type="button"
                                                className={`btn btn-sm ${Number(sectorForm.probabilidad_peso) === preset.weight ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                onClick={() => setSectorForm(prev => ({ ...prev, probabilidad_peso: String(preset.weight) }))}
                                                style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>O peso personalizado:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="500"
                                            className="form-input"
                                            style={{ width: '85px', padding: '0.2rem 0.5rem', fontSize: '0.78rem', height: '30px' }}
                                            value={sectorForm.probabilidad_peso}
                                            onChange={(e) => setSectorForm(prev => ({ ...prev, probabilidad_peso: e.target.value }))}
                                        />
                                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>puntos</span>
                                    </div>
                                </div>

                                {/* Color de la Rebanada */}
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                                        Color del Sector (Paleta AFINIX)
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {afinixPalette.map(c => (
                                            <button
                                                key={c.hex}
                                                type="button"
                                                onClick={() => setSectorForm(prev => ({ ...prev, color_hex: c.hex }))}
                                                style={{
                                                    width: '26px',
                                                    height: '26px',
                                                    borderRadius: '6px',
                                                    backgroundColor: c.hex,
                                                    border: sectorForm.color_hex === c.hex ? '3px solid var(--color-text)' : '1px solid var(--color-border)',
                                                    cursor: 'pointer'
                                                }}
                                                title={c.label}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={sectorForm.color_hex}
                                            onChange={(e) => setSectorForm(prev => ({ ...prev, color_hex: e.target.value }))}
                                            style={{ width: '32px', height: '26px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            title="Color personalizado"
                                        />
                                    </div>
                                </div>

                                {/* Botón Guardar Sector */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={savingSector}
                                        style={{ fontWeight: 700, padding: '0.5rem 1.25rem' }}
                                    >
                                        {savingSector ? 'Guardando...' : isCreatingNew ? 'Añadir a la Ruleta' : 'Guardar Cambios del Sector'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==================================================== */}
                {/* PESTAÑA 2: CONFIGURACIÓN GENERAL (FONDO & ANIMACIÓN) */}
                {/* ==================================================== */}
                {activeTab === 'general' && (
                    <form onSubmit={handleSaveGeneralConfig}>
                        {/* Tiempo de animación de giro (3 - 4 segundos) */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                Duración del Giro: <strong>{config.tiempo_animacion_segundos} segundos</strong>
                            </label>
                            <input
                                type="range"
                                min="2"
                                max="7"
                                step="1"
                                className="form-range"
                                value={config.tiempo_animacion_segundos}
                                onChange={(e) => setConfig(prev => ({ ...prev, tiempo_animacion_segundos: Number(e.target.value) }))}
                                style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                <span>2s (Rápido)</span>
                                <span>3s</span>
                                <span>4s (Recomendado)</span>
                                <span>5s</span>
                                <span>7s (Emoción Máxima)</span>
                            </div>
                        </div>

                        {/* Imagen de fondo de la pantalla completa */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                                <span>Imagen de Fondo (Kiosco / Pantalla Completa)</span>
                                {config.fondo_url && (
                                    <button
                                        type="button"
                                        className="btn btn-link btn-sm"
                                        onClick={() => setConfig(prev => ({ ...prev, fondo_url: '' }))}
                                        style={{ padding: 0, fontSize: '0.72rem', color: 'var(--color-error)' }}
                                    >
                                        Eliminar fondo
                                    </button>
                                )}
                            </label>
                            <div style={{
                                border: '2px dashed var(--color-border)',
                                borderRadius: '12px',
                                padding: '1rem',
                                textAlign: 'center',
                                background: config.fondo_url ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${config.fondo_url}) center/cover` : 'var(--color-bg-alt)',
                                color: config.fondo_url ? '#ffffff' : 'inherit'
                            }}>
                                <i className="bi bi-card-image" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.4rem', opacity: 0.7 }}></i>
                                <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem' }}>
                                    {config.fondo_url ? 'Imagen de fondo configurada' : 'Sube tu imagen de fondo generada por IA o diseño'}
                                </p>
                                <label className={`btn btn-sm ${config.fondo_url ? 'btn-outline-light' : 'btn-primary'} ${uploadingBg ? 'disabled' : ''}`} style={{ cursor: 'pointer', margin: 0 }}>
                                    <i className="bi bi-upload" style={{ marginRight: '4px' }}></i>
                                    {uploadingBg ? 'Subiendo...' : config.fondo_url ? 'Cambiar Imagen de Fondo' : 'Seleccionar Archivo de Fondo'}
                                    <input type="file" accept="image/*" onChange={handleUploadBgImage} style={{ display: 'none' }} disabled={uploadingBg} />
                                </label>
                            </div>
                        </div>

                        {/* Pasador Central */}
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                Pasador Central (Hub de la Ruleta)
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--color-bg-alt)', borderRadius: '10px' }}>
                                <img src={isoLight} alt="AFINIX Logo" style={{ width: '40px', height: '40px', background: '#0f172a', padding: '4px', borderRadius: '50%' }} />
                                <div>
                                    <strong style={{ fontSize: '0.84rem', display: 'block' }}>Logo Oficial AFINIX LAB en Blanco</strong>
                                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                                        Centrado permanente en el rotor con iluminación azul cobalto.
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={savingConfig}
                                style={{ fontWeight: 700, padding: '0.5rem 1.25rem' }}
                            >
                                {savingConfig ? 'Guardando...' : 'Guardar Ajustes'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* ======================================================== */}
            {/* COLUMNA DERECHA: VISTA PREVIA EN VIVO (STICKY PREVIEW)   */}
            {/* ======================================================== */}
            <div className="ruleta-live-preview-card card" style={{
                padding: '1.25rem',
                borderRadius: '16px',
                background: "radial-gradient(circle at center, rgba(2, 6, 23, 0.35) 0%, rgba(2, 6, 23, 0.85) 100%), url('/images/ruleta/ruleta-stage-bg.png') center center / cover no-repeat",
                color: '#ffffff',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                textAlign: 'center',
                position: 'sticky',
                top: '1rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.1)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px'
                    }}>
                        <i className="bi bi-eye-fill" style={{ marginRight: '4px' }}></i> Vista Previa en Vivo
                    </span>

                    <button
                        type="button"
                        className="btn btn-sm btn-ghost text-light"
                        onClick={handleTestSpin}
                        disabled={isPreviewSpinning}
                        title="Probar giro de prueba"
                        style={{ fontSize: '0.78rem', color: '#38bdf8' }}
                    >
                        <i className="bi bi-arrow-repeat" style={{ marginRight: '3px' }}></i> Probar Giro
                    </button>
                </div>

                {/* Contenedor del Canvas de Vista Previa con Puntero Superior */}
                <div style={{
                    position: 'relative',
                    width: 'min(320px, 80vw)',
                    height: 'min(320px, 80vw)',
                    maxWidth: '100%',
                    aspectRatio: '1 / 1',
                    margin: '0.5rem auto 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* Puntero Superior estilo Pin de Mapa */}
                    <div style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 25,
                        filter: 'drop-shadow(0 4px 10px rgba(2, 132, 199, 0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                        pointerEvents: 'none'
                    }}>
                        <svg width="34" height="42" viewBox="0 0 34 42" fill="none">
                            <path
                                d="M 17 40 C 11.5 29 3 22 3 15 A 14 14 0 1 1 31 15 C 31 22 22.5 29 17 40 Z"
                                fill="#0284c7"
                                stroke="#ffffff"
                                strokeWidth="2.5"
                            />
                            <circle cx="17" cy="14" r="4.5" fill="#ffffff" />
                        </svg>
                    </div>

                    {/* Canvas */}
                    <canvas
                        ref={previewCanvasRef}
                        width={320}
                        height={320}
                        style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            boxShadow: '0 0 35px rgba(2, 132, 199, 0.3)'
                        }}
                    />
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    {sectores.length} sectores · Rotación en tiempo real
                </div>

                {/* Botón de Lanzamiento de Pantalla Completa (Kiosco) */}
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onLaunchKiosk}
                    style={{
                        width: '100%',
                        padding: '0.85rem',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.45)',
                        border: '1px solid #38bdf8'
                    }}
                >
                    <i className="bi bi-fullscreen" aria-hidden="true"></i>
                    Abrir Ruleta en Pantalla Completa
                </button>
            </div>

            {/* Modal de confirmación para eliminar sector */}
            <Modal
                open={Boolean(sectorToDelete)}
                onClose={() => setSectorToDelete(null)}
                title="Eliminar Sector de Ruleta"
                subtitle="Confirmación de seguridad"
                icon="bi-exclamation-triangle-fill"
                size="sm"
            >
                <div style={{ padding: '0.25rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                            color: 'var(--color-danger, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem',
                            flexShrink: 0,
                            boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)'
                        }}>
                            <i className="bi bi-trash3-fill" aria-hidden="true" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                ¿Eliminar este sector de la ruleta?
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                El premio dejará de aparecer en la ruleta del kiosko.
                            </div>
                        </div>
                    </div>

                    {sectorToDelete && (
                        <div style={{
                            background: 'var(--color-bg-alt)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: sectorToDelete.color_hex || '#0284c7',
                                flexShrink: 0,
                                boxShadow: `0 0 8px ${sectorToDelete.color_hex || '#0284c7'}`
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                                    {sectorToDelete.titulo}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                                    {sectorToDelete.tipo_premio} • Probabilidad: {sectorToDelete.probabilidad_peso || 10} pts
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setSectorToDelete(null)}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={handleConfirmDeleteSector}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                        >
                            <i className="bi bi-trash3" aria-hidden="true" />
                            Eliminar Sector
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
