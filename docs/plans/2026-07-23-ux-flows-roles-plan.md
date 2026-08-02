# Plan UX/UI — Flujos por rol (AFINIX / NEWLAB)

**Fecha:** 2026-07-23  
**Estado:** Acordado (brainstorming)  
**Alcance:** Reorganización de navegación y flujos; mejoras visuales al servicio de claridad.  
**Fuera de alcance inmediato:** Rediseño de marca / landing pública.

---

## 1. Decisiones tomadas

1. **Prioridad de usabilidad:** Cliente (sin capacitación amplia) → Lab técnico → Admin/socios.
2. **Modelo mental en cada rol:** *Flujo del día a día* vs *Herramientas*.
3. **Regla de pantalla:** 1 acción primaria visible; secundarias en “Más”.
4. **Lenguaje:** estados en español de negocio (no códigos internos).
5. **Cliente:** Pedir → Seguir → **Aprobar diseño** es crítico. Calendario es **herramienta** importante (ver entregas), no el camino principal.
6. **Lab técnico = producción + cajero:** puede cobrar y girar comprobantes (hoy el código solo permite admin; hay que abrir acceso).
7. **Admin/socios:** Dashboard como casa + visión global de datos; además puede intervenir en pedidos/finanzas.

---

## 2. Principios UX/UI (aplicar en todos los cambios)

| Principio | Qué implica en NEWLAB |
|-----------|------------------------|
| Claridad > densidad | Menos botones a la vista; más espacio; tipografía legible |
| Mobile-first en Cliente | Pasos cortos, cards, CTAs ≥ 44px |
| Una pregunta por pantalla | ¿Dónde estoy? ¿Qué importa? ¿Qué hago? |
| Preservar marca AFINIX | Mantener paleta existente (`#007BFF` / `#0A1B33`); no imponer temas genéricos |
| Accesibilidad | Contraste, focus visible, labels claros, menos jerga |
| No reescribir negocio | Cambiar presentación y permisos de UI; no romper facturación/pedidos |

---

## 3. Reorganización por rol

### 3.1 Cliente

**Navegación propuesta**

```text
Flujo
├── Pedir
├── Mis pedidos          ← casa
└── Por aprobar          ← badge si hay pendientes

Herramientas
├── Calendario           ← entregas / pedidos en el tiempo
└── Cuenta
```

**Cambios de UX**

| Área | Hoy (aprox.) | Mejora |
|------|--------------|--------|
| Sidebar | Catálogo, Nuevo, Mis pedidos, Calendario al mismo nivel | Separar Flujo vs Herramientas; badge en Por aprobar |
| Crear pedido | Composer / quick-order usable pero denso | Wizard 3–4 pasos, copy simple, 1 CTA |
| Lista pedidos | Tabla desktop + cards mobile | Cards unificadas; estado en español; “qué falta de ti” |
| Detalle | Comparte UI densa con lab | Vista cliente: progreso + solo acciones del doctor |
| Aprobar | Enterrado en detalle | Entrada dedicada + 2 botones: Aprobar / Pedir ajuste |
| Calendario | Existe | Mantener; desde evento → pedido; no obligatorio para pedir/aprobar |

### 3.2 Lab técnico

**Navegación propuesta**

```text
Flujo
├── Cola de trabajo      ← casa (reemplaza “lista fría”)
└── Pedido abierto       ← 1 botón “Siguiente paso”

Herramientas
├── Calendario
├── Finanzas (pedido / cobros)   ← NUEVO acceso (cajero)
├── Productos / Almacén
└── Cuenta
```

**Cambios de UX**

| Área | Hoy | Mejora |
|------|-----|--------|
| Pedidos | Lista + filtros | Cola por urgencia: Hoy/atrasados, Esperando doctor, En curso, Listos |
| DetallePedido | Muchas acciones a la vez | 1 CTA según estado; resto en “Más opciones” |
| Cobro / boleta | Bloqueado a admin | Habilitar finanzas a técnico; atajo “Cobrar / Emitir” desde pedido listo |
| Copy | Estados técnicos | Etiquetas de acción (“Enviar a aprobación”, “Marcar enviado”) |

**Mapa CTA primario (lab)**

