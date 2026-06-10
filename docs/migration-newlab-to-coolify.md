# Guía de Migración: De Supabase a PostgreSQL Local en Coolify (NEWLAB)

Esta guía detalla el proceso para migrar la base de datos y el almacenamiento de imágenes de **NEWLAB** desde Supabase a tu VPS administrado por Coolify, rescatando tus catálogos de servicios e insumos de logística y configurando almacenamiento local persistente.

---

## Paso 1: Crear la Base de Datos PostgreSQL en Coolify

1. Ingresá a tu panel de Coolify en [panel.affinixlab.com](https://panel.affinixlab.com/).
2. Hacé clic en **New Resource** (Nuevo Recurso) -> **Databases** -> **PostgreSQL**.
3. Definí el nombre del servicio (ej. `newlab-db`), usuario y contraseña.
4. Si tu backend va a seguir en Render (de manera temporal o definitiva):
   - En la configuración de la base de datos en Coolify, activá la casilla **"Publicly Accessible"** (Accesible públicamente).
   - Coolify asignará un puerto público aleatorio (ej. `34320`) en el VPS.
5. Copiá la cadena de conexión generada por Coolify (ej. `postgresql://user:password@vps-ip:puerto/database`).

---

## Paso 2: Configurar las Variables de Entorno en el Backend

Actualizá la configuración de tu backend (en Render o Coolify) con las nuevas variables:

```ini
# URL de conexión apuntando a tu nueva base de datos en Coolify
DATABASE_URL=postgresql://tu_usuario:tu_contraseña@vps-ip:puerto_publico/tu_db

# Almacenamiento local de imágenes
# Dejá estas dos variables vacías. Al no estar configuradas, el backend automáticamente
# guardará las subidas en el disco local (/app/uploads)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images
```

---

## Paso 3: Mapear Volumen Persistente para Imágenes (si desplegás el backend en Coolify)

Para evitar que las imágenes subidas por los usuarios se borren al redesplegar el backend, debés mapear un volumen persistente en Coolify:

1. En la configuración de tu servicio Backend en Coolify, navega a la sección **Storage** (Almacenamiento).
2. Mapeá un volumen persistente para la carpeta de subidas:
   ```text
   uploads_volume:/app/uploads
   ```
3. Esto garantizará que todo archivo subido a `/uploads` persista físicamente en el disco del VPS.

---

## Paso 4: Inicializar la Base de Datos y Restaurar los Catálogos Rescatados

Ya hemos extraído tus catálogos activos y los dejamos guardados en el archivo local:
* `backend/src/db/migration_950_rescued_data.sql`

Este archivo contiene la inserción ordenada de:
- **15 categorías de servicios**
- **110 materiales/insumos de logística**
- **15 productos/servicios configurados**

Dado que el archivo está estructurado como una migración estándar, el proceso de inicialización es sumamente sencillo:

1. Ejecutá la migración para recrear el esquema de base de datos e insertar los datos rescatados automáticamente:
   ```bash
   npm run migrate
   ```
   *Nota: Si estás corriendo el backend en Render, podés ejecutar este comando localmente apuntando tu `.env` a la DB de Coolify, o configurar Render para que corra el comando `npm run migrate` en el Build / Release Command.*

2. (Opcional) Si querés poblar la base con datos adicionales de prueba (usuarios, clínicas ficticias, etc.) para testing, podés ejecutar:
   ```bash
   npm run seed:small
   ```

---

## Paso 5: Verificación del Funcionamiento

1. Iniciá la aplicación y verificá que conecte correctamente a la base de datos.
2. Ingresá a la sección de **Logística / Insumos** y al **Catálogo de Servicios** y confirmá que figuren todos los datos originales.
3. Subí una imagen a un producto y corroborá que se almacene correctamente y la URL sea accesible (ej. `https://tu-api.com/uploads/product-xxxx.png`).

---

## Paso 6: Configurar Respaldos Automáticos (Backups)

> [!CAUTION]
> Al dejar Supabase, perdés sus backups diarios automatizados. Configurar copias de seguridad de la base de datos en Coolify es **mandatorio**.
>
> 1. En Coolify, hacé clic en tu servicio PostgreSQL.
> 2. Dirigite a **Backups** (Copias de Seguridad).
> 3. Habilitá los backups automáticos (ej. una vez al día a las 2:00 AM) y asocialos a un destino S3 de tu preferencia (o almacenamiento local del VPS si tenés suficiente espacio).
