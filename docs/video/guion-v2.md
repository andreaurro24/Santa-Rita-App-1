# Video del MVP: guion v4 (apertura corta y escena de lotes)

**Duración objetivo:** 6:40 (límite 7:00) · **Voz:** unas 750 palabras, un archivo por escena ·
**Hilo:** una sola pregunta, "¿Vendo hoy o espero?", que abre y cierra el video.

**Cómo leer la voz:** natural, como se lo contarías a un compañero, sin leer "de corrido". Las cifras
se dicen **redondeadas**; la cifra exacta la pone la pantalla con un zoom. Una barra `/` es una pausa
corta; `//` es una pausa larga (respiro, cambio de imagen).

**Datos:** todo lo que se ve son datos de demostración (ficticios), cargados en la base de la app
solo para grabar y borrados después. Ningún dato real de Miguel.

---

## Mapa del video

| # | Escena | Inicio | Dura | Formato |
|---|---|---|---|---|
| 0 | El dolor de Miguel (animación) + título | 0:00 | ~25 s | animación + título |
| 2 | La solución y el mapa TO-BE | 0:54 | 21 s | tarjetas |
| 3 | Proceso A: registrar un animal | 1:14 | 33 s | celular |
| 4 | Pesaje, ganancia diaria y alertas | 1:47 | 29 s | celular |
| 4b | Lotes: jornada de pesaje, avance y costos | — | ~32 s | celular |
| 5 | Proceso B: ¿Vendo? (el núcleo) | 2:16 | 72 s | escritorio + tarjetas |
| 6 | Simular y registrar la venta | 3:28 | 40 s | escritorio |
| 7 | "Al partir": visita y liquidación | 4:08 | 49 s | celular + tarjeta + escritorio |
| 8 | Resultados, cliente y cierre | 4:56 | 53 s | escritorio + tarjetas |

Tiempos reales de la v07 (5:49). La v08 acorta la apertura (de 54 s a unos 25 s) y agrega la escena 4b: total estimado de 6:00.

**Recurso que se repite: el mapa TO-BE.** Entre escenas aparece 2 o 3 segundos un mapa con dos
carriles, **"Miguel hace"** y **"La app hace sola"**, y se ilumina el paso en curso. Así se ve el
flujo automatizado y su alineación con el diseño TO-BE sin tener que explicarlo.

---

## Escena 0 · El dolor de Miguel (0:00 – 0:25) · animación dibujada a mano

El problema se cuenta como historia, con tono tierno (lápiz sobre papel,
`Video-Santa-Rita/animacion/dolor.html`), y la app aparece después como respuesta. En la v4 se acorta
de 49 s a unos 21 s: se quita el plano de "treinta días / un día entero", porque la escena 8 ya lo
cuenta en su "antes y ahora", y "casi un millón de pesos", porque la escena 5 lo muestra con cifras.
La música ("Dreams Become Real") se recorta a esa medida y conserva el golpe del título.

**Voz (esc-0), en 3 tramos:** uno por plano. Se graban como 3 archivos (`esc-0a`, `esc-0b`, `esc-0c`)
o como uno solo (`esc-0`) dejando 2 segundos de silencio entre tramos.

**Voz (esc-0a):** (0:00, ventana de 7 s)
> Cinco y media de la mañana en Badillo, Cesar. / Miguel mira su ganado: / ahí camina su patrimonio.

**Voz (esc-0b):** (0:07, ventana de 6 s)
> Pero lo que sabe de él está en un cuaderno, / en un chat… / y en su memoria.

**Voz (esc-0c):** (0:13, ventana de 8 s)
> Y la pregunta que vale plata, / ¿vendo hoy… o espero?, / hasta hoy se respondía… a ojo.

**Imagen (animación, unos 21 s, y título):**
- 0:00 **Amanecer:** Miguel de espaldas con sombrero vueltiao mira el potrero; el sol sale; vacas cebú
  pastan. Rótulo a mano "Badillo, Cesar · 5:30 a. m.".
