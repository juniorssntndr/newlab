-- =========================================================================
-- MIGRATION 944: PLANTILLA OFICIAL AFINIX LAB - RULETA DE 12 SECTORES
-- AFINIX DENTAL LAB S.A.C.
-- =========================================================================

-- Asegurar configuración visual oficial
INSERT INTO nl_ruleta_config (id, fondo_url, tiempo_animacion_segundos, updated_at)
VALUES (1, '/images/ruleta/ruleta-stage-bg.png', 4, NOW())
ON CONFLICT (id) DO UPDATE SET
    fondo_url = COALESCE(nl_ruleta_config.fondo_url, EXCLUDED.fondo_url),
    tiempo_animacion_segundos = 4,
    updated_at = NOW();

-- Si no hay sectores oficiales configurados, insertar la plantilla de 12 sectores
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM nl_ruleta_premios WHERE titulo = '¡PIÑA!' AND activo = TRUE) THEN
        -- Desactivar sectores antiguos si los hubiera
        UPDATE nl_ruleta_premios SET activo = FALSE WHERE activo = TRUE;

        -- 12 sectores intercalados: 6 con premio (#0284c7) y 6 piñas (#ffffff)
        INSERT INTO nl_ruleta_premios (
            titulo, tipo_premio, valor, descripcion, color_hex, texto_color,
            probabilidad_peso, activo, orden, subtitulo_badge, modo_visual,
            grafico_tipo, resultado_titulo, resultado_descripcion
        ) VALUES
        ('S/. 100', 'monto_fijo', 100.00, 'S/. 100 soles de descuento en orden técnica', '#0284c7', '#ffffff', 15, TRUE, 0, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 100 DCTO! 🏆', 'Felicidades, tienes un cupón de S/. 100 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 1, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'),
        ('S/. 30', 'monto_fijo', 30.00, 'S/. 30 soles de descuento directo en tu pedido', '#0284c7', '#ffffff', 40, TRUE, 2, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 30 DCTO! 💰', 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 3, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'),
        ('S/. 50', 'monto_fijo', 50.00, 'S/. 50 soles de descuento directo en tu orden técnica', '#0284c7', '#ffffff', 30, TRUE, 4, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 50 DCTO! 🎉', 'Felicidades, tienes un cupón de S/. 50 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 5, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'),
        ('S/. 30', 'monto_fijo', 30.00, 'S/. 30 soles de descuento directo en tu pedido', '#0284c7', '#ffffff', 40, TRUE, 6, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 30 DCTO! 💰', 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 7, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'),
        ('S/. 50', 'monto_fijo', 50.00, 'S/. 50 soles de descuento directo en tu orden técnica', '#0284c7', '#ffffff', 30, TRUE, 8, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 50 DCTO! 🎉', 'Felicidades, tienes un cupón de S/. 50 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 9, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!'),
        ('S/. 30', 'monto_fijo', 30.00, 'S/. 30 soles de descuento directo en tu pedido', '#0284c7', '#ffffff', 40, TRUE, 10, 'DESCUENTO', 'texto_icono', 'auto', '¡GANASTE S/. 30 DCTO! 💰', 'Felicidades, tienes un cupón de S/. 30 para tus órdenes de laboratorio.'),
        ('¡PIÑA!', 'sin_premio', 0.00, '¡La próxima es la tuya! 🍍', '#ffffff', '#0284c7', 15, TRUE, 11, NULL, 'solo_icono', 'pina', '¡PIÑA! 🍍', 'Esta vez no hubo suerte, ¡pero la próxima te llevas el premio mayor!');
    END IF;
END $$;
