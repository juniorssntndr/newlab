import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { registerPayment } from '../api/financeApi.js';
import { financeKeys } from '../queries/financeKeys.js';
import { invalidateAfterRegisterPayment } from './invalidateRegisterPaymentQueries.js';
import { applyOptimisticPayment } from './optimisticPayment.js';

export const useRegisterPaymentMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, payload }) => registerPayment({ orderId, payload, headers: getHeaders() }),
        onMutate: async ({ orderId, payload }) => {
            await queryClient.cancelQueries({
                queryKey: financeKeys.detail(orderId),
                exact: true
            });

            const previousDetail = queryClient.getQueryData(financeKeys.detail(orderId));

            queryClient.setQueryData(financeKeys.detail(orderId), (currentDetail) => applyOptimisticPayment(currentDetail, payload));

            return { previousDetail, orderId };
        },
        onError: (_error, _variables, context) => {
            if (context?.orderId) {
                queryClient.setQueryData(financeKeys.detail(context.orderId), context.previousDetail);
            }
        },
        onSuccess: async (_data, variables) => {
            await invalidateAfterRegisterPayment(queryClient, variables?.orderId);
        }
    });
};
