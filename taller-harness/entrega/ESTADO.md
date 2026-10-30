# Estado de los entregables del taller (2026-10-30)

| # | Entregable | Estado | Dónde | Falta |
|---|---|---|---|---|
| 1 | Canvas completo con justificación | ✅ Listo | [canvas.md](canvas.md) | Nada |
| 2 | Versión funcional (capturas o enlace + instrucciones, skills y verificaciones) | 🟡 Casi | Textos en `../contexto/`, `../skills/`, `../arnes/`; flujo en `../n8n/`; evidencia en [capturas/](capturas/) | Capturas de Telegram, n8n y la app (abajo) |
| 3 | Bitácora de pruebas: 5 casos, tabla comparativa, 2 ciclos | ✅ Listo | [bitacora-pruebas.md](bitacora-pruebas.md) (9 casos, tabla, 2 ciclos y §7 prueba en vivo) | Nada |
| 4 | Reflexión (3 preguntas) | ✅ Listo | [reflexion.md](reflexion.md) | Opcional: mencionar lo aprendido en la prueba en vivo |
| 5 | Presentación de 5 minutos | ✅ Lista | [presentacion/index.html](presentacion/index.html) (10 diapositivas en HTML: el arnés y sus 7 capítulos, la innovación, resultados y fotos de la demo); la versión anterior sigue en `presentacion.pptx` | Ensayarla: unos 30 s por diapositiva |

## Qué se probó en vivo (Telegram + n8n + Supabase)
- Remitente no autorizado: el bot no responde y queda en la bitácora.
- Caso 1: 10 pesajes leídos de la foto; confirmados por otra persona y cargados.
- Autoconfirmación bloqueada: "Quien envió el reporte no puede confirmarlo".
- Duplicado bloqueado: "La 0101 ya tiene pesaje el 2026-10-27".
- Caso 2 en grupo: dudoso (0209 fuera del censo) bloquea la carga; "Confirmar sin los dudosos" carga 7.
- Fotos sin datos legibles: quedan como borrador con 1 ilegible, sin cargar nada.
- Resultado: 17 pesajes en la app, cada uno con el borrador de origen; 0 datos malos.

## Capturas
| Captura | Estado |
|---|---|
| Base: borradores, bitácora y pesajes cargados | ✅ [capturas/evidencia-base.png](capturas/evidencia-base.png) (generada de una consulta a Supabase) |
| Telegram: resumen del bot con los botones | ⏳ Equipo |
| Telegram: bloqueo de autoconfirmación y del dudoso | ⏳ Equipo |
| Telegram: "Listo: se cargaron 7 registros" | ⏳ Equipo |
| n8n: el flujo con una ejecución en verde | ⏳ Equipo (o Claude, si la extensión se conecta al navegador con la sesión) |
| App: animal 0101 o 0201 con el pesaje del 27/10 | ⏳ Equipo (usuario `miguel.prueba@santarita.test`) |

## Pendientes fuera del taller
- La base de producción tiene datos simulados: limpiarla antes de cargar datos reales de Miguel.
- `.env.local` y `TEST_USER_*` en Vercel siguen con valores del proyecto borrado.
- `tests/e2e/verificador.spec.js` tiene el ref del proyecto viejo.
