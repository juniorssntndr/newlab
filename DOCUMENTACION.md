# Documentación del Proyecto: DentaLab / NEWLAB

## 1. Descripción del Proyecto
DentaLab (o NEWLAB) es un sistema de gestión para laboratorios dentales. Permite la administración de órdenes (pedidos), clientes, catálogo de productos (servicios dentales), visualización de modelos 3D y facturación electrónica.

### ¿Cómo funciona?
El sistema opera a través de una aplicación web construida en **React** (Vite), con un backend/BaaS apoyado en **Supabase**. Los usuarios (técnicos, administradores, doctores) interactúan a través de una interfaz que ofrece herramientas como:
- **Odontograma interactivo** para seleccionar el área de trabajo.
- **Formularios de ingreso de órdenes**, con soporte para integraciones 3D.
- **Gestión de facturación**, conectándose a servicios de terceros (ej. APISPERU).

## 2. Skills de IA Recomendadas
Para continuar desarrollando este tipo de proyecto usando agentes IA (como Antigravity/Claude Code), se recomienda tener instalados los siguientes skills en el repositorio (carpeta `.agents/skills`):
- **playwright-skill**: Útil para hacer testing End-to-End, automatización de navegadores, testing responsivo de la UI y flujos de usuario (como login o creación de órdenes).
- **find-skills**: Fundamental para buscar y agregar rápidamente nuevas capacidades al ecosistema de IA.

## 3. MCPs (Model Context Protocol)
Los siguientes MCP servers son muy útiles o necesarios para el contexto del desarrollo de este sistema:
- **supabase-mcp-server**: Esencial para interactuar y administrar la base de datos, correr migraciones y consultar esquemas / políticas RLS (Row Level Security).
- **github-mcp-server**: Para la gestión de issues, PRs, búsqueda en código, crear ramas y commits.
- **notebooklm**: Para revisar documentación generada previamente o indexada y obtener información de arquitectura del equipo rápido.

## 4. APIs Integradas
- **Supabase API**: Base de datos Postgres, Autenticación y Storage de archivos.
- **APISPERU**: Usada fundamentalmente para generar la facturación electrónica.
- (A futuro) **n8n / APIs de mensajería (WhatsApp/Telegram)**: Para notificaciones automáticas.

## 5. Requisitos de Ejecución y Despliegue

### Entorno Local
Para ejecutar y desarrollar el proyecto en local se necesita:
- **Git**: Control de versiones.
- **Node.js** (v18 o superior): Entorno de ejecución para Javascript.
- **npm** o **yarn**: Gestor de paquetes.
- **Supabase CLI** (opcional pero recomendado): Para correr la base de datos local o vincular y ejecutar edge functions (`supabase start` / `supabase functions serve`).

**Pasos básicos:**
1. `git clone <repositorio>`
2. `cd frontend && npm install`
3. `npm run dev` (o `npm run server` según el `package.json`).

### Entorno de Producción
- **Frontend Hosting**: Vercel, Netlify o Render (idealmente Vercel por la optimización con frameworks modernos basados en Vite/React).
- **Backend / Base de datos**: Supabase (Cloud) u hosteado en VPS propio usando Docker.
- **Automatizaciones (Background Jobs)**: n8n o similar en un VPS administrado, en conjunto con Supabase Edge Functions.

---
*Nota: Este documento es un archivo vivo y se irá actualizando a medida que avancemos en la arquitectura y nuevas características del proyecto.*
