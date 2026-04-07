import pg from 'pg';
import { getDatabaseUrl, getUseNewBillingAcl } from '../config/env.js';
import { makeOrderPgRepository } from '../modules/orders/infrastructure/repositories/orderPgRepository.js';
import { makeOrderService } from '../modules/orders/application/services/orderService.js';
import { makeOrderController } from '../modules/orders/application/controllers/orderController.js';
import { makeOrderRoutes } from '../modules/orders/transport/http/orderRoutes.js';
import { makeFinancePgRepository } from '../modules/finance/infrastructure/repositories/financePgRepository.js';
import { makeFinanceService } from '../modules/finance/application/services/financeService.js';
import { makeFinanceController } from '../modules/finance/application/controllers/financeController.js';
import { makeFinanceRoutes } from '../modules/finance/transport/http/financeRoutes.js';
import { makeDashboardPgRepository } from '../modules/dashboard/infrastructure/repositories/dashboardPgRepository.js';
import { makeDashboardService } from '../modules/dashboard/application/services/dashboardService.js';
import { makeDashboardController } from '../modules/dashboard/application/controllers/dashboardController.js';
import { makeDashboardRoutes } from '../modules/dashboard/transport/http/dashboardRoutes.js';
import { makeBillingPgRepository } from '../modules/billing/infrastructure/repositories/billingPgRepository.js';
import { makeApisperuBillingAcl } from '../modules/billing/infrastructure/adapters/apisperuBillingAcl.js';
import { makeLegacyApisperuBillingAcl } from '../modules/billing/infrastructure/adapters/legacyApisperuBillingAcl.js';
import { makeBillingService } from '../modules/billing/application/services/billingService.js';
import { makeBillingController } from '../modules/billing/application/controllers/billingController.js';

const { Pool } = pg;

export const createCompositionRoot = () => {
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    const orderRepository = makeOrderPgRepository({ pool });
    const orderService = makeOrderService({ orderRepository });
    const orderController = makeOrderController({ orderService });
    const orderRoutes = makeOrderRoutes({ orderController });
    const financeRepository = makeFinancePgRepository({ pool });
    const financeService = makeFinanceService({ financeRepository });
    const financeController = makeFinanceController({ financeService });
    const financeRoutes = makeFinanceRoutes({ financeController });
    const dashboardRepository = makeDashboardPgRepository({ pool });
    const dashboardService = makeDashboardService({ dashboardRepository });
    const dashboardController = makeDashboardController({ dashboardService });
    const dashboardRoutes = makeDashboardRoutes({ dashboardController });
    const billingRepository = makeBillingPgRepository({ pool });
    const useNewBillingAcl = getUseNewBillingAcl();
    const billingProviderAcl = useNewBillingAcl
        ? makeApisperuBillingAcl({ billingRepository })
        : makeLegacyApisperuBillingAcl({ pool });
    const billingService = makeBillingService({ billingRepository, billingProviderAcl });
    const billingController = makeBillingController({ billingService });

    return {
        pool,
        modules: {
            orders: {
                orderRepository,
                orderService,
                orderController,
                orderRoutes
            },
            finance: {
                financeRepository,
                financeService,
                financeController,
                financeRoutes
            },
            dashboard: {
                dashboardRepository,
                dashboardService,
                dashboardController,
                dashboardRoutes
            },
            billing: {
                billingRepository,
                billingProviderAcl,
                billingService,
                billingController,
                billingAclMode: useNewBillingAcl ? 'new-acl' : 'legacy-service'
            }
        }
    };
};
