# Spec 002 — Sistema de diseño "Hierro y sabana" y layout adaptable

- Estado: borrador
- Sprint: 0
- Módulos del plan: transversal (identidad visual de `docs/plan.md` §7)

## Contexto
Miguel Ángel usará la app sobre todo en el celular, a veces a pleno sol en el corral. La
interfaz actual tiene un menú lateral fijo de 256 px que no cabe en un teléfono, estilos
repetidos página por página y una estética genérica. Esta spec crea el sistema de diseño
aprobado ("Hierro y sabana") y lo aplica a todas las pantallas existentes, sin cambiar lo
que hacen.

## Requisitos (EARS)
- R1 — El sistema deberá definir colores, tipografía, radios y espaciados como tokens en
  `src/index.css` (`@theme`), y ningún componente deberá usar colores hexadecimales sueltos.
- R2 — El sistema deberá usar Archivo para títulos y cifras grandes, y Public Sans para el
  texto, con cifras tabulares en pesos y precios.
- R3 — Mientras el ancho de pantalla sea menor a 768 px, el sistema deberá mostrar una
  navegación inferior fija con Inicio, Hato, Venta y Más, y ningún contenido deberá producir
  scroll horizontal de la página.
- R4 — Mientras el ancho sea de 768 px o más, el sistema deberá mostrar la navegación lateral.
- R5 — El sistema deberá dar a todo control interactivo un área táctil de al menos 48×48 px
  en celular.
- R6 — El sistema deberá cumplir contraste WCAG AA (4.5:1 en texto normal) en todos los pares
  de color de texto y fondo del sistema.
- R7 — El sistema deberá mostrar la marca "SR" como marca de hierro en el login, la
  navegación y el favicon.
- R8 — El sistema deberá ofrecer componentes compartidos (`Button`, `Card`, `Field`, `Input`,
  `Select`, `Badge`, `Stat`, `Semaforo`, `EmptyState`, `ErrorState`, `Skeleton`, `Modal` /
  hoja inferior en celular) y todas las páginas deberán usarlos.
- R9 — Cuando se abra un formulario en celular, el sistema deberá mostrarlo como hoja
  inferior a pantalla completa con el botón de guardar siempre visible.
- R10 — Las tablas del hato deberán verse como lista de tarjetas en celular y como tabla en
  escritorio.
- R11 — El reporte imprimible deberá seguir imprimiéndose sin navegación ni botones.

## Fuera de alcance
- Nuevas funciones o pantallas (solo se rediseña lo que existe).
- Modo oscuro (la app se usa de día; se evalúa después).

## Diseño
- **Tokens:**
  - Colores: verde potrero `#2E4A2A` (primario), cuero `#8A5A2B`, hueso `#F5F0E6` (fondo),
    brasa `#C4561D` (alertas).
  - Semáforo: verde `#3F7D3A`, ámbar `#C99A1E`, rojo `#B23A2E`.
  - Además, escalas de tinta para texto y superficies.
- **Fuentes:** Google Fonts (Archivo con eje de ancho, Public Sans) con `<link>` en
  `index.html` y `display=swap`. No se añade ninguna dependencia npm.
- **Componentes:** `src/components/ui/*.jsx`. `Layout.jsx` se divide en `SideNav` y `BottomNav`.
- **Marca:** `src/components/MarcaSR.jsx`, un SVG del hierro "SR" reutilizado en
  `public/favicon.svg`.
- **Archivos que se tocan:** `src/index.css`, `index.html`, `public/favicon.svg`,
  `src/components/**`, `src/pages/**` (solo la presentación).
- **Decisión clave:** usar componentes propios sobre Tailwind en lugar de una librería de UI
  (shadcn, MUI), para no sumar dependencias y controlar al detalle la identidad visual y los
  tamaños táctiles.

### Plan de diseño (revisado con la skill `frontend-design`)
- **Ajuste de color:** la skill señala dos patrones típicos de diseño generado: el fondo crema
  cercano a `#F4F1EA` y el acento terracota. Por eso el fondo "hueso" pasa a **cal** `#F1F2EC`,
  el blanco verdoso de la cal de los corrales, y la "brasa" se oscurece a `#B4441B`, el hierro al
  rojo. Se mantiene la identidad aprobada.
- **Tokens:**
  - potrero `#2E4A2A` (navegación y acción principal)
  - cuero `#8A5A2B` ("Al partir")
  - cal `#F1F2EC` (fondo)
  - brasa `#B4441B` (alertas)
  - chapeta `#F2C230` (el amarillo de las chapetas ICA)
  - tinta `#1C2419` y tinta suave `#55604F` (texto)
  - línea `#D9DDD2` (bordes)
- **El elemento memorable (uno solo):** el número interno se muestra como una **chapeta**, es
  decir, la etiqueta amarilla de oreja con su perforación y el número en Archivo negrita. Es lo
  que Miguel reconoce en el corral. Aparece en el hato, en la ficha y en la jornada de pesaje.
  Todo lo demás es sobrio: superficies blancas, bordes finos y sin degradados.
- **Layout:**
  - Celular: barra superior con la marca SR y el título, contenido a una columna y navegación
    inferior (Inicio, Hato, Venta, Más). "Más" abre una hoja con el resto de secciones.
  - Escritorio: barra lateral color potrero con la marca de hierro.
  - Texto alineado a la izquierda; cifras alineadas a la derecha en tablas.
- **Tono del texto:** verbos en infinitivo o imperativo ("Registrar peso"), frases en
  minúscula inicial, sin etiquetas en mayúsculas sostenidas.

## Tareas
- [ ] T1 Tokens y fuentes en `index.css` / `index.html` — verifica: `npm run build`
- [ ] T2 Marca SR (componente + favicon) — verifica: revisión visual
- [ ] T3 Componentes `ui/` — verifica: `npm run lint`
- [ ] T4 Layout adaptable (SideNav / BottomNav) — verifica: 375 px y 1280 px sin scroll horizontal
- [ ] T5 Rediseño de Login y Panel — verifica: revisión visual en ambos anchos
- [ ] T6 Rediseño de Hato (tarjetas / tabla) y Ficha del animal — verifica: E2E de pesaje sigue pasando
- [ ] T7 Rediseño de Mercado, Recomendación y Reporte (+ impresión) — verifica: vista previa de impresión
- [ ] T8 Correr el `verificador` sobre esta spec

## Criterios de aceptación para el verificador
- A 375×812: todas las rutas sin scroll horizontal, la navegación inferior visible y cada
  control con al menos 48 px de alto.
- A 1280×800: navegación lateral y tablas completas.
- Los E2E de la spec 001 siguen pasando.
- `grep` de `#[0-9a-fA-F]{6}` en `src/components` y `src/pages` no da resultados.

## Aprobación
- [x] Aprobada por Andrés Sánchez en el chat el 2026-09-27 ("Hierro y sabana": "me gusta"; luego aprobó todas las specs y planes de sprint)
