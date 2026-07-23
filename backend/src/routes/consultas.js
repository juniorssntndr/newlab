import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { apisperuIdentityAdapter } from '../infrastructure/identity/apisperuIdentityAdapter.js';

const router = express.Router();

const ERROR_HTTP_STATUS = {
    DOCUMENT_NOT_FOUND: 404,
    INVALID_DOCUMENT: 400,
    QUOTA_OR_PROVIDER_ERROR: 503,
    TOKEN_MISSING: 500,
};

function errorResponse(err) {
    const code = err.code || 'QUOTA_OR_PROVIDER_ERROR';
    const status = ERROR_HTTP_STATUS[code] || 500;
    return { status, body: { error: err.message, code } };
}

router.get('/dni/:numero', authenticateToken, requireRole('admin', 'tecnico'), async (req, res) => {
    try {
        const data = await apisperuIdentityAdapter.lookupDni(req.params.numero);
        res.json(data);
    } catch (err) {
        const { status, body } = errorResponse(err);
        res.status(status).json(body);
    }
});

router.get('/ruc/:numero', authenticateToken, requireRole('admin', 'tecnico'), async (req, res) => {
    try {
        const data = await apisperuIdentityAdapter.lookupRuc(req.params.numero);
        res.json(data);
    } catch (err) {
        const { status, body } = errorResponse(err);
        res.status(status).json(body);
    }
});

export default router;
