import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import * as crmApi from '../api/crmApi.js';

export const crmKeys = {
    all: ['crm'],
    summary: () => [...crmKeys.all, 'summary'],
    establecimientos: (filters) => [...crmKeys.all, 'establecimientos', filters],
    establecimiento: (id) => [...crmKeys.all, 'establecimiento', id],
    reclamos: (filters) => [...crmKeys.all, 'reclamos', filters],
    visitas: (filters) => [...crmKeys.all, 'visitas', filters],
    alertas: () => [...crmKeys.all, 'alertas'],
    doctores: (filters) => [...crmKeys.all, 'doctores', filters],
    usuarios: () => [...crmKeys.all, 'usuarios'],
};

export const useCrmSummaryQuery = () => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.summary(),
        queryFn: () => crmApi.fetchCrmSummary({ headers: getHeaders() }),
        staleTime: 30000,
    });
};

export const useCrmEstablecimientosQuery = (filters = {}) => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.establecimientos(filters),
        queryFn: () => crmApi.fetchEstablecimientos({ filters, headers: getHeaders() }),
        staleTime: 15000,
    });
};

export const useCrmEstablecimientoDetailQuery = (id, options = {}) => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.establecimiento(id),
        queryFn: () => crmApi.fetchEstablecimientoDetail({ id, headers: getHeaders() }),
        enabled: Boolean(id) && (options.enabled !== false),
    });
};

export const useCrmReclamosQuery = (filters = {}) => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.reclamos(filters),
        queryFn: () => crmApi.fetchReclamos({ filters, headers: getHeaders() }),
        staleTime: 15000,
    });
};

export const useCrmVisitasQuery = (filters = {}) => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.visitas(filters),
        queryFn: () => crmApi.fetchVisitas({ filters, headers: getHeaders() }),
        staleTime: 15000,
    });
};

export const useCrmAlertasQuery = () => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.alertas(),
        queryFn: () => crmApi.fetchAlertas({ headers: getHeaders() }),
        staleTime: 30000,
    });
};

export const useCrmDoctoresQuery = (filters = {}) => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.doctores(filters),
        queryFn: () => crmApi.fetchDoctores({ filters, headers: getHeaders() }),
        staleTime: 20000,
    });
};

export const useCrmUsuariosQuery = () => {
    const { getHeaders } = useAuth();
    return useQuery({
        queryKey: crmKeys.usuarios(),
        queryFn: () => crmApi.fetchUsuarios({ headers: getHeaders() }),
        staleTime: 60000,
    });
};

/* --- Mutations --- */

export const useCrmMutations = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    const invalidateCrm = () => {
        queryClient.invalidateQueries({ queryKey: crmKeys.all });
    };

    const createEstablecimientoMutation = useMutation({
        mutationFn: (payload) => crmApi.createEstablecimiento({ payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const updateEstablecimientoMutation = useMutation({
        mutationFn: ({ id, payload }) => crmApi.updateEstablecimiento({ id, payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const assignEstablecimientoMutation = useMutation({
        mutationFn: ({ id, responsable_id }) => crmApi.assignEstablecimiento({ id, responsable_id, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const convertEstablecimientoMutation = useMutation({
        mutationFn: ({ id, payload }) => crmApi.convertEstablecimiento({ id, payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const createReclamoMutation = useMutation({
        mutationFn: (payload) => crmApi.createReclamo({ payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const resolveReclamoMutation = useMutation({
        mutationFn: (id) => crmApi.resolveReclamo({ id, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const createVisitaMutation = useMutation({
        mutationFn: (payload) => crmApi.createVisita({ payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const updateVisitaMutation = useMutation({
        mutationFn: ({ id, payload }) => crmApi.updateVisita({ id, payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const createDoctorMutation = useMutation({
        mutationFn: (payload) => crmApi.createDoctor({ payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    const updateDoctorMutation = useMutation({
        mutationFn: ({ id, payload }) => crmApi.updateDoctor({ id, payload, headers: getHeaders() }),
        onSuccess: invalidateCrm,
    });

    return {
        createEstablecimiento: createEstablecimientoMutation.mutateAsync,
        updateEstablecimiento: updateEstablecimientoMutation.mutateAsync,
        assignEstablecimiento: assignEstablecimientoMutation.mutateAsync,
        convertEstablecimiento: convertEstablecimientoMutation.mutateAsync,
        createReclamo: createReclamoMutation.mutateAsync,
        resolveReclamo: resolveReclamoMutation.mutateAsync,
        createVisita: createVisitaMutation.mutateAsync,
        updateVisita: updateVisitaMutation.mutateAsync,
        createDoctor: createDoctorMutation.mutateAsync,
        updateDoctor: updateDoctorMutation.mutateAsync,
        isPending:
            createEstablecimientoMutation.isPending ||
            updateEstablecimientoMutation.isPending ||
            assignEstablecimientoMutation.isPending ||
            convertEstablecimientoMutation.isPending ||
            createReclamoMutation.isPending ||
            resolveReclamoMutation.isPending ||
            createVisitaMutation.isPending ||
            updateVisitaMutation.isPending ||
            createDoctorMutation.isPending ||
            updateDoctorMutation.isPending,
    };
};
