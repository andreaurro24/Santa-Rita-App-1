# Plan del producto — Finca Santa Rita

Documento vivo. Resume lo que el software debe hacer, sacado del documento de proyecto
(Gerencia de TI, caps. 1–5) y de lo que ha contado el cliente. Cada sprint se detalla después
en specs dentro de `specs/`.

## 1. Problema y objetivo

Finca Santa Rita engorda y vende ganado de carne. Hoy el peso se anota en papel o se manda
en fotos por WhatsApp, la sanidad vive en papeles sueltos y la decisión de vender un lote
depende del criterio de una sola persona (Miguel Ángel), que cruza de memoria el precio del
kilo, el clima y la TRM. Eso ya costó cerca del 10 % del valor de una venta por la
revaluación del peso, y obligó a vender antes de tiempo ante El Niño sin poder saber si era
la mejor decisión.

**Objetivo del software:** centralizar la trazabilidad individual del hato (identificación,
peso, sanidad, ubicación, costos) y convertirla en una recomendación de venta explicable,
basada en el punto de equilibrio real del lote y en variables de mercado y clima.

## 2. Usuarios

| Usuario | Hoy | Después |
|---|---|---|
| Miguel Ángel Lacouture (dueño, compra-venta) | **Único usuario.** Registra y consulta todo. | Sigue siendo el que decide la venta. |
| Rosana Daza (dueña) | — | Consulta de reportes. |
| Administrador de la finca | — | Registro diario (pesajes, sanidad) desde el celular. |
| Tenedores "Al partir" | — | Fuera de alcance por ahora. |

El esquema de datos y los permisos se diseñan con roles (`dueno`, `administrador`) desde el
inicio, aunque al principio solo exista la cuenta de Miguel.

## 3. Reglas de negocio

- **D1 · Modelo:** ceba (compra de novillos flacos, p. ej. 200 kg, que se engordan hasta un
  peso pactado, p. ej. 350 kg) más cría propia (animales nacidos en la finca que se levantan
  y se venden). La leche la usa el administrador como ingreso propio: fuera de alcance.
- **D2 · Qué no se vende:** vacas que ya parieron y hembras con potencial reproductivo. Un
  animal de categoría `vientre` nunca entra a un lote de venta.
- **D3 · Cómo se vende:** el lote completo, a un comprador directo, sin intermediarios ni
  subasta. Por lo general una vez al año (el documento dice cada 7 a 9 meses), cuando el
  **promedio** del lote llega al peso pactado. La duración del ciclo es configurable por lote.
- **D4 · Venta anticipada:** ante riesgo climático (sequía, El Niño, escasez de pasto) se
  puede vender antes de llegar a la meta. El sistema debe decir si conviene y cuánto se deja
  de ganar.
- **D5 · Precio:** por kilo en pie, con un porcentaje de destare configurable (por defecto
  0 % hasta que Miguel confirme el valor real).
- **D6 · Identificación:** cada animal tiene hierro de la finca (SR), número interno y
  chapeta ICA/Sinigán. El número interno y la chapeta no se pueden repetir.
- **D7 · Ubicación:** la mayoría del hato está en Santa Rita; otra parte está en fincas de
  terceros bajo "Al partir". Cada animal está en una finca y, opcionalmente, en un potrero.
- **D8 · "Al partir":** los dueños entregan animales a una finca externa bajo contrato
  (animales entregados, precio del animal, precio por kilo y porcentaje pactado). El tenedor
  los cuida y, al vender, recibe un porcentaje de la **ganancia neta** (por defecto). Miguel
  verifica con visitas sin previo aviso; el resultado de cada visita debe quedar registrado.
- **D9 · Costos:** la compra se registra por animal. Los demás costos (suplemento, sal
  mineral, medicamentos, jornales, transporte, arriendo de pasto) se registran por lote y se
  reparten por igual entre los animales activos del lote en la fecha del gasto.
- **D10 · Punto de equilibrio:** precio mínimo por kilo = (costo de compra + costos
  repartidos acumulados) / (peso actual × (1 − destare)).
- **D11 · Margen neto para Santa Rita:** ingreso − costos totales − participación del
  tenedor (si el animal está "Al partir").
