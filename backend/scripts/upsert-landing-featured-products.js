import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const products = [
  {
    nombre: 'Guías Quirúrgicas Impresas en 3D',
    descripcion: 'Guías apilables impresas en 3D con sistema de irrigación integrado. Planificación digital a partir de CBCT y escaneo intraoral.',
    categoria: 'Guía quirúrgica',
    precio: 150,
    dias: 2,
    image: '/images/afinix-landing/service-guide.jpg',
  },
  {
    nombre: 'Coronas impresas en 3D',
    descripcion: 'Coronas con resina de alta performance y carga cerámica, impresas en 3D para un flujo digital ágil con estética y ajuste predecible.',
    categoria: 'Corona',
    precio: 180,
    dias: 2,
    image: '/images/afinix-landing/service-crown-resin-3d.jpg',
  },
  {
    nombre: 'Carillas impresas en 3D',
    descripcion: 'Carillas ultrafinas impresas en 3D con resina cerámica para mejorar forma, color y proporción en el sector anterior.',
    categoria: 'Carilla',
    precio: 200,
    dias: 2,
    image: '/images/afinix-landing/service-veneer-resin-3d.jpg',
  },
];

const RENAME_MAP = [
  ['Coronas de Resina con Carga Cerámica Impresa en 3D', 'Coronas impresas en 3D'],
  ['Carillas de Resina con Carga Cerámica Impresa en 3D', 'Carillas impresas en 3D'],
  ['Inlay - Onlay de Resina con Carga Cerámica Impresa en 3D', 'Inlay-Onlay impresos en 3D'],
];

async function main() {
  for (const [fromName, toName] of RENAME_MAP) {
    const renamed = await pool.query(
      `UPDATE nl_productos
       SET nombre = $2, updated_at = NOW()
       WHERE nombre = $1
       RETURNING id`,
      [fromName, toName]
    );
    if (renamed.rowCount > 0) {
      console.log('rename', fromName, '->', toName);
    }
  }

  for (const p of products) {
    const cat = await pool.query(
      'SELECT id FROM nl_categorias_trabajo WHERE nombre = $1 LIMIT 1',
      [p.categoria]
    );
    const categoriaId = cat.rows[0]?.id;
    if (!categoriaId) {
      console.log('missing cat', p.categoria);
      continue;
    }

    const existing = await pool.query(
      'SELECT id FROM nl_productos WHERE nombre = $1 LIMIT 1',
      [p.nombre]
    );

    if (existing.rows[0]) {
      await pool.query(
        `UPDATE nl_productos
         SET image_url = $1, descripcion = $2, visible = true, activo = true, updated_at = NOW()
         WHERE id = $3`,
        [p.image, p.descripcion, existing.rows[0].id]
      );
      console.log('refresh', p.nombre);
    } else {
      await pool.query(
        `INSERT INTO nl_productos
          (nombre, descripcion, categoria_id, precio_base, tiempo_estimado_dias, image_url, visible, activo)
         VALUES ($1, $2, $3, $4, $5, $6, true, true)`,
        [p.nombre, p.descripcion, categoriaId, p.precio, p.dias, p.image]
      );
      console.log('insert', p.nombre);
    }
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
