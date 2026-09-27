import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const updateRes = await pool.query(`
            UPDATE nl_empresas
            SET 
                ruc = '20616033973',
                razon_social = 'AFINIX DENTAL LAB S.A.C.',
                nombre_comercial = 'AFINIX Dental Lab',
                direccion_fiscal = 'Cal. Piura Nro. 316, Cercado de Mariano Melgar, Mariano Melgar, Arequipa',
                ubigeo = '040126',
                activo = true,
                updated_at = NOW()
            WHERE activo = true OR id = 1
            RETURNING id, ruc, razon_social, nombre_comercial, direccion_fiscal, ubigeo, serie_factura, serie_boleta, entorno;
        `);
        console.log("nl_empresas updated successfully:", JSON.stringify(updateRes.rows[0], null, 2));
    } catch (err) {
        console.error("Error updating nl_empresas:", err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
