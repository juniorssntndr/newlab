
## Code Review Rules

- Use conventional commits only.
- Never add AI attribution to commits.
- **Branding & Naming Permanence (MANDATORY):** Todo el desarrollo, interfaces, membretes, reportes impresos, tickets y modales deben utilizar estrictamente la marca oficial **AFINIX LAB** / **AFINIX Dental Lab** (**AFINIX DENTAL LAB S.A.C.**). Queda estrictamente prohibido usar el nombre provisional "NEWLAB" en componentes de UI, reportes o pantallas de usuario, así como el término "gaveta" (reemplazado 100% por "Efectivo en Caja" o "Caja").
- Prefer small, safe frontend changes over broad rewrites.
- Preserve business logic unless the task explicitly requires changing it.
- For React changes, keep components composable and avoid duplicating state ownership.
- For styling changes, prefer scoped selectors and avoid regressions across shared surfaces.
- **Componentes de Selección y UI Consistency (MANDATORY):** Queda estrictamente prohibido utilizar elementos `<select>` HTML nativos en formularios, filtros o modales. Se debe emplear SIEMPRE el componente estandarizado `CustomSelect` (`frontend/src/components/CustomSelect.jsx`) para garantizar la coherencia visual con el sistema de diseño (modo oscuro/claro, trigger customizado, popovers flotantes con portal). Asimismo, en interfaces móviles, las pestañas/tabs de módulos deben mantenerse alineadas horizontalmente (`flex-direction: row`, `flex: 1 1 50%` o scroll horizontal) y nunca apilarse verticalmente.

## Skills Auto-load

Load the relevant skill before changing behavior or code in these contexts:

| Context | Skill |
| ------- | ----- |
| UI structure, visual styling, layout, accessibility, responsive behavior, interaction states, dashboards, modals, forms, cards, tables, charts, navigation, or design-system decisions | `ui-ux-pro-max` |
| React component structure, render behavior, state ownership, effects, memoization, bundle/performance-sensitive frontend work | `vercel-react-best-practices` |
| Browser automation, visual smoke checks, screenshots, interaction validation, or end-to-end UI flow checks | `playwright-skill` |

## UI/UX Pro Max Policy

- Treat `ui-ux-pro-max` as UX/design guidance, not as permission to rewrite business logic.
- NEWLAB frontend is React + Vite with an existing CSS system; do not assume Tailwind or shadcn/ui unless the project configuration proves it.
- Preserve state ownership, payload shape, derived order data, and business behavior before improving visuals.
- Prefer page-scoped or component-scoped selectors for UI changes; assess regression risk before editing shared classes such as `.btn`, `.card`, `.form-*`, `.data-table`, composer, modal, sidebar, or header styles.
- Every non-trivial UI change must explicitly consider accessibility, responsive behavior, interaction states, visual consistency, and perceived performance.
- For SDD changes, apply `ui-ux-pro-max` during proposal/design/spec/verify so UX decisions become verifiable scenarios, not vague taste.

## Focus Areas

- Validate JSX/JS consistency and avoid obvious runtime issues.
- Watch for CSS regressions in shared composer/modal layouts.
- Flag payload/state drift between UI and derived order data.

## Business & Domain Model Rules (MANDATORY)

- **Un Solo Producto por Orden (Single-Product Work Order):** En AFINIX Dental Lab, cada orden técnica (`nl_pedidos`) corresponde estrictamente a un único tipo de producto dental (`nl_productos`), con sus respectivas piezas dentales (odontograma) o cantidad de unidades del mismo producto. NUNCA crear ni sembrar órdenes con múltiples productos dispares (por ejemplo, corona + férula + PPR en la misma orden). Cada trabajo técnico tiene su propio flujo, tiempo de entrega, área de producción y comprobante. Si una clínica envía múltiples trabajos o pacientes, se generan órdenes separadas que luego se consolidan financieramente en mostrador (Caja) o en Gestión de Cobros.

