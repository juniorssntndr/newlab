import { useCallback, useMemo, useState } from 'react';
import { computeCartTotals, normalizeOrderItem } from './orderItemNormalizer.js';

const mergeContractRawState = (item, patch) => {
    const nextRawState = {
        ...(item.rawState || {})
    };

    if (Object.prototype.hasOwnProperty.call(patch, 'cantidadManual')) {
        nextRawState.cantidadManual = patch.cantidadManual;
        nextRawState.cantidad = patch.cantidadManual;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'cantidad_manual')) {
        nextRawState.cantidadManual = patch.cantidad_manual;
        nextRawState.cantidad = patch.cantidad_manual;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'cantidad')) {
        nextRawState.cantidad = patch.cantidad;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'precio_unitario')) {
        nextRawState.precio_unitario = patch.precio_unitario;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'precio_base')) {
        nextRawState.precio_unitario = patch.precio_base;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'subtotal')) {
        nextRawState.subtotal = patch.subtotal;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'piezas_dentales')) {
        nextRawState.piezas_dentales = patch.piezas_dentales;
        nextRawState.cantidad = Array.isArray(patch.piezas_dentales) ? patch.piezas_dentales.length : 0;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'requiresDentalSelection')) {
        nextRawState.requiresDentalSelection = patch.requiresDentalSelection;
    }

    return nextRawState;
};

const createComposerItemId = () => {
    return `order-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createDraftItem = (product, initialPatch = {}) => {
    return normalizeOrderItem({
        id: createComposerItemId(),
        product,
        producto_id: product.id,
        nombre: product.nombre,
        categoria_nombre: product.categoria_nombre,
        categoria_tipo: product.categoria_tipo,
        precio_unitario: product.precio_base,
        material: product.material_nombre || product.material_default || '',
        color_vita: '',
        notas: '',
        es_puente: false,
        pieza_inicio: null,
        pieza_fin: null,
        piezas_dentales: [],
        cantidadManual: 1,
        ...initialPatch
    });
};

export const useOrderComposerState = () => {
    const [items, setItems] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [ui, setUi] = useState({ mobileStep: 1 });

    const applyToItem = useCallback((itemId, patch) => {
        setItems((prevItems) => prevItems.map((item) => {
            if (item.id !== itemId) return item;
            const mergedItem = {
                ...item,
                ...patch,
                rawState: mergeContractRawState(item, patch)
            };
            return normalizeOrderItem(mergedItem);
        }));
    }, []);

    const addProduct = useCallback((product, initialPatch = {}) => {
        const nextItem = createDraftItem(product, initialPatch);
        setItems((prevItems) => [...prevItems, nextItem]);
        return nextItem.id;
    }, []);

    const removeItem = useCallback((itemId) => {
        setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
        setSelectedItemId((current) => (current === itemId ? null : current));
    }, []);

    const selectItem = useCallback((itemId) => {
        setSelectedItemId(itemId);
    }, []);

    const updateItemField = useCallback((itemId, field, value) => {
        applyToItem(itemId, { [field]: value });
    }, [applyToItem]);

    const updateDentalSelection = useCallback((itemId, dentalData) => {
        applyToItem(itemId, {
            piezas_dentales: dentalData?.piezas_dentales || [],
            es_puente: !!dentalData?.es_puente,
            pieza_inicio: dentalData?.pieza_inicio || null,
            pieza_fin: dentalData?.pieza_fin || null
        });
    }, [applyToItem]);

    const updateQuantity = useCallback((itemId, value) => {
        applyToItem(itemId, {
            cantidadManual: value,
            cantidad_manual: value
        });
    }, [applyToItem]);

    const setMobileStep = useCallback((mobileStep) => {
        setUi((prevUi) => ({ ...prevUi, mobileStep }));
    }, []);

    const replaceItems = useCallback((nextItems) => {
        const normalized = (nextItems || []).map((item) => normalizeOrderItem(item));
        setItems(normalized);
        setSelectedItemId(null);
    }, []);

    const selectedItem = useMemo(() => {
        return items.find((item) => item.id === selectedItemId) || null;
    }, [items, selectedItemId]);

    const totals = useMemo(() => computeCartTotals(items), [items]);

    return {
        items: totals.items,
        total: totals.total,
        selectedItemId,
        selectedItem,
        ui,
        addProduct,
        removeItem,
        selectItem,
        updateItemField,
        updateDentalSelection,
        updateQuantity,
        setMobileStep,
        replaceItems,
        setItems
    };
};
