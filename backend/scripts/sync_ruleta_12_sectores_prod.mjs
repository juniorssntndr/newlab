import pg from 'pg';

const prodUrl = 'postgres://postgres:5OnYuLbav12c9tmqPhduKI6XLzeDEsFpnbkc6keCV81seYxBZovTH93i3si4hg8Q@212.28.178.94:5432/postgres';
const pool = new pg.Pool({ connectionString: prodUrl });

export const afinixOfficial12Sectors = [
  {
    titulo: 'S/. 100',
    tipo_premio: 'monto_fijo',
    valor: 100.00,
    descripcion: 'S/. 100 soles de descuento en orden técnica',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 15,
    orden: 0,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 100 DCTO! 🏆',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 100 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 1,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  },
  {
    titulo: 'S/. 30',
    tipo_premio: 'monto_fijo',
    valor: 30.00,
    descripcion: 'S/. 30 soles de descuento directo en tu pedido',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 40,
    orden: 2,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 30 DCTO! 💰',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 3,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  },
  {
    titulo: 'S/. 50',
    tipo_premio: 'monto_fijo',
    valor: 50.00,
    descripcion: 'S/. 50 soles de descuento directo en tu orden técnica',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 30,
    orden: 4,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 50 DCTO! 🎉',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 50 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 5,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  },
  {
    titulo: 'S/. 30',
    tipo_premio: 'monto_fijo',
    valor: 30.00,
    descripcion: 'S/. 30 soles de descuento directo en tu pedido',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 40,
    orden: 6,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 30 DCTO! 💰',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 7,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  },
  {
    titulo: 'S/. 50',
    tipo_premio: 'monto_fijo',
    valor: 50.00,
    descripcion: 'S/. 50 soles de descuento directo en tu orden técnica',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 30,
    orden: 8,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 50 DCTO! 🎉',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 50 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 9,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  },
  {
    titulo: 'S/. 30',
    tipo_premio: 'monto_fijo',
    valor: 30.00,
    descripcion: 'S/. 30 soles de descuento directo en tu pedido',
    color_hex: '#0284c7',
    texto_color: '#ffffff',
    probabilidad_peso: 40,
    orden: 10,
    subtitulo_badge: 'DESCUENTO',
    modo_visual: 'texto_icono',
    grafico_tipo: 'auto',
    resultado_titulo: '¡GANASTE S/. 30 DCTO! 💰',
    resultado_descripcion: 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'
  },
  {
    titulo: '¡PIÑA!',
    tipo_premio: 'sin_premio',
    valor: 0.00,
    descripcion: '¡La próxima es la tuya! 🍍',
    color_hex: '#ffffff',
    texto_color: '#0284c7',
    probabilidad_peso: 15,
    orden: 11,
    subtitulo_badge: null,
    modo_visual: 'solo_icono',
    grafico_tipo: 'pina',
    resultado_titulo: '¡PIÑA! 🍍',
    resultado_descripcion: 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'
  }
];

async function applyToDb(connectionPool) {
  const client = await connectionPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Desactivar todos los premios antiguos para mantener integridad de giros pasados
    await client.query('UPDATE nl_ruleta_premios SET activo = FALSE WHERE activo = TRUE');

    // 2. Insertar los 12 sectores oficiales
    for (const s of afinixOfficial12Sectors) {
      await client.query(`
        INSERT INTO nl_ruleta_premios (
          titulo, tipo_premio, valor, descripcion, color_hex, texto_color,
          probabilidad_peso, activo, orden, subtitulo_badge, modo_visual,
          grafico_tipo, resultado_titulo, resultado_descripcion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, $13)
      `, [
        s.titulo, s.tipo_premio, s.valor, s.descripcion, s.color_hex, s.texto_color,
        s.probabilidad_peso, s.orden, s.subtitulo_badge, s.modo_visual,
        s.grafico_tipo, s.resultado_titulo, s.resultado_descripcion
      ]);
    }

    // 3. Asegurar fondo oficial de ruleta en configuración
    await client.query(`
      INSERT INTO nl_ruleta_config (id, fondo_url, tiempo_animacion_segundos, updated_at)
      VALUES (1, '/images/ruleta/ruleta-stage-bg.png', 4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        fondo_url = '/images/ruleta/ruleta-stage-bg.png',
        tiempo_animacion_segundos = 4,
        updated_at = NOW()
    `);

    await client.query('COMMIT');
    console.log('SUCCESS: Sincronización a producción completada con éxito.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv.includes('--force')) {
  applyToDb(pool)
    .then(() => pool.end())
    .catch(() => {
      pool.end();
      process.exit(1);
    });
} else {
  console.log('SAFETY: sync_ruleta_12_sectores_prod.mjs requires --force to run against database. Aborting.');
  process.exit(0);
}