- 0:07 **Cuaderno y chat:** "Pesajes" escrito a mano, un peso tachado, el chat que pregunta "¿Cuánto
  pesó el lote?"; la memoria: "370… 380… ¿372?" que se desvanece.
- 0:13 **La pregunta y el ojo:** "¿Vendo hoy… o espero?" se escribe y el camino se bifurca; un ojo que
  duda y se cierra; fundido a negro.
- 0:21 Golpe grave + título **¿Vendo hoy o espero?**; entra la música de la app.

## Escena 2 · La solución y el mapa (0:55 – 1:15)

**Voz (esc-2):**
> Nuestra solución es una aplicación web que se usa desde el celular, sin instalar nada. / Está
> publicada en Vercel y guarda los datos en Supabase, con validaciones en la propia base de datos. //
> El proceso tiene dos partes: / Miguel registra; / la aplicación calcula y recomienda.

**Imagen:**
- 0:50 Mini arquitectura que se arma de izquierda a derecha: celular → Vercel → Supabase (Auth,
  Postgres con reglas, fotos privadas).
- 1:00 El **mapa TO-BE** completo: proceso A "Registrar" y proceso B "Decidir", con los dos carriles.

## Escena 3 · Proceso A: registrar un animal (1:10 – 1:42) · celular

**Voz (esc-3):**
> Proceso uno: registrar. // Miguel añade un novillo. Escribe "Bravo" / y la app le pone el
> siguiente número de la finca: Bravo cero doce. / Si no sabe el mes de nacimiento, no importa. //
> Anota tres pesos: el de entrada, el de hoy y la meta. / Al poner el precio por kilo, la cuenta del
> costo aparece sola. // Una foto desde el celular, / se recorta cuadrada, / y queda guardada.

**Imagen (toma automática en el celular; escritura en cámara rápida):**
- Animales: tarjetas de lote arriba y lista abajo (2 s) → **Añadir animal**.
- Escribe "Bravo" → toca **Usar «Bravo-012»** (zoom al botón).
- Raza, nacimiento con **Mes desconocido** (cámara rápida 3x).
- Peso inicial 250, fecha de ingreso hace 60 días, peso actual 310, objetivo 450.
- **Compré por kilo** $9.000 → zoom a la cuenta: "$9.000 × 250 kg = $2.250.000 por animal".
- **Tomar foto** → diálogo "Cuadrar la foto" (se mueve el deslizador) → **Listo** → **Guardar** →
  la fila nueva con su miniatura (zoom).
- Mapa TO-BE 2 s: se iluminan "valida" y "guarda".

## Escena 4 · Pesaje, ganancia diaria y alertas (1:42 – 2:12) · celular

**Voz (esc-4):**
> En la ficha, la app ya calculó la ganancia diaria: / un kilo por día, con su gráfica. // Si alguien
> escribe un peso que cambia más de quince por ciento, / la app lo frena y pide confirmarlo: / un error
> de dedo ya no daña el historial. // Y al abrir la app, sin buscar nada, / Miguel ve qué revisar: /
> una vacuna que vence en pocos días / y un animal que está perdiendo peso.

**Imagen:**
- Ficha de Bravo-012: zoom a "Ganancia diaria · 1,00 kg" y a la gráfica.
- **Registrar peso** → escribe 380 → aviso "Pesaba 310 kg y escribiste 380 kg (+23 %)…" (zoom) →
  **Cancelar**.
- **Inicio** → tarjeta "Para revisar": vacuna "En N días" y "Está perdiendo peso…" (zoom a cada una).
- Mapa TO-BE 2 s: se iluminan "calcula la ganancia diaria" y "evalúa alertas".

## Escena 4b · Lotes: jornada de pesaje, avance y costos · celular

