# Emitir el primer comprobante beta con APISPERU

NEWLAB queda preparado para probar facturas y boletas individuales con APISPERU sin exponer el token al navegador. La emisión real solo ocurre después de una confirmación y cada intento reutilizable conserva el mismo correlativo.

## Camino rápido

1. En el backend configura `USE_NEW_BILLING_ACL=true` y `APISPERU_MOCK=false`.
2. Ejecuta `npm --workspace backend run migrate` para crear el contador fiscal y los campos de seguimiento.
3. Verifica en `nl_empresas` que exista un único emisor activo, en entorno `beta`, con RUC, razón social, dirección, ubigeo, series y token APISPERU correctos.
4. Configura `EXTERNAL_API_TOKEN` si deseas consultar DNI/RUC desde el formulario.
5. Reinicia el backend, abre un pedido de prueba y entra a **Finanzas → Emitir comprobante**.
6. Consulta o revisa al receptor, confirma importes y acepta el resumen beta.
7. Comprueba que el registro termine en `estado_sunat = 'aceptado'` y conserve `hash_cpe`, código y descripción CDR.

> No uses correlativos ni clientes de producción durante esta etapa. El certificado y la empresa de APISPERU deben pertenecer al mismo RUC emisor.

## Qué protege esta versión

| Riesgo | Protección |
| --- | --- |
| Doble clic o reintento | Clave idempotente por acción de emisión |
| Dos emisiones simultáneas | Contador atómico por tipo y serie |
| APISPERU sin respuesta | Timeout y estado local `error` recuperable |
| Rechazo SUNAT | HTTP 422, estado `rechazado` y detalle CDR |
| Token expuesto | La llamada a APISPERU ocurre solo en backend |
| Datos fiscales incompletos | Validación de documento, razón social, dirección, ubigeo e importes |

## Prueba controlada

- Empieza con una factura de importe pequeño a un RUC activo y habido que puedas verificar.
- Anota pedido, tipo, serie y correlativo antes de revisar APISPERU.
- Si el navegador reporta error, no cambies los datos ni vuelvas a crear otro comprobante: usa el mismo botón para conservar la clave del intento.
- Confirma el resultado tanto en NEWLAB como en el panel beta de APISPERU.
- Guarda evidencia del XML, hash y CDR que entregue el proveedor.

## Fuera de alcance por ahora

- Resumen diario de boletas y consulta de su ticket.
- Notas de crédito.
- Comunicación de baja y consulta de su ticket.
- Descarga y almacenamiento permanente de XML, PDF y CDR.
- Rotación o cifrado definitivo de credenciales.

Estos flujos deben permanecer deshabilitados para una prueba fiscal hasta implementar los endpoints `/summary/*`, `/note/*` y `/voided/*` con sus estados asíncronos.

## Lista para pasar a producción

- [ ] La prueba beta fue aceptada y el total/IGV coincide con el pedido.
- [ ] El contador no reutiliza números anulados ni fallidos.
- [ ] El RUC emisor, certificado y usuario SOL fueron validados.
- [ ] Se rotaron el token APISPERU y la clave SOL expuestos durante la configuración.
- [ ] Los secretos se movieron a variables o almacenamiento cifrado.
- [ ] Se implementaron resumen diario, bajas y notas de crédito.
- [ ] XML, PDF y CDR se conservan con respaldo y acceso controlado.
- [ ] El contador o asesor tributario aprobó series, afectación IGV y procedimiento operativo.
