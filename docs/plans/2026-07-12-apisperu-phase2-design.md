# Completar notas, bajas y resúmenes APISPERU

La fase 2 incorpora los tres flujos fiscales posteriores a la emisión. Las notas son síncronas; las bajas y resúmenes permanecen pendientes hasta que SUNAT acepte su ticket.

## Camino rápido

1. Obtén un backup de PostgreSQL en Coolify.
2. Desde una terminal con acceso a la base ejecuta `npm --workspace backend run migrate:billing`.
3. Mantén `APISPERU_MOCK=true` para la primera prueba interna.
4. Prueba una nota de crédito total sobre un comprobante beta aceptado.
5. Prueba una comunicación de baja y consulta su endpoint de estado hasta recibir CDR.
6. Genera un resumen para una fecha que tenga boletas beta aceptadas y consulta su ticket.
7. Cambia a `APISPERU_MOCK=false` solamente después de revisar los payloads persistidos.

## Flujos implementados

| Operación | Envío | Resultado local inicial | Confirmación final |
| --- | --- | --- | --- |
| Nota de crédito | `POST /note/send` | aceptado o rechazado | Respuesta CDR inmediata |
| Comunicación de baja | `POST /voided/send` | pendiente | `GET /voided/status` |
| Resumen diario | `POST /summary/send` | pendiente | `GET /summary/status` |

## Rutas NEWLAB

- `POST /api/facturacion/:comprobanteId/nota-credito`
- `POST /api/facturacion/:comprobanteId/anular`
- `GET /api/facturacion/bajas/:bajaId/status`
- `POST /api/facturacion/resumenes-diarios`
- `GET /api/facturacion/resumenes-diarios/:resumenId/status`

Toda creación requiere `idempotencyKey`. El formulario de NEWLAB genera esa clave automáticamente para impedir duplicados por doble clic o reintento.

## Reglas aplicadas

- Solo se corrigen o dan de baja comprobantes aceptados.
- Una nota no puede superar el saldo todavía no acreditado.
- Motivo `01` exige anulación por el total original; motivo `07` permite corrección parcial.
- La serie de nota es `FF01` para factura y `BB01` para boleta.
- Una baja no modifica el comprobante a `anulado` hasta que el CDR del ticket sea aceptado.
- Un resumen no vuelve a incluir boletas pertenecientes a otro resumen activo o aceptado.
- Los correlativos `07`, `RA` y `RC` se reservan atómicamente y no se regeneran al reintentar.

## Operación del resumen diario

Solicitud mínima:

```json
{
  "fechaResumen": "2026-07-12",
  "idempotencyKey": "una-clave-unica"
}
```

La respuesta inicial devuelve `summaryId`, `ticket`, cantidad de boletas y estado `pendiente`. Debe consultarse la ruta de estado usando ese `summaryId`.

## Antes de producción

- [ ] PostgreSQL está accesible desde el backend o terminal privada de Coolify.
- [ ] Las migraciones 912 y 913 fueron aplicadas dentro de una transacción.
- [ ] El contador aprobó los códigos de motivo y las series `FF01`/`BB01`.
- [ ] Se verificaron en beta nota total, nota parcial, baja y resumen.
- [ ] Se programó un worker para consultar automáticamente tickets pendientes.
- [ ] Se implementó almacenamiento permanente de XML y CDR base64.
- [ ] Se rotaron las credenciales expuestas durante las pruebas.

## Pendiente operativo

La API y las rutas están listas, pero la consulta de tickets todavía es manual mediante los endpoints de estado. Antes de producción conviene crear un job periódico que procese bajas y resúmenes pendientes con reintentos y alertas.
