# Reflexión

## ¿Qué capítulo del arnés hizo la mayor diferencia y por qué?

El **Contexto**, y no por la razón que esperábamos. Creíamos que el riesgo era que la IA leyera mal
o inventara pesos, pero en la línea base no inventó ninguno. Fue prudente con la fila borrosa y con
el animal repetido. Falló en 3 de 6 casos por lo que no podía saber. No sabía que la 0209 no existe.
No sabía que la 0303 pesaba 187 kg hace un mes, así que no vio que 232 es un salto del 24 %. Y no
pudo armar la vacuna del "lote 2026-B" porque no sabe qué animales lo forman. Con el censo y el
último peso, el validador resolvió los tres y el arnés pasó de 3 a 6 de 6. El contexto solo no
basta: sin el validador, la regla del 15 % quedaría a criterio del modelo. Por eso Contexto y
Verificación funcionan juntos.

## ¿Qué pieza quitarían sin que empeore el resultado?

En estos casos, el **revisor IA** casi no cambió el resultado. Sus preguntas fueron claras, pero
las listas de válidos, dudosos e ilegibles las decide el validador, y el revisor no detectó ningún
error que el validador no hubiera marcado. Lo quitaríamos de los pesajes nítidos y lo dejaríamos
solo para fotos borrosas, donde sí aporta: dijo "¿348 o 368?" en vez de elegir. También podríamos
simplificar los tres ejemplos resueltos: el extractor siguió bien las skills sin necesitarlos.
Lo que **no** quitaríamos son los guardarraíles de la base de datos, aunque en estas pruebas el
modelo nunca intentó saltárselos: protegen contra el día en que sí lo haga.

## ¿Qué no pudo resolver el arnés y sigue necesitando a una persona?

1. **Saber la verdad de un dudoso.** El arnés detecta que la 0303 subió 24 %, pero no sabe si la
   báscula falló o si el animal de verdad ganó peso. Solo el administrador lo sabe.
2. **Un peso inventado pero creíble.** Si el modelo leyera "368" en la fila borrosa y lo escribiera
   también en el texto leído, la regla V8 no lo atraparía. Lo frenarían la confianza baja, el
   revisor o la persona, pero ninguna regla fija lo garantiza.
3. **Reportes que se contradicen entre sí.** Dos planillas de la misma jornada (casos 3 y 6) solo
   se detectan cuando el cargador las bloquea. Quién tiene la razón lo decide una persona.
4. **Las cuentas y las llaves.** Conectar Telegram, n8n y Supabase exige que alguien del equipo cree
   el bot y guarde los secretos. Es así a propósito.

**Lo que aprendimos:** el arnés no hizo más inteligente al modelo. Lo puso en un sistema donde sus
errores no llegan a la app. Las dos mejores mejoras salieron de errores reales que no habíamos
previsto (el tratamiento tomado por duplicado y la planilla por chapeta), no de lo que imaginamos
al diseñar.