**Voz (esc-4b):**
> Miguel no maneja animales sueltos: maneja lotes. // El día de pesaje abre una jornada para el lote /
> y pesa uno tras otro desde el celular; / la aplicación le muestra cuáles faltan. // Al cerrar, el lote
> queda al día: / cuántas reses tiene, su peso promedio, / cuánto le falta para la meta / y en qué
> fecha llegaría. // Y los gastos del lote se reparten solos entre sus animales: / así sabe cuánto le
> cuesta cada res.

**Imagen (tomas `11-jornada` y `12-lote`):**
- Jornada de pesaje: lote "Novillos de ceba (4 reses)" → **Abrir jornada**.
- Capitán-002 con su último peso (335 kg, 22 de agosto) → 380 → **Guardar peso**. Siguen Relámpago-003
  (372), Tornado-001 (370) y Trueno-004 (365), en cámara rápida.
- La lista "Sin pesar" se vacía (lupa) → "Todo el lote está pesado" → **Cerrar jornada**.
- Detalle del lote: 4 reses, 371,8 kg de promedio, meta 450 kg (82,6 %), 0,99 kg/día, llega a la meta
  el 24 de diciembre (lupa).
- Costos: $1.600.000 gastados en el lote y $2.900.000 por res (lupa). Son los mismos números que usa la
  escena 5 (compra $10.000.000 + gastos $1.600.000).
- Mapa TO-BE 2 s: se iluminan "registra pesos" y "calcula el avance".

Los pesos de la jornada son los mismos del 6 de octubre que usan las escenas 5 y 6, así que las
cifras de después no cambian.

## Escena 5 · Proceso B: ¿Vendo? (2:12 – 3:30) · escritorio

**Voz (esc-5):**
> Proceso dos: decidir. // Miguel abre "¿Vendo?" y elige el lote. / La respuesta es clara: esperar. /
> Y dice por qué. //
> La app suma lo que de verdad costó el lote: la compra y cada gasto. / Con eso, el punto de
> equilibrio es de siete mil ochocientos pesos por kilo, / y la zona hoy paga ocho mil setecientos. //
> Luego simula: vender hoy, o esperar dos, cuatro u ocho semanas, / con lo que engorda cada animal y lo
> que cuesta mantenerlo. / Esperar ocho semanas sube el margen de un millón trescientos mil a dos
> millones doscientos setenta mil. //
> Y advierte el riesgo: si el precio baja diez por ciento, el margen casi desaparece. //
> Ahora, el giro. / Miguel recorre la finca y ve que el pasto se está secando. / Lo marca en rojo. //
> La recomendación cambia: vender antes de la meta, mientras todavía hay ganancia. / Y dice cuánto se
> deja de ganar: unos novecientos treinta mil pesos. // La decisión sigue siendo de Miguel; / pero
> ahora la toma con números.

**Imagen:**
- 2:12 ¿Vendo? → elige "Lote a evaluar" → sello **Esperar** + razón (zoom).
- 2:24 **Tarjeta animada** (no pantalla): dos barras, equilibrio $7.801/kg contra precio $8.700/kg;
  el espacio entre las dos se pinta en verde: "esto es el margen".
- 2:36 **Ver detalles** → tabla "Vender hoy o esperar": las filas se iluminan Hoy → 2 → 4 → 8
  semanas, con zoom a "(el mejor)".
- 2:50 Tarjetas "Si el precio cambia": zoom a −10 % → $43.210 (se pinta de rojo brasa).
- 2:58 Más → **Precio y pasto** → Registrar estado → **Escaso** → Guardar (cámara rápida).
- 3:08 De vuelta en ¿Vendo?: el sello cambia a **Vender antes de la meta** (zoom y un "golpe" de
  sonido suave) → zoom a "deja de ganar hasta $937.167".
- 3:24 Mapa TO-BE 2 s: "reúne datos → calcula costo y escenarios → recomienda con razones".

## Escena 6 · Simular y registrar la venta (3:30 – 4:25) · escritorio

