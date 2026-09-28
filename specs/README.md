# Specs (Spec-Driven Development)

Cada feature no trivial se describe aquí **antes** de programarla. La spec es el contrato
entre quien pide (el equipo o Miguel Ángel), quien construye (el agente principal) y quien
verifica (el subagente `verificador`).

## Cuándo escribir una spec
- La feature toca más de ~3 archivos, el esquema de base de datos o una regla de negocio.
- Hay más de una forma razonable de hacerla y hay que elegir.

Los bugs puntuales y los cambios de texto o estilo no necesitan spec.

## Estructura
```
specs/
  _plantilla.md          plantilla a copiar
  NNN-nombre/spec.md     una carpeta por feature, numerada en orden de creación
```

## Estados
| Estado | Significa |
|---|---|
| `borrador` | En redacción. No se programa nada todavía. |
| `aprobada` | Un humano marcó la casilla de aprobación. Se puede implementar. |
| `en-progreso` | Hay tareas en curso. |
| `en-verificacion` | Tareas terminadas; el `verificador` está revisando. |
| `hecha` | El verificador dio `APROBADO` y un humano lo confirmó. |

## Requisitos en formato EARS
Cada requisito lleva un ID (`R1`, `R2`…) para poder rastrearlo en código, tests y reportes.

| Tipo | Forma |
|---|---|
| Siempre | El sistema deberá … |
| Evento | Cuando <evento>, el sistema deberá … |
| Estado | Mientras <estado>, el sistema deberá … |
| No deseado | Si <error o condición>, el sistema deberá … |
| Opcional | Donde <característica esté activa>, el sistema deberá … |

Un requisito que no se puede verificar (ni con un test, ni con un paso manual concreto)
está mal escrito: reescríbelo.

## Índice
| Spec | Estado | Sprint |
|---|---|---|
| [001 — Fundaciones: Supabase, autenticación y esquema](001-fundaciones/spec.md) | en-verificacion (bloqueada por T9: despliegue) | 0 |
| [002 — Sistema de diseño y layout adaptable](002-sistema-diseno/spec.md) | hecha | 0 |
| [004 — Jornada de pesaje por lote y GDP](004-pesajes-gdp/spec.md) | hecha | 1 |
| [006 — Lotes, ciclos, fincas, potreros y movimientos](006-lotes-ubicacion/spec.md) | hecha | 1 |
| [007 — "Al partir": tenedores, contratos y visitas](007-al-partir/spec.md) | en-verificacion | 2 |
| [008 — Insumos y costos](008-costos/spec.md) | en-verificacion | 2 |
| [009 — Estado del pasto y parámetros de venta](009-pasto-parametros/spec.md) | aprobada | 3 |
| [010 — Recomendación de venta v2](010-recomendacion-v2/spec.md) | en-progreso (dominio listo) | 3 |
| [011 — Venta real y cierre del ciclo](011-ventas/spec.md) | aprobada | 3 |

Las specs 003 (gestión del hato) y 005 (sanidad) no existen como archivo: el control de permisos de Claude Code bloqueó su creación. Quedan pendientes de revisión humana.
