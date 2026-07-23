# Llevar clientes, doctores y facturación a producción

NEWLAB debe separar las empresas identificadas por RUC de las personas identificadas por DNI, consultar sus datos únicamente desde el backend y conservar una copia fiscal del receptor usado en cada comprobante.

## Camino recomendado

1. Activar el plan gratuito de consultas DNI/RUC de APISPERU y obtener su token independiente.
2. Integrar búsqueda RUC en gestión de clínicas y búsqueda DNI en gestión de doctores.
3. Separar doctores de clínicas en el modelo de datos.
4. Reemplazar confirmaciones nativas y errores genéricos por modales y resultados fiscales de NEWLAB.
5. Configurar la empresa emisora real y probar factura/boleta en APISPERU beta.
6. Rotar credenciales, cerrar PostgreSQL público y desplegar con secretos seguros.
7. Pasar a producción después de validar XML, CDR, correlativos, notas, bajas y resumen diario.

## Tres credenciales diferentes

| Credencial | Uso | Necesaria ahora |
| --- | --- | --- |
| Token DNI/RUC APISPERU | Consultar RENIEC y ficha RUC de SUNAT | Sí |
| Token permanente de empresa APISPERU | Facturas, boletas, notas, bajas y resúmenes | Sí |
| `client_id` y `client_secret` SUNAT | APIs REST específicas, especialmente GRE | No para factura/boleta actual; sí al implementar GRE directa/APISPERU |

El token DNI/RUC se configura como `EXTERNAL_API_TOKEN`. El token de facturación nunca debe reutilizarse para consultas ni enviarse al navegador.

## Modelo de clientes

### Clínica o empresa

- RUC de 11 dígitos, único.
- Razón social y nombre comercial.
- Estado y condición RUC.
- Dirección fiscal, departamento, provincia, distrito y ubigeo.
- Correo, teléfono y contacto administrativo.
- Fecha de última validación externa.

La creación comienza con el RUC. NEWLAB consulta APISPERU, muestra los datos y el usuario confirma antes de guardar. La búsqueda por razón social se hace sobre la base local; la API externa solo se consume con un RUC exacto.

### Doctor

- DNI de 8 dígitos, único.
- Nombres y apellidos obtenidos de RENIEC.
- Colegiatura/COP opcional y datos de contacto.
- Estado activo/inactivo.
- Relación con una o varias clínicas.

Se crearán `nl_doctores` y `nl_clinica_doctores`. El DNI del doctor no debe ocupar el campo DNI de la clínica.

## Flujo de consulta

1. El usuario escribe DNI o RUC.
2. El frontend valida longitud y llama al backend autenticado.
3. El backend consulta APISPERU con timeout, rate limit y token secreto.
4. RUC debe mostrar estado y condición; un RUC no activo/no habido genera advertencia bloqueante para factura.
5. Los datos aparecen como propuesta y nunca sobrescriben silenciosamente información existente.
6. El usuario confirma y recién entonces se guarda.
7. La respuesta se cachea por un tiempo limitado para ahorrar cuota y mejorar velocidad.

## Facturas y boletas

| Documento | Receptor esperado | Regla de NEWLAB |
| --- | --- | --- |
| Factura | Empresa con RUC | Exigir RUC de 11 dígitos, razón social y domicilio fiscal |
| Boleta identificada | Persona con DNI | Precargar nombres desde RENIEC y usar tipo de documento `1` |
| Boleta sin documento | Consumidor final | Implementar solo después de validar límites/reglas con contador |

Cada comprobante guardará un snapshot del receptor para que cambios posteriores en clínica o doctor no alteren el documento histórico.

## Experiencia dentro de NEWLAB

- Sustituir `window.confirm` por un modal del sistema con tipo, receptor, documento, base, IGV, total, serie y entorno.
- Mostrar estado `Enviando` mientras se procesa.
- Si acepta: modal verde con serie-correlativo, código CDR, descripción, hash y accesos a PDF/XML.
- Si rechaza: modal rojo con código SUNAT y acción concreta para corregir.
- Si falla la red: mostrar `No confirmado`; permitir reintentar con la misma clave idempotente.
- Mantener toast solo como aviso breve; el resultado fiscal debe permanecer visible en la página.

## Seguridad y producción

- Guardar tokens únicamente en secretos de Coolify/backend.
- Cifrar o retirar `token_apisperu` en texto plano de `nl_empresas`.
- Redactar tokens de URL y cabeceras en logs y Sentry.
- Rotar token APISPERU, clave SOL y contraseña PostgreSQL expuestos durante pruebas.
- Desactivar el acceso público de PostgreSQL y usar la URL interna de Coolify.
- Agregar rate limiting, caché y auditoría para consultas de identidad.
- Restringir consulta DNI/RUC a usuarios autorizados y evitar consultas masivas.

## Fases de implementación

### Fase A — Identidad maestra

- Migraciones de doctores, relación clínica-doctor y snapshot fiscal.
- Adaptador DNI/RUC con configuración validada, caché y errores normalizados.
- Endpoints de previsualización y confirmación.
- Pruebas de duplicados, RUC no habido y DNI inexistente.

### Fase B — Gestión y facturación

- Integración en Clínicas y nueva gestión de Doctores.
- Autocompletado del receptor en factura/boleta.
- Modal propio de confirmación y resultado.
- Corrección de mensajes genéricos y trazabilidad por `requestId`.

### Fase C — Salida a producción

- Configurar emisor real AFINIX en `nl_empresas`.
- Probar beta completa y comparar CDR/PDF/XML.
- Automatizar tickets de resumen y bajas.
- Rotar secretos, backup y despliegue gradual.
- Primera emisión productiva supervisada y reconciliación en SUNAT.

## Criterios de aceptación

- [ ] Una clínica se crea por RUC sin reescribir manualmente razón social/dirección.
- [ ] Un doctor se crea por DNI y puede asociarse a varias clínicas.
- [ ] Factura selecciona una clínica/RUC validado.
- [ ] Boleta selecciona persona/DNI validado.
- [ ] Ningún token aparece en frontend, URL registrada, logs o errores.
- [ ] Confirmación y resultado fiscal aparecen dentro de NEWLAB.
- [ ] Reintentar no genera un segundo correlativo.
- [ ] CDR, hash, XML y PDF quedan conservados.
- [ ] PostgreSQL deja de estar expuesto públicamente.