**Voz (esc-6):**
> Miguel decide vender, / y aprovecha el mismo camión para un segundo lote. / Marca los dos. // La
> app deja por fuera, sola, a la vaca de cría: los vientres no se venden. / Suma el peso, aplica el
> precio de la zona / y, al anotar trescientos mil pesos de transporte, recalcula el beneficio neto al
> instante. // Confirma comprador y fecha, y guarda. // La venta queda registrada junto con la
> recomendación que dio el sistema: / así, después, se compara el margen esperado contra el real, / y
> se aprende de cada venta.

**Imagen:**
- Ventas → **Simular y registrar venta** → marca los dos lotes → zoom a "1 vientre no se vende.".
- "Peso total estimado" → escribe 300.000 en "Comisiones y transporte" → zoom al **Beneficio neto**
  que cambia (cifra exacta: la confirma el generador de datos).
- Confirmar venta → datos (cámara rápida 4x) → resumen → **Guardar venta**.
- Detalle: zoom a "Margen esperado" y "Margen real".

## Escena 7 · "Al partir": visita y liquidación (4:25 – 5:30)

**Voz (esc-7):**
> Parte del ganado no está en Santa Rita: / está "al partir", en fincas de terceros que se quedan con
> un porcentaje de la ganancia. / Antes, ese control era de palabra. // Ahora, en cada visita se pesa
> cada animal; / si un peso no cuadra o un animal no aparece, / queda registrado como discrepancia. //
> Y la liquidación es acumulada. / En la primera venta, el animal dejó un millón cuarenta mil de
> ganancia: / al tenedor le tocaron quinientos veinte mil. // En la segunda, el animal dio pérdida. /
> La app la descuenta de lo ganado: / al tenedor no se le paga nada, / y quedan doscientos mil a favor
> de Santa Rita. // Cuentas claras, para las dos partes.

**Imagen:**
- (Celular) Al partir → tarjeta del tenedor (ficticio) → **Registrar visita** → escribe los pesos;
  uno con más del 15 % → aviso "Revisa estos pesos…" (zoom) → marca uno **No encontrado** →
  **Guardar visita** → "N pesados, 1 no encontrado".
- (Escritorio) Venta del segundo animal en cámara rápida → detalle de la venta, liquidación:
  "**Pagar $0**", "Acumulada del contrato $640.000; ya se le pagaron $520.000", "Saldo a favor de
  Santa Rita: **$200.000**" (zoom a cada uno).
- **Tarjeta animada** de la liquidación (la clave para entender): barra de la venta 1 (+$1.040.000) →
  mitad para el tenedor ($520.000, pagado) → barra de la venta 2 (−$400.000) que baja la acumulada a
  $640.000 → la mitad sería $320.000, pero ya se pagaron $520.000 → **$200.000 a favor**.

## Escena 8 · Resultados, cliente y cierre (5:30 – 6:40)

**Voz (esc-8):**
> La página de indicadores mide el proyecto contra la línea base: / cuántos animales tienen historial,
> / cuánto hace que se pesó cada lote. //
> Antes, un día para saber cómo va un lote; / hoy, una pantalla. // Antes, sin historial; / hoy, cada
> peso con fecha y ganancia diaria. // Antes, tres fuentes a mano para decidir; / hoy, costo real,
> escenarios y una recomendación con sus razones. // Antes, el «al partir» era de palabra; / hoy, visitas
> y liquidaciones documentadas. //
> Y la construimos con Miguel y su equipo: / más de treinta cambios salieron de sus pedidos, / desde
> letra más grande hasta quitar el clima y la tasa de cambio, que pasan a segunda fase. //
> ¿Vendo hoy o espero? / Ahora Miguel lo responde con números.

**Imagen:**
- 5:30 Indicadores (desplazamiento lento, zoom a dos cifras).
- 5:42 **Tabla AS-IS contra TO-BE**, una fila por frase de la voz, entrando con la voz.
- 6:08 "Hecha con el cliente": 3 capturas antes/después (letra grande, menú de 4 botones, pantalla
  sin clima) en mosaico, con el contador "30+ cambios".
