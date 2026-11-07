import crypto from 'crypto';

// Alfabeto base56 seguro para URLs sin caracteres ambiguos (0/O, 1/l/I)
const CODE_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DEFAULT_CODE_LENGTH = 8;

export const generateShortCode = (length = DEFAULT_CODE_LENGTH) => {
    let code = '';
    const alphabetLength = CODE_ALPHABET.length;
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, alphabetLength);
        code += CODE_ALPHABET[randomIndex];
    }
    return code;
};

let tableEnsured = false;

export const ensureShortLinkTable = async (pool) => {
    if (tableEnsured || !pool?.query) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nl_enlaces_cortos (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(24) NOT NULL UNIQUE,
                tipo VARCHAR(40) NOT NULL DEFAULT 'tracking',
                pedido_id INTEGER REFERENCES nl_pedidos(id) ON DELETE CASCADE,
                clinica_id INTEGER REFERENCES nl_clinicas(id) ON DELETE CASCADE,
                url_destino TEXT,
                visitas INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_enlaces_cortos_codigo ON nl_enlaces_cortos (codigo);
            CREATE INDEX IF NOT EXISTS idx_enlaces_cortos_pedido ON nl_enlaces_cortos (pedido_id);
        `);
        tableEnsured = true;
    } catch {
        // Ignorar si ya existe o concurrent create
    }
};

export const makeShortLinkPgRepository = ({ pool } = {}) => {
    return {
        generateShortCode,
        getOrCreateShortLink: async ({ orderId, clinicaId, tipo = 'tracking' }) => {
            if (!pool?.query) return null;
            await ensureShortLinkTable(pool);

            // Reutilizar enlace activo si ya existe para este pedido y tipo
            const existing = await pool.query(
                `SELECT codigo FROM nl_enlaces_cortos 
                 WHERE pedido_id = $1 AND tipo = $2 
                 ORDER BY id DESC LIMIT 1`,
                [orderId, tipo]
            );

            if (existing.rows.length > 0) {
                return existing.rows[0].codigo;
            }

            // Generar código único con reintento ante colisión (probabilidad < 1 en 10 billones)
            for (let attempt = 0; attempt < 3; attempt++) {
                const code = generateShortCode();
                try {
                    await pool.query(
                        `INSERT INTO nl_enlaces_cortos (codigo, tipo, pedido_id, clinica_id, url_destino)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [code, tipo, orderId, clinicaId, `/t/${code}`]
                    );
                    return code;
                } catch (err) {
                    if (err.code === '23505' && attempt < 2) continue; // Colisión de clave única
                    throw err;
                }
            }
            return null;
        },
        resolveShortLink: async ({ code }) => {
            if (!pool?.query || !code) return null;
            await ensureShortLinkTable(pool);

            const res = await pool.query(
                `SELECT pedido_id, clinica_id, tipo, url_destino 
                 FROM nl_enlaces_cortos 
                 WHERE codigo = $1 
                 LIMIT 1`,
                [code]
            );

            if (res.rows.length === 0) return null;

            // Incrementar contador de visitas en segundo plano
            pool.query(
                `UPDATE nl_enlaces_cortos 
                 SET visitas = visitas + 1, updated_at = NOW() 
                 WHERE codigo = $1`,
                [code]
            ).catch(() => {});

            return res.rows[0];
        }
    };
};
