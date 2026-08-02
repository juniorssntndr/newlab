# Plan — Wizard de pedido AFINIX (estilo Godent adaptado)

**Fecha:** 2026-07-23  
**Estado:** En implementación  
**Principio:** Misma lógica de negocio (`useOrderComposerState`, `odontograma.js`, payload); cambia orquestación UX.

## Macro pasos

1. **Caso** — paciente/clínica → categoría/producto → dientes → detalle clínico  
2. **Archivos** — modo de ingreso: digital | envío modelos | recolección  
3. **Confirmar** — fecha, observaciones, resumen → crear pedido  

## Caso (subpasos)

- Lab: elige clínica; Cliente: clínica fija del usuario  
- Producto desde catálogo AFINIX  
- Dientes: odontograma minimal + chips + Guardar y continuar (omitir si el producto no requiere piezas)  
- Detalle: material / tono / notas del ítem  
- Tras ítem: editar / agregar otro / ir a Archivos  

## Archivos (v1)

- `digital` — subirá archivos digitales (ahora o después)  
- `envio` — enviará modelos físicos  
- `recoleccion` — el lab recolecta en consultorio  

Escaneo AFINIX en consultorio: fuera de v1.

Persistencia v1: prefijo estructurado en `observaciones`  
`[INGRESO:digital|envio|recoleccion]` + nota libre.

## Fuera de alcance v1

- Rediseño landing  
- Columna DB dedicada `modo_ingreso` (puede migrarse después)  
- Escaneo en consultorio  
