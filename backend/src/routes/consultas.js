import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// APISPERU base URL
const EXTERNAL_API_BASE = 'https://dniruc.apisperu.com/api/v1';

/**
 * Helper function to handle external API requests via APISPERU
 */
async function fetchFromExternalApi(endpoint, numero, res) {
    const token = process.env.EXTERNAL_API_TOKEN;

    if (!token || token.startsWith('tu_token')) {
        return res.status(500).json({
            error: 'EXTERNAL_API_TOKEN no está configurado.',
            details: 'Agrega un token válido de apisperu.com en el archivo .env'
        });
    }

    try {
        // APISPERU uses token as query param, NOT as Bearer header
        const url = `${EXTERNAL_API_BASE}/${endpoint}/${numero}?token=${token}`;
        const response = await axios.get(url, { timeout: 10000 });

        // APISPERU can return HTTP 200 with { success: false } when document is not found
        // or when the token quota is exceeded, etc.
        if (response.data && response.data.success === false) {
            const msg = response.data.message || 'Documento no encontrado.';
            return res.status(404).json({ error: msg });
        }

        return res.json(response.data);
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            // APISPERU returns 401 for bad tokens
            if (status === 401) {
                return res.status(401).json({ error: 'Token de APISPERU inválido o expirado.' });
            }

            // APISPERU returns 500 with { message: 'Ocurrió un Error' } when document is NOT FOUND
            // This is their standard "not found" response (poor API design but documented behavior)
            if (status === 500 && data?.message === 'Ocurrió un Error') {
                return res.status(404).json({ error: 'Documento no encontrado en RENIEC/SUNAT.' });
            }

            return res.status(status).json({
                error: 'Error consultando servicio externo.',
                details: typeof data === 'string' ? data : JSON.stringify(data)
            });
        }
        if (error.code === 'ECONNABORTED') {
            return res.status(503).json({ error: 'Timeout: el servicio externo tardó demasiado.' });
        }
        return res.status(500).json({ error: 'Fallo de conexión con servicio externo.' });
    }
}

/**
 * GET /api/consultas/dni/:numero
 * Lookup DNI via RENIEC (APISPERU)
 */
router.get('/dni/:numero', authenticateToken, async (req, res) => {
    const { numero } = req.params;
    if (!numero || !/^\d{8}$/.test(numero)) {
        return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos numéricos.' });
    }
    await fetchFromExternalApi('dni', numero, res);
});

/**
 * GET /api/consultas/ruc/:numero
 * Lookup RUC via SUNAT (APISPERU)
 */
router.get('/ruc/:numero', authenticateToken, async (req, res) => {
    const { numero } = req.params;
    if (!numero || !/^\d{11}$/.test(numero)) {
        return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos.' });
    }
    await fetchFromExternalApi('ruc', numero, res);
});

export default router;
