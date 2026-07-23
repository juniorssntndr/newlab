import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const token = process.argv[2] || process.env.APISPERU_COMPANY_TOKEN;
if (!token || token.startsWith('PEGA_') || token.length < 20) {
    console.error('Uso: node scripts/set_issuer_token.js "<TOKEN_DE_EMPRESA>"');
    console.error('O define APISPERU_COMPANY_TOKEN en el entorno.');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
    const result = await pool.query(
        `UPDATE nl_empresas
         SET token_apisperu = $1,
             ruc = COALESCE(NULLIF($2, ''), ruc),
             razon_social = COALESCE(NULLIF($3, ''), razon_social),
             nombre_comercial = COALESCE(NULLIF($4, ''), nombre_comercial),
             direccion_fiscal = COALESCE(NULLIF($5, ''), direccion_fiscal),
             entorno = COALESCE(NULLIF($6, ''), entorno),
             updated_at = NOW()
         WHERE id = 1
         RETURNING id, ruc, razon_social, entorno,
                   CASE
                     WHEN token_apisperu IS NULL OR length(trim(token_apisperu)) = 0 THEN 'EMPTY'
                     ELSE 'SET(len=' || length(token_apisperu) || ')'
                   END AS token_status`,
        [
            token,
            process.argv[3] || '20616033973',
            process.argv[4] || 'AFINIX DENTAL LAB S.A.C.',
            process.argv[5] || 'AFINIX',
            process.argv[6] || 'Calle Piura 316, MARIANO MELGAR AREQUIPA',
            process.argv[7] || 'beta'
        ]
    );

    if (result.rows.length === 0) {
        console.error('No se encontró nl_empresas id=1');
        process.exitCode = 1;
    } else {
        console.log(JSON.stringify(result.rows[0], null, 2));
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
