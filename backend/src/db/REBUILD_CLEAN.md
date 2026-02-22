# Rebuild limpio de base de datos (Supabase)

Este flujo reconstruye el esquema desde cero en un proyecto nuevo de Supabase, sin datos demo de pedidos.

## 1) Variables de entorno

Configura `DATABASE_URL` al **pooler IPv4** del proyecto Supabase (`:6543`).

Opcional para usuario admin inicial:

- `CLEAN_ADMIN_NAME`
- `CLEAN_ADMIN_EMAIL`
- `CLEAN_ADMIN_PASSWORD`
- `CLEAN_ADMIN_PHONE`

Si no defines esas variables, usa:

- email: `admin@newlab.pe`
- password: `admin123`

## 2) Ejecutar migraciones

```bash
npm run migrate
```

Esto aplica:

- `migration_000_base.sql`
- `migration_finanzas.sql`
- `migration_materials.sql`

## 3) Bootstrap limpio (roles + admin + categorías)

```bash
npm run bootstrap:clean
```

## 4) Validación rápida

En SQL Editor de Supabase:

```sql
select to_regclass('public.nl_usuarios') as usuarios,
       to_regclass('public.nl_pedidos') as pedidos,
       to_regclass('public.nl_notificaciones') as notificaciones,
       to_regclass('public.nl_pagos') as pagos;
```

```sql
select count(*) from nl_usuarios;
select count(*) from nl_categorias_trabajo;
```

Con eso ya debería funcionar login y operación normal para comenzar carga real.

## 5) Datos ficticios pequeños para QA

Si quieres un set pequeño de pruebas (no destructivo, idempotente por código de pedido):

```bash
npm run seed:small
```

Esto crea:

- 1 clínica demo de QA
- 1 técnico + 1 cliente de QA
- 2 productos demo
- 6 pedidos (`QA-00001` a `QA-00006`) con estados variados
- timeline, aprobaciones, pagos y notificaciones para pruebas funcionales