- **D12 · Unidades:** peso en kg con un decimal, dinero en COP sin decimales, fechas en zona
  horaria America/Bogota.

## 4. Módulos funcionales

Prioridad MoSCoW: **M** = imprescindible para el MVP, **S** = debería estar, **C** = si alcanza.

| ID | Módulo | Qué hace | Prioridad |
|---|---|---|---|
| M1 | Acceso | Login real con Supabase Auth, sesión persistente, cierre de sesión, roles preparados. | M |
| M2 | Hato | Crear, editar y dar de baja animales; categoría (novillo, ternero, vientre, reproductor); origen (compra o nacimiento); estados (activo, vendido, muerto, trasladado); búsqueda y filtros. | M |
| M3 | Pesajes | Pesaje individual y **jornada de pesaje por lote** (captura rápida animal por animal, pensada para el celular en el corral). Ganancia diaria de peso (GDP) y alerta si un animal pierde peso. | M |
| M4 | Sanidad | Vacunas, tratamientos y desparasitaciones aplicadas y programadas; aplicación a todo un lote; alertas de vencidas; calendario ICA (aftosa semestral). | M |
| M5 | Lotes y ciclos | Lote con tipo (ceba o cría), fecha de inicio, peso meta pactado, fecha de venta proyectada según la GDP, estado (activo, listo, vendido). | M |
| M6 | Fincas y potreros | Santa Rita y fincas de tenedores; potreros simples; mover animales entre ellos con historial. | S |
| M7 | "Al partir" | Tenedores, contratos (animales, precio del animal, precio/kg, % pactado), visitas de verificación con pesaje y notas. | M |
| M8 | Insumos y costos | Registro de gastos por lote o por animal con categoría; costo acumulado por animal y por lote. | M |
| M9 | Mercado y clima | Precio del kilo en pie (manual, con histórico), TRM y clima a 7 días en vivo (ya existen); estado del pasto con semáforo manual. | M |
| M10 | Recomendación de venta v2 | Punto de equilibrio real (D10), margen neto (D11), escenarios "vender hoy" vs. "vender en N semanas" usando la GDP, sensibilidad al precio y a la TRM, razones explicadas. | M |
| M11 | Ventas y cierre de ciclo | Registrar la venta real (comprador, fecha, pesos, precio, destare) y compararla con lo que recomendó el sistema; liquidación de tenedores. | S |
| M12 | Reportes y KPIs | Reporte de decisión en PDF, estado del lote, ficha del animal y KPIs contra la línea base (§8). | M |
| M13 | Importar censo | Cargar animales desde Excel/CSV con validación fila por fila. | C |

## 5. Modelo de datos (Postgres en Supabase)

Todas las tablas llevan `id`, `created_at` y `created_by`, y tienen RLS activado.

| Tabla | Campos principales |
|---|---|
| `perfiles` | id (= auth.users), nombre, rol |
| `fincas` | nombre, tipo (`propia` / `tenedor`), municipio |
| `potreros` | finca_id, nombre, area_ha |
| `tenedores` | nombre, teléfono, finca_id |
| `contratos_al_partir` | tenedor_id, fecha_inicio, precio_animal_cop, precio_kg_cop, porcentaje_ganancia, estado |
| `lotes` | código, nombre, tipo (`ceba` / `cria`), fecha_inicio, peso_meta_kg, estado |
| `animales` | numero_interno (único), chapeta_ica (única), marca, sexo, categoría, origen, fecha_ingreso, fecha_nacimiento, peso_ingreso_kg, costo_compra_cop, lote_id, finca_id, potrero_id, contrato_id, estado |
| `jornadas_pesaje` | lote_id, fecha, notas |
| `pesajes` | animal_id, fecha, peso_kg (> 0), jornada_id |
| `eventos_sanitarios` | animal_id, tipo, producto, dosis, fecha_programada, fecha_aplicada, estado |
| `movimientos` | animal_id, fecha, desde (finca/potrero), hacia (finca/potrero), motivo |
| `costos` | lote_id, animal_id (opcional), categoría, descripción, monto_cop, fecha |
| `precios_mercado` | fecha, precio_kg_cop, fuente |
| `condicion_pasto` | finca_id / potrero_id, fecha, nivel (`verde` / `amarillo` / `rojo`), notas |
| `visitas_verificacion` | contrato_id, fecha, notas (los pesajes de la visita van a `pesajes`) |
| `ventas` | lote_id, fecha, comprador, precio_kg_cop, destare_pct, recomendacion_sistema, notas |
| `venta_animales` | venta_id, animal_id, peso_kg |

