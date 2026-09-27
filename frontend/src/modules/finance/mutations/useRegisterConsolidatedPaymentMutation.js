import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { registerConsolidatedPayment } from '../api/financeApi.js';
import { financeKeys } from '../queries/financeKeys.js';
import { ordersKeys } from '../../orders/queries/orderKeys.js';

export const useRegisterConsolidatedPaymentMutation = () => {
    const { getHeaders } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ payload }) => registerConsolidatedPayment({ payload, headers: getHeaders() }),
        onSuccess: async (_data, variables) => {
            const invalidations = [
                queryClient.invalidateQueries({
                    queryKey: financeKeys.accounts(),
                    refetchType: 'active'
                }),
                queryClient.invalidateQueries({
                    queryKey: financeKeys.movements(),
                    refetchType: 'active'
                }),
                queryClient.invalidateQueries({
                    queryKey: ['cash-session', 'active'],
                    refetchType: 'active'
                }),
                queryClient.invalidateQueries({
                    queryKey: ['facturacion'],
                    refetchType: 'active'
                })
            ];

            const orderPayments = variables?.payload?.orderPayments || [];
            orderPayments.forEach(item => {
                if (item.orderId) {
                    invalidations.push(
                        queryClient.invalidateQueries({
                            queryKey: financeKeys.paymentList(item.orderId),
                            exact: true,
                            refetchType: 'active'
                        }),
                        queryClient.invalidateQueries({
                            queryKey: ordersKeys.detail(item.orderId),
                            exact: true,
                            refetchType: 'active'
                        }),
                        queryClient.invalidateQueries({
                            queryKey: financeKeys.detail(item.orderId),
                            exact: true,
                            refetchType: 'active'
                        })
                    );
                }
            });

            await Promise.allSettled(invalidations);
        }
    });
};
