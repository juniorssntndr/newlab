import assert from 'node:assert/strict';

import { ordersKeys } from '../orders/queries/orderKeys.js';
import { financeKeys } from '../finance/queries/financeKeys.js';
import { billingKeys } from '../billing/queries/billingKeys.js';
import { invalidateAfterApproveOrder } from '../orders/mutations/invalidateApproveOrderQueries.js';
import { invalidateAfterRegisterPayment } from '../finance/mutations/invalidateRegisterPaymentQueries.js';
import { invalidateAfterCreateInvoice } from '../billing/mutations/invalidateBillingQueries.js';

const createQueryClientSpy = () => {
    const invalidated = [];

    return {
        queryClient: {
            invalidateQueries: async (options) => {
                invalidated.push(options);
                return 1;
            }
        },
        invalidated
    };
};

const hasInvalidation = (invalidated, expectedKey, exact = false) => invalidated.some((entry) => {
    const sameKey = JSON.stringify(entry.queryKey) === JSON.stringify(expectedKey);
    if (!sameKey) return false;
    if (exact) {
        return entry.exact === true;
    }

    return true;
});

const run = async () => {
    const orderId = '44';

    {
        const { queryClient, invalidated } = createQueryClientSpy();
        await invalidateAfterApproveOrder(queryClient, orderId);

        assert.equal(hasInvalidation(invalidated, ordersKeys.lists()), true);
        assert.equal(hasInvalidation(invalidated, ordersKeys.detail(orderId), true), true);
        assert.equal(hasInvalidation(invalidated, [...financeKeys.all, 'kpis']), true);
    }

    {
        const { queryClient, invalidated } = createQueryClientSpy();
        await invalidateAfterRegisterPayment(queryClient, orderId);

        assert.equal(hasInvalidation(invalidated, financeKeys.accounts()), true);
        assert.equal(hasInvalidation(invalidated, financeKeys.paymentList(orderId), true), true);
        assert.equal(hasInvalidation(invalidated, ordersKeys.detail(orderId), true), true);
    }

    {
        const { queryClient, invalidated } = createQueryClientSpy();
        await invalidateAfterCreateInvoice(queryClient, orderId);

        assert.equal(hasInvalidation(invalidated, ordersKeys.detail(orderId), true), true);
        assert.equal(hasInvalidation(invalidated, financeKeys.paymentList(orderId), true), true);
        assert.equal(hasInvalidation(invalidated, [...financeKeys.all, 'kpis']), true);
        assert.equal(hasInvalidation(invalidated, billingKeys.preview(orderId), true), true);
    }

    console.log('ok - order->payment->invoice cache invalidation flow');
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