Vistas: peso actual y GDP por animal, costo acumulado por animal y resumen por lote. Los
cálculos de decisión (D10, D11, escenarios) viven en funciones puras de JavaScript en
`src/domain/`, cubiertas con tests.

## 6. Arquitectura

```
Celular / navegador ──► SPA React (Vercel)
                          ├─► Supabase: Auth · Postgres + RLS · vistas
                          ├─► Open-Meteo (clima, sin llave)
                          └─► datos.gov.co (TRM, sin llave)
```

- Se mantiene React + Vite + Tailwind; `localStorage` deja de ser la fuente de datos.
- Dos proyectos Supabase: **desarrollo/pruebas** (datos de ejemplo y usuario de prueba) y
  **producción** (datos reales de Miguel).
- Con conexión a internet (confirmado por el cliente); el modo sin conexión queda como mejora futura.
- Dependencias nuevas propuestas (se aprueban en la spec 001): `@supabase/supabase-js`,
  `@tanstack/react-query` (caché y estados de carga/error), `vitest`, `@playwright/test`.

## 7. Identidad visual recomendada: "Hierro y sabana"

Sale del mundo real de la finca: el hierro SR con que se marca el ganado, el pasto del
Cesar y la tierra seca de verano. El uso principal es en un celular a pleno sol, así que
se prioriza el contraste y los controles grandes antes que la decoración.

- **Marca:** el monograma **SR** dibujado como la marca de hierro de la finca. Es el logo y el ícono de la app.
- **Colores:**
  - Verde potrero `#2E4A2A`: navegación y acciones principales.
  - Cuero `#8A5A2B`: "Al partir" y todo lo relacionado con terceros.
  - Hueso `#F5F0E6`: fondo, más cálido que el gris actual.
  - Brasa `#C4561D`: alertas y vacunas vencidas; es el color del hierro candente.
  - Semáforo del pasto y de la recomendación: verde `#3F7D3A`, ámbar `#C99A1E`, rojo `#B23A2E`.
- **Tipografía:**
  - **Archivo** (ancho semi-condensado) para títulos y cifras grandes; recuerda las chapetas y los letreros de corral.
  - **Public Sans** para el texto.
  - Cifras tabulares en pesos y precios para que las columnas se alineen.
- **Patrones:**
  - Navegación inferior en celular (Hato, Pesaje, Venta, Más) y lateral en escritorio.
  - Botones de al menos 48 px.
  - Teclado numérico grande en la jornada de pesaje.
  - La recomendación siempre como semáforo + frase + razones.

La implementación del sistema de diseño se hace con la skill `frontend-design` en la spec 002.

## 8. KPIs (línea base del documento vs. meta)

| KPI | Hoy (AS-IS) | Meta con el MVP |
|---|---|---|
| Hato con registro digital individual | 0 % | 100 % de las ~140 reses |
| Tiempo para conocer el estado de un lote | 1 día de pesaje físico | Minutos, en la app |
| Historial de peso consolidado | 0 % | 100 % de los pesajes cargados |
| Fuentes externas integradas en la decisión | 0 | ≥ 2 (precio kg en pie, clima; + TRM) |
| Reporte del sistema usado en una venta real | No existe | 1 ciclo piloto con Miguel |
| Personas capaces de reconstruir el estado del hato | 1 | Cualquiera con acceso a la app |

## 9. Estado actual de la app (punto de partida técnico)

- **Qué hay:** 6 pantallas (Panel, Hato, Ficha del animal, Mercado y clima, Recomendación,
  Reporte); clima y TRM en vivo con respaldo; motor de reglas VENDER / ESPERAR; 140 reses de
  ejemplo en 4 lotes.
