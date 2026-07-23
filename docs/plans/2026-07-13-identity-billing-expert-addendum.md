# Addendum — mejoras de experto aplicadas (2026-07-13)

Complemento al plan `2026-07-13-production-customer-identity-billing-plan.md` tras la implementación A+B.

## Mejoras incluidas (más allá del mínimo)

1. **Bug crítico ACL**: el receptor del formulario ahora viaja en `draft.receptor` y no se pierde al re-leer la clínica desde BD.
2. **Snapshot fiscal persistido** en `nl_comprobantes.receptor_*` para que NC/bajas no muten con ediciones posteriores de la clínica.
3. **Caché LRU-TTL** (1h / 500) en consultas DNI/RUC para no quemar la cuota gratuita de APISPERU.
4. **RBAC** en `/api/consultas` y previews: solo `admin`/`tecnico`.
5. **Códigos de error normalizados** (`DOCUMENT_NOT_FOUND`, `TOKEN_MISSING`, etc.) en respuestas de identidad.
6. **Logger con redacción** de `token=`, Bearer y Authorization.
7. **RUC único** (índice parcial) y limpieza de `dni` al confirmar clínica por RUC.
8. **Modales fiscales NEWLAB** (confirmación + resultado) con reintento idempotente.
9. **IdempotencyKey** también en emisión rápida de `DetalleFinanza`.
10. **422 enriquecido** con `cdr_code`, `cdr_description` y `requestId`.

## Pendiente Fase C (no automatizable solo con código)

- Configurar emisor real AFINIX en `nl_empresas` y probar beta con `APISPERU_MOCK=false`.
- Worker/cron de tickets de bajas y resúmenes diarios.
- Mover `token_apisperu` fuera de texto plano (secreto Coolify / cifrado).
- Rotar credenciales y cerrar PostgreSQL público.
- Almacenamiento durable propio de XML/CDR (hoy se conservan URLs + metadatos).
- Boleta consumidor final (validar con contador antes de implementar).
- UI de resumen diario y polling de bajas pendientes.

## Cómo aplicar migraciones

```bash
cd backend
node src/db/run_migration.js
```

Incluye `migration_914_identity_masters.sql` y `migration_915_comprobante_receptor_snapshot.sql`.
