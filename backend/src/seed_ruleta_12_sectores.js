import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed12Sectors() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Si existen giros pasados que referencian sectores viejos, se reasignan al sector 19 o se limpia para evitar duplicar
        await client.query('DELETE FROM nl_ruleta_premios WHERE id < 19');

        // 12 sectores intercalados: 6 con premio (#0284c7) y 6 sin premio (#ffffff)
        // Esquema Opción 2: S/. 100 (1x), S/. 50 (2x), S/. 30 (3x), Sin Premio (6x)
        // Colores oficiales AFINIX LAB (Azul #0284c7 con texto blanco, Blanco #ffffff con texto azul marino #0f172a)
        const sectors = [
            { titulo: 'S/. 100 DCTO', tipo: 'monto_fijo', valor: 100, color: '#0284c7', texto: '#ffffff', peso: 15, desc: 'S/. 100 soles de descuento en orden técnica', orden: 0 },
            { titulo: 'Sigue Intentando', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: '¡Casi! Prueba tu suerte en la siguiente', orden: 1 },
            { titulo: 'S/. 30 DCTO', tipo: 'monto_fijo', valor: 30, color: '#0284c7', texto: '#ffffff', peso: 40, desc: 'S/. 30 soles de descuento directo en tu pedido', orden: 2 },
            { titulo: 'Casi lo logras', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: 'Estuviste a un milímetro... ¡Vuelve a girar!', orden: 3 },
            { titulo: 'S/. 50 DCTO', tipo: 'monto_fijo', valor: 50, color: '#0284c7', texto: '#ffffff', peso: 30, desc: 'S/. 50 soles de descuento directo en tu orden técnica', orden: 4 },
            { titulo: 'Suerte Próxima', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: 'La suerte está cerca de ti', orden: 5 },
            { titulo: 'S/. 30 DCTO', tipo: 'monto_fijo', valor: 30, color: '#0284c7', texto: '#ffffff', peso: 40, desc: 'S/. 30 soles de descuento directo en tu pedido', orden: 6 },
            { titulo: 'Sigue Intentando', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: '¡No te rindas!', orden: 7 },
            { titulo: 'S/. 50 DCTO', tipo: 'monto_fijo', valor: 50, color: '#0284c7', texto: '#ffffff', peso: 30, desc: 'S/. 50 soles de descuento directo en tu orden técnica', orden: 8 },
            { titulo: 'Casi lo logras', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: '¡Por muy poco!', orden: 9 },
            { titulo: 'S/. 30 DCTO', tipo: 'monto_fijo', valor: 30, color: '#0284c7', texto: '#ffffff', peso: 40, desc: 'S/. 30 soles de descuento directo en tu pedido', orden: 10 },
            { titulo: 'Suerte Próxima', tipo: 'sin_premio', valor: 0, color: '#ffffff', texto: '#0f172a', peso: 15, desc: '¡Gira nuevamente en tu próxima visita!', orden: 11 }
        ];

        for (const s of sectors) {
            await client.query(`
                INSERT INTO nl_ruleta_premios (
                    titulo, tipo_premio, valor, color_hex, texto_color, probabilidad_peso,
                    descripcion, orden, activo, stock_disponible, stock_entregado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NULL, 0)
            `, [s.titulo, s.tipo, s.valor, s.color, s.texto, s.peso, s.desc, s.orden]);
        }

        await client.query('COMMIT');
        console.log('Seeded 12 sectors successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar sectores:', err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

seed12Sectors();