- 6:26 Vuelve el título **¿Vendo hoy o espero?** y debajo "Ahora, con números." → créditos (equipo,
  curso Gerencia de TI, Universidad de La Sabana, 2026-2, enlace a la app).

---

## Reglas de producción

- Nada dura más de 12 segundos sin un cambio visual (zoom, corte, tarjeta o mapa).
- Escritura en formularios: cámara rápida de 2x a 4x; los clics clave, a velocidad real.
- Un solo número clave por frase; la voz redondea y la pantalla muestra el exacto con zoom.
- Subtítulos en español, quemados, en su propia franja (no tapan la app).
- Música suave, baja (−24 LUFS aprox. bajo la voz), con ducking automático cuando hay voz.
- Si queda largo, cortar en este orden: la sensibilidad (escena 5), el mosaico del cliente (escena 8),
  la visita "Al partir" (dejar solo la liquidación), el aviso del 15 % (escena 4).

## Cambios frente al plan original (y por qué)

| Cambio | Por qué |
|---|---|
| Apertura dibujada "El dolor" (v3, pedida por el usuario) | El valor se entiende desde la necesidad de Miguel y no desde la app; en v2 la apertura mostraba la respuesta antes del problema |
| Mapa TO-BE recurrente | Se evalúa la alineación MVP/TO-BE y el flujo automatizado; antes estaba implícito |
| Registro baja de 50 s a 32 s | Es lo menos interesante; el tiempo pasa a "Al partir", lo más diferencial |
| Vacuna: ya no se crea en vivo | La app no permite programar vacunas desde la interfaz (solo eventos aplicados); la vacuna programada viene en los datos de demostración y se muestra en el tablero |
| ¿Vendo?: tarjetas animadas para equilibrio y escenarios | En la app los escenarios son una tabla dentro de "Ver detalles"; de oído no se siguen seis cifras |
| "Fase 2" pasa a "hecha con el cliente" | Convierte lo que se quitó en evidencia de validación y método ágil |
| Cierre que retoma la pregunta del inicio | Da sensación de historia completa |

## Datos de demostración (verificados con las funciones reales de la app)

| Lote | Animales (ficticios) | Para qué escena |
|---|---|---|
| A "Novillos de ceba" | Tornado, Capitán, Relámpago, Trueno (4 novillos) | 0, 5 y 6 |
| B "Novillos de la vega" | Tostado, Lucero y Paloma (vientre parida: pierde peso y tiene una vacuna en 7 días) | 4 (alertas) y 6 |
| C "Levante" | Al partir con Rafael Ortega (ficticio), 50 %: Canelo (ya vendido), Pinto, Moro, Barcino | 7; Bravo-012 se registra aquí |

Cifras que salen en pantalla: margen hoy $1.336.900; 8 semanas $2.274.067; equilibrio $7.801/kg;
precio −10 % → $43.210; con pasto rojo "deja de ganar hasta $937.167"; venta A+B con $300.000 de
transporte: 6 reses, 2.201 kg, **beneficio neto $1.770.187 (9,2 %)**; Al partir: pagar $0, acumulada
$640.000, ya pagado $520.000, saldo a favor $200.000.

**Orden de grabación** (distinto del orden del video, porque cada toma cambia los datos):
tablero e Indicadores → ¿Vendo? con pasto verde → pasto a rojo → ¿Vendo? otra vez → venta A+B →
venta de Pinto a $8.000/kg (escrito a mano) → visita "Al partir" → registro de Bravo-012 y su ficha.
Tomas grabadas el 2026-10-06 (10 tomas en `Video-Santa-Rita/tomas/`). Bravo es macho porque una
hembra en un lote de ceba dispara el aviso de vientres, y la app sugiere el número 012 (sigue la
numeración de la finca).

## Pendiente antes de grabar la voz

- "Un día → una pantalla" no tiene cronómetro: si alcanzan a cronometrar con Miguel (ver
  `docs/insumos-capitulos-6-a-8.md` §8, KPIs), se cambia por el tiempo medido.
