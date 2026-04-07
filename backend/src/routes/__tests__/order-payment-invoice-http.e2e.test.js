import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

import pedidosRoutes from '../pedidos.js';
import finanzasRoutes from '../finanzas.js';
import facturacionRoutes, {
    __resetFacturacionDepsForTesting,
    __setFacturacionDepsForTesting
} from '../facturacion.js';

const JWT_SECRET = 'integration-test-secret';

process.env.JWT_SECRET = JWT_SECRET;

const createAuthHeader = () => {
    const token = jwt.sign(
        { id: 99, tipo: 'admin', clinica_id: 1, email: 'qa@newlab.test' },
        JWT_SECRET
    );

    return { Authorization: `Bearer ${token}` };
};

const createTestPool = () => ({
    async query(sql, params) {
        if (sql.includes('SELECT id FROM nl_comprobantes WHERE pedido_id')) {
            return { rows: [] };
        }

        if (sql.includes('SELECT * FROM nl_comprobantes WHERE id = $1')) {
            return {
                rows: [{
                    id: params[0],
                    pedido_id: 123,
                    serie: 'F001',
                    correlativo: '00000123',
                    estado_sunat: 'aceptado'
                }]
            };
        }

        return { rows: [] };
    }
});

const createModules = ({ billingAclMode }) => ({
    orders: {
        orderController: {
            async createOrder(req, res) {
                return res.status(201).json({
                    id: 123,
                    codigo: 'PED-123',
                    estado: 'pendiente',
                    clinica_id: req.body.clinica_id,
                    paciente_nombre: req.body.paciente_nombre
                });
            }
        }
    },
    finance: {
        financeController: {
            async registerPago(req, res) {
                return res.status(201).json({
                    id: 456,
                    pedido_id: Number(req.params.id),
                    monto: Number(req.body.monto),
                    estado_pago: 'pago_parcial'
                });
            }
        }
    },
    billing: {
        billingAclMode,
        billingRepository: {
            async getOrderSnapshot(orderId) {
                return {
                    orderId: String(orderId),
                    customerDocument: '20111111111',
                    customerName: 'Clinica QA SAC',
                    status: 'APPROVED',
                    paymentStatus: 'PARTIAL',
                    lines: [{
                        sku: 'SKU-1',
                        description: 'Corona dental',
                        qty: 1,
                        unitPrice: { amount: 100, currency: 'PEN' },
                        taxRate: 0.18
                    }],
                    total: { amount: 118, currency: 'PEN' }
                };
            }
        },
        billingController: {
            createInvoice: {
                async execute() {
                    return {
                        ok: true,
                        status: 200,
                        data: {
                            invoiceId: '987',
                            invoiceStatus: 'SENT',
                            sunatTicket: 'TK-NEW-987',
                            pdfUrl: 'https://cdn.newlab.test/987.pdf',
                            xmlUrl: 'https://cdn.newlab.test/987.xml'
                        }
                    };
                }
            }
        }
    }
});

const buildApp = ({ billingAclMode }) => {
    __resetFacturacionDepsForTesting();

    if (billingAclMode === 'legacy-service') {
        __setFacturacionDepsForTesting({
            async emitirComprobanteSunat() {
                return {
                    id: 789,
                    pedido_id: 123,
                    serie: 'F001',
                    correlativo: '00000789',
                    estado_sunat: 'aceptado'
                };
            }
        });
    }

    const app = express();
    app.use(express.json());
    app.locals.pool = createTestPool();
    app.locals.modules = createModules({ billingAclMode });

    app.use('/api/pedidos', pedidosRoutes);
    app.use('/api/finanzas', finanzasRoutes);
    app.use('/api/facturacion', facturacionRoutes);

    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
    });

    return app;
};

const runLifecycleScenario = async ({ billingAclMode }) => {
    const app = buildApp({ billingAclMode });
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, () => resolve(instance));
    });

    const { port } = server.address();
    const headers = {
        ...createAuthHeader(),
        'Content-Type': 'application/json'
    };
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        const createOrderResponse = await fetch(`${baseUrl}/api/pedidos`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                clinica_id: 1,
                paciente_nombre: 'Paciente QA',
                fecha_entrega: '2026-03-22',
                items: [{
                    cantidad: 1,
                    precio_unitario: 100,
                    material: 'Zirconio'
                }]
            })
        });
        const createOrderBody = await createOrderResponse.json();

        assert.equal(createOrderResponse.status, 201);
        assert.equal(createOrderBody.id, 123);
        assert.equal(typeof createOrderBody.codigo, 'string');
        assert.equal(typeof createOrderBody.estado, 'string');

        const registerPaymentResponse = await fetch(`${baseUrl}/api/finanzas/${createOrderBody.id}/pagos`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                monto: 118,
                metodo: 'transferencia',
                tipo_fondo: 'banco'
            })
        });
        const registerPaymentBody = await registerPaymentResponse.json();

        assert.equal(registerPaymentResponse.status, 201);
        assert.equal(registerPaymentBody.pedido_id, createOrderBody.id);
        assert.equal(registerPaymentBody.monto, 118);

        const emitInvoiceResponse = await fetch(`${baseUrl}/api/facturacion/${createOrderBody.id}/emitir`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                tipoComprobante: '01',
                billingData: {
                    client: {
                        numDoc: '20111111111',
                        rznSocial: 'Clinica QA SAC'
                    },
                    details: [{
                        descripcion: 'Corona dental',
                        cantidad: 1,
                        mtoValorUnitario: 100,
                        porcentajeIgv: 18
                    }],
                    mtoImpVenta: 118
                }
            })
        });
        const emitInvoiceBody = await emitInvoiceResponse.json();

        assert.equal(emitInvoiceResponse.status, 200);
        assert.ok(emitInvoiceBody.id || emitInvoiceBody.invoiceId);
        assert.ok(emitInvoiceBody.serie || emitInvoiceBody.invoiceStatus);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        __resetFacturacionDepsForTesting();
    }
};

test('order -> payment -> invoice HTTP lifecycle with USE_NEW_BILLING_ACL=false (legacy path)', async () => {
    await runLifecycleScenario({ billingAclMode: 'legacy-service' });
});

test('order -> payment -> invoice HTTP lifecycle with USE_NEW_BILLING_ACL=true (new ACL path)', async () => {
    await runLifecycleScenario({ billingAclMode: 'new-acl' });
});