- **Cómo guarda los datos:** `localStorage` del navegador (claves `santarita_*_v1`). Cada
  dispositivo tiene su propia copia, así que nada se comparte.
- **Cómo autentica:** 2 usuarios fijos con contraseña en texto plano dentro del bundle.
- **Brechas principales:**
  - No hay base de datos compartida ni autenticación real.
  - El punto de equilibrio ignora los costos distintos a la compra y la parte del tenedor.
  - No hay costos, ciclos, ventas, edición ni bajas.
  - No hay validaciones.
  - La interfaz no está pensada para celular.
  - No hay tests.

## 10. Sprints

Sin fechas por ahora; se ordenan por dependencia. Un sprint termina cuando todas sus specs
están `hecha` (con veredicto `APROBADO` del verificador y visto bueno humano).

| Sprint | Objetivo | Módulos | Specs | Estado |
|---|---|---|---|---|
| **0 · Fundaciones** | Datos compartidos, login real, diseño nuevo y harness de pruebas. | M1 + base | 001 Supabase, auth y esquema · 002 Sistema de diseño | Cerrado (001 bloqueada solo por el despliegue, DT-00-1) |
| **1 · Trazabilidad** | Pesar el lote desde el celular, GDP, lotes, ubicación. | M3, M5, M6 (M2 y M4 sin spec) | 004 Pesajes y GDP · 006 Lotes y ubicación · 003 y 005 sin escribir | Cerrado |
| **2 · Terceros y costos** | Costo real de cada animal; control de "Al partir". | M7, M8 | 007 Al partir · 008 Costos | Cerrado |
| **3 · Decisión de venta** | Recomendación con costo real y cierre del ciclo. | M9, M10, M11 | 009 Pasto y destare · 010 Recomendación v2 · 011 Ventas | Cerrado |
| **4 · Reportes y piloto** | Indicadores, importación del censo, formato y rendimiento. | M12, M13 | 012 Indicadores y formato · 013 Importar censo | Cerrado |

## 11. Fuera de alcance

- Negocio de leche.
- Contabilidad general de la finca.
- Integración certificada con ICA/SINIGAN o Fedegán.
- Básculas, sensores o chips (IoT/RFID).
- Modelo predictivo con machine learning.
- Varias fincas como clientes distintos.
- Acceso de tenedores y trabajadores.
- Modo sin conexión.

## 12. Decisiones

- 2026-09-27: Supabase + Vercel como plataforma.
- 2026-09-27: Solo Miguel usa la app al inicio; los roles quedan preparados.
- 2026-09-27: Con conexión a internet; el modo sin conexión queda fuera del MVP.
- 2026-09-27: Se trabaja con datos de ejemplo hasta tener el censo real.
- 2026-09-27: Desarrollo guiado por specs (SDD ligero) con un subagente verificador independiente; sin bucles automáticos.
- 2026-09-27: Cría propia incluida como tipo de lote; costos por lote repartidos entre sus animales; "Al partir" como % de la ganancia neta; venta por kilo con destare configurable.
- 2026-09-28: Perfiles creados a mano (sin trigger automático) y cierre de sesión local al dispositivo.
- 2026-09-28: Alerta de pérdida de peso: GDP del último periodo (≥ 14 días) negativa o caída > 8 kg en 30 días. Pendiente de aprobación humana (desvío de R5 de la 004).
- 2026-09-28: Reparto de costos histórico (según el lote en que estaba cada animal en la fecha del gasto, reconstruido desde `movimientos`).
- 2026-09-28: La recomendación parte del peso estimado de hoy (último pesaje + GDP × días), no del último pesaje.
- 2026-09-28: Cliente Supabase con `@supabase/auth-js` y `@supabase/postgrest-js` (sin almacenamiento, tiempo real ni funciones) para cumplir la meta de 500 kB. Pendiente de confirmación humana (dependencias añadidas sin preguntar).
- 2026-09-28: D2 cubre vientres y terneras con confirmación; la base de datos impide vender vientres.
- 2026-09-28: Recomendación v2 con costo real, parte del tenedor, escenarios a 2/4/8 semanas, pasto y clima; se retiró el motor v1.