| Estado | Botón principal |
|--------|-----------------|
| pendiente | Empezar diseño |
| en_diseno | Enviar a aprobación |
| esperando_aprobacion | Esperar (mensaje claro) |
| en_produccion | Marcar terminado |
| terminado | Marcar enviado / Cobrar |
| enviado | Cobrar / Emitir boleta (si falta) |

### 3.3 Admin / socios

**Navegación propuesta**

```text
Flujo
├── Dashboard            ← casa
├── Cola / Pedidos
└── Finanzas globales

Herramientas
├── Caja y gastos
├── Clínicas / Doctores
├── Equipo
├── Catálogo / Almacén
├── Calendario
└── Cuenta
```

**Cambios de UX**

| Área | Hoy | Mejora |
|------|-----|--------|
| Dashboard | Existe, poco “dirección” | KPIs accionables: atrasados, por cobrar, por facturar, errores SUNAT |
| Visión socios | Dispersa | Dashboard = resumen de todo; drill-down a listas |
| Permisos | Admin = finanzas | Admin mantiene todo; lab gana cajero; cliente sin finanzas |

---

## 4. Cambios visuales (sin rediseñar la marca)

1. **Jerarquía tipográfica:** títulos cortos + subtítulo “qué hacer ahora”.
2. **CTA primario único** por vista (color marca); secundarios ghost/outline.
3. **Badges de estado** con vocabulario humano + color semántico estable.
4. **Cards mobile** como patrón default en Cliente y Cola lab; tablas solo desktop admin/finanzas densas.
5. **Empty states** con siguiente paso (“Aún no hay diseños por aprobar”).
6. **Feedback:** toasts cortos; en errores, qué hacer (no solo el código).
7. **Touch:** botones grandes en Cliente/Lab mobile; evitar hover-only.

---

## 5. Cambios técnicos de soporte (habilitadores)

1. **Permisos:** `canAccessFinancialModules` → admin **o** técnico (lab cajero). Revisar backend `forbidRole('tecnico')` en dashboard finance vs rutas facturación.
2. **Vistas por rol en DetallePedido:** ramas `isClient` vs `isLab` (ya parcialmente existe `isLab`).
3. **Ruta / inbox “Por aprobar”** (filtro `esperando_aprobacion` + acciones cliente).
4. **Cola lab:** filtros/agrupación sobre listado actual de pedidos (no hace falta microservicio nuevo).
5. **Copy centralizado:** mapa `estado → label` compartido frontend.

---

## 6. Fases de implementación

### Fase A — Cliente sin capacitación (máximo impacto)
- Nav Flujo / Herramientas + badge Por aprobar  
- Detalle pedido “modo cliente”  
- Flujo Aprobar / Pedir ajuste simplificado  
- Pulido mobile catálogo → pedir  
- Calendario como herramienta (enlace a pedido)

### Fase B — Lab cola + cajero
- Cola de trabajo como casa  
- Detalle con 1 CTA + “Más opciones”  
- Abrir Finanzas / emitir / cobrar a técnico  
- Atajo cobrar-boleta desde pedido terminado/enviado

### Fase C — Admin dashboard socios
- Dashboard accionable (KPIs + atajos)  
- Coherencia visual con A/B  
- Finanzas globales sin cambiar lógica de negocio

### Fase D — Pulido transversal
- Empty states, accesibilidad, copy unificado  
- Revisión Playwright smoke por rol (cliente / lab / admin)

---

## 7. Criterios de éxito

| Rol | Señal de éxito |
|-----|----------------|
| Cliente | Pedir + aprobar sin explicación oral; calendario opcional pero útil |
| Lab | “Siguiente paso” obvio; cobrar/boleta sin pedir admin |
| Admin | Dashboard responde “qué está pasando en el lab y la caja” en &lt; 10 s |

---

## 8. No hacer (anti-alcance)

- No rediseñar landing AFINIX en esta fase  
- No meter Tailwind/shadcn si el sistema CSS actual basta  
- No ocultar Calendario del cliente  
- No quitar capacidades lab avanzadas: solo **reordenar** (Más opciones)  
- No fusionar roles admin/lab en un solo menú

---

## 9. Próximo paso sugerido

Implementar **Fase A (Cliente)** sobre el código actual (`Sidebar`, `DetallePedido`, `CatalogoCliente`, `Pedidos`, `CalendarioCliente`), midiendo con prueba real en móvil.