- **Simulación y Sembrado de Pedidos 100% Realistas (Realistic Order Simulation Standard):**
  Toda prueba, test automatizado, seed o simulación de pedidos DEBE respetar la anatomía completa y realista de un pedido dental real:
  1. **Tipos de Cliente:**
     - *Cliente con Portal (Cuenta Propia):* Registrado en `nl_clinicas` con RUC/DNI, razón social y un usuario activo en `nl_usuarios` (`tipo = 'cliente'`) con credenciales para acceder al portal.
     - *Cliente Mostrador / Sin Cuenta:* Registrado en `nl_clinicas` con sus datos fiscales y de contacto (RUC/DNI, razón social, dirección, teléfono), pero SIN usuario en `nl_usuarios` (no tiene acceso al portal, interactúa solo por mostrador/WhatsApp).
  2. **Datos del Paciente y Odontograma:**
     - Nombre completo y verosímil de paciente (ej. 'Ana García Pérez', 'Carlos Mendoza Ramos').
     - Piezas dentales según nomenclatura FDI en array (`{11}`, `{21,22}`, `{36}`) para prótesis fijas/implantes, o cantidad de unidades con indicación de arcada (superior/inferior) para férulas/removibles.
     - Color VITA real (ej. 'A1', 'A2', 'A3', 'B1', 'BL2').
     - Material coherente con el producto seleccionado (ej. 'Zirconia Monolítica', 'Disilicato de Litio e.max', 'PMMA', 'Cr-Co').
  3. **Catálogo y Precios Oficiales:**
     - Asociar siempre a un producto real existente en `nl_productos`.
     - Respetar los precios base y cálculo de subtotal + IGV (18%) exacto del catálogo, sin inventar montos arbitrarios desconectados del producto.
  4. **Tiempos y Logística (Flujo de Entrega y Envío):**
     - Fecha de registro (`fecha`).
     - Fecha de prueba clínica (si el tipo de trabajo lo requiere).
     - Fecha de entrega comprometida (`fecha_entrega`), calculada según el tiempo estimado en días del producto (`tiempo_estimado_dias`).
     - Modalidad logística: entrega por motorizado/reparto con dirección de clínica o recojo presencial en sede del laboratorio.
     - Estados de flujo coherentes: `pendiente` -> `en_diseno` -> `esperando_aprobacion` -> `en_produccion` -> `control_calidad` -> `terminado` -> `en_ruta` / `entregado`.

- **Información Fiscal Oficial de AFINIX DENTAL LAB S.A.C. y Normativa SUNAT (MANDATORY):**
  Toda emisión de comprobantes, tickets, hojas de impresión, reportes fiscales y llamadas a servicios de facturación (APISPERU / OSE / SUNAT) DEBE basarse estrictamente en la identidad legal real de la empresa:
  1. **Datos Legales del Emisor:**
     - *Razón Social:* `AFINIX DENTAL LAB S.A.C.`
     - *RUC:* `20616033973`
     - *Tipo de Empresa:* `Sociedad Anónima Cerrada`
     - *Condición / Estado:* `Activo` / `Habido`
     - *Fecha Inicio Actividades:* `04 / Junio / 2026`
     - *CIIU:* `33118` (`Fab. Equipo Medico y Quirurgico`)
     - *Dirección Legal y Visual Oficial:* `Calle Piura 316, Mariano Melgar, Arequipa.` (Texto exacto y permanente para cabeceras de comprobantes y tickets térmicos).
     - *Distrito / Provincia / Departamento:* `Mariano Melgar / Arequipa / Arequipa`
     - *País:* `Perú`
     - *Ubigeo Oficial:* `040126` (Arequipa - Arequipa - Mariano Melgar)
  2. **Series y Máscaras de Comprobantes:**
     - *Factura Electrónica (`01`):* Serie `F001`, correlativo numérico correlativo de 8 dígitos (ej. `F001-00000001`). OBLIGATORIA para clientes con RUC 20 (personas jurídicas) o clientes con RUC 10 con negocio que requieran crédito fiscal y deducir costo/gasto.
     - *Boleta de Venta Electrónica (`03`):* Serie `B001`, correlativo numérico de 8 dígitos (ej. `B001-00000001`). Para consumidores finales (personas naturales con DNI o sin documento fiscal de empresa).
     - *Nota de Venta / Ticket de Caja (`00` / `NOTA`):* Serie `NV01` o `TCK`, correlativo de 8 dígitos (ej. `NV01-00000001`). Comprobante administrativo interno de mostrador cuando no se emite comprobante tributario electrónico inmediato.
     - *Nota de Crédito Electrónica (`07`):* Serie `FC01` (para anular/modificar facturas) o `BC01` (para boletas).
  3. **Reglas de Cumplimiento e Integridad Tributaria:**
     - PROHIBIDO concatenar prefijos de serie duplicados o timestamps en el número visible o impreso (ej. `B001-B001-T...` es un error invalidante ante SUNAT).
     - **Líneas y Descripción de Ítems:** En las líneas facturables de comprobantes (Factura, Boleta y Ticket) debe ir estrictamente el producto o servicio odontológico (ej. 'Corona de Zirconia Monolítica', 'Guía Quirúrgica 3D') junto con la cantidad de unidades. El paciente es un dato clínico interno del laboratorio y NUNCA debe ir como ítem facturable en la descripción ni mezclado con el producto.
     - El código QR impreso DEBE respetar la especificación técnica de SUNAT: `20616033973|TIPO|SERIE|CORRELATIVO|IGV|TOTAL|FECHA|TIPO_DOC|NUM_DOC|HASH|`.
     - Todo cobro con comprobante fiscal debe desglosar con exactitud matemática: Operación Gravada (`subtotal / 1.18`), IGV 18% y Total.
     - Centralización: los componentes visuales nunca deben usar datos hardcodeados de prueba (ej. `20608941231` o `Lima`); deben leer dinámicamente la configuración de la empresa emisora desde `nl_empresas` a través del backend.
