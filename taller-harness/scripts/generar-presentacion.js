// Presentación de 5 minutos del taller Harness Engineering (Finca Santa Rita).
const pptxgen = require('pptxgenjs');
const path = require('path');
const { applyTheme } = require(process.env.SKILL_DIR + '/scripts/apply_theme.js');

const SALIDA = process.argv[2];
const THEME = {
  name: 'Santa Rita Potrero',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '1F2A1F', lt1: 'FFFFFF', dk2: '2C5F2D', lt2: 'EEF3E6',
    accent1: '2C5F2D', accent2: '97BC62', accent3: 'C8742B', accent4: '5B7553',
    accent5: 'A3B18A', accent6: '7A4E2D', hlink: '2C5F2D', folHlink: '5B7553',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Arnés de reportes de campo · Finca Santa Rita';
pres.author = 'Andrea Urdaneta, Juan Andrés Lacouture, Andrés Sánchez';
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: 'PORTADA_OSCURA',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.9, w: 8.8, h: 1.95, fontSize: 40, bold: true, color: C.background1, valign: 'bottom', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 3.0, w: 8.8, h: 1.4, fontSize: 18, color: C.background2, valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENIDO',
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9.0, h: 0.8, fontSize: 30, bold: true, color: C.text2, valign: 'middle' }, text: '' } },
    { text: { text: 'Taller Harness Engineering · Finca Santa Rita', options: { x: 0.5, y: 5.2, w: 6, h: 0.3, fontSize: 10, color: C.accent4 } } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 10, color: C.accent4 },
});

const tarjeta = (s, x, y, w, h, fill, nombre) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: nombre });
const insignia = (s, x, y, texto, fill, color) => {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.5, h: 0.5, fill: { color: fill }, line: { color: fill } });
  s.addText(texto, { x, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
};

// 1. Portada
pres.addSection({ title: 'Tema' });
let s = pres.addSlide({ masterName: 'PORTADA_OSCURA', sectionTitle: 'Tema' });
s.addText('Del cuaderno de la báscula a la app, sin datos inventados', { placeholder: 'title' });
s.addText([
  { text: 'Arnés para un agente que convierte reportes de campo en registros', options: { breakLine: true } },
  { text: 'Andrea Urdaneta · Juan Andrés Lacouture · Andrés Sánchez', options: { fontSize: 14 } },
], { placeholder: 'body' });
s.addNotes('Somos el equipo de Finca Santa Rita. Diseñamos el arnés de un agente que toma lo que el administrador manda por Telegram (la foto de la planilla de la báscula o un mensaje) y lo convierte en registros de pesaje y sanidad para la app. En cinco minutos: el tema, los tres capítulos donde más invertimos y lo que aprendimos.');

// 2. Tema central
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Tema' });
s.addText('Un trabajo repetitivo con un error muy caro', { placeholder: 'title' });
const pasos = [['1', 'Foto o mensaje', 'El administrador manda la planilla por Telegram'], ['2', 'Borrador', 'El agente transcribe y el validador revisa contra el censo'], ['3', 'Una persona confirma', 'Miguel confirma, corrige o rechaza'], ['4', 'App', 'Solo lo confirmado se carga']];
pasos.forEach(([n, t, d], i) => {
  const y = 1.3 + i * 0.95;
  insignia(s, 0.5, y + 0.1, n, C.accent1, C.background1);
  s.addText(t, { x: 1.15, y, w: 4.2, h: 0.4, fontSize: 16, bold: true, color: C.text1, margin: 0, isTextBox: true });
  s.addText(d, { x: 1.15, y: y + 0.38, w: 4.2, h: 0.4, fontSize: 13, color: C.accent4, margin: 0, isTextBox: true });
});
tarjeta(s, 5.9, 1.3, 3.6, 3.55, C.background2, 'Peor error');
s.addText('Peor error', { x: 6.15, y: 1.45, w: 3.1, h: 0.4, fontSize: 14, bold: true, color: C.accent3, margin: 0, isTextBox: true });
s.addText('10 %', { x: 6.15, y: 1.9, w: 3.1, h: 1.0, fontSize: 60, bold: true, color: C.text2, margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
s.addText('del valor perdido en la última venta, unos $1.200 por kilo', { x: 6.15, y: 2.95, w: 3.1, h: 0.7, fontSize: 13, color: C.text1, margin: 0, isTextBox: true });
s.addText('Un peso en la res equivocada o inventado daña la GDP y la recomendación de venta.', { x: 6.15, y: 3.7, w: 3.1, h: 1.0, fontSize: 13, italic: true, color: C.accent4, margin: 0, isTextBox: true });
s.addNotes('El trabajo: unas 140 reses cada mes, más los eventos de sanidad. El peor error es asignar un peso a la res equivocada o inventarlo, porque daña la ganancia diaria de peso y con ella la recomendación de venta. Ya les pasó: en la última venta perdieron cerca del 10 % del valor. Definimos cinco criterios de terminado que se revisan sin opinar: el animal existe, la fecha es válida, los cambios de más del 15 % se marcan, no hay repetidos y nada se inventa.');

// 3. Dónde invertimos
pres.addSection({ title: 'Capítulos' });
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Capítulos' });
s.addText('Invertimos donde está el riesgo', { placeholder: 'title' });
s.addChart(pres.charts.BAR, [{ name: 'Inversión', labels: ['Orquestación', 'Herramientas y skills', 'Memoria', 'Mejora continua', 'Contexto', 'Verificación', 'Guardarraíles'], values: [2, 2, 3, 3, 5, 5, 5] }], {
  x: 0.4, y: 1.2, w: 5.6, h: 3.85, barDir: 'bar',
  chartColors: ['2C5F2D'], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: '1F2A1F', dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt',
  catAxisLabelColor: '1F2A1F', catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valAxisMaxVal: 6,
  valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
  showTitle: true, title: 'Inversión relativa por capítulo (1 a 5)', titleFontSize: 12, titleColor: '5B7553', titleFontFace: '+mn-lt',
});
tarjeta(s, 6.3, 1.3, 3.2, 3.55, C.background2, 'Por qué');
s.addText([
  { text: 'El peor error es un dato malo que llega a la app.', options: { bold: true, breakLine: true } },
  { text: ' ', options: { breakLine: true, fontSize: 8 } },
  { text: 'Por eso el peso está en lo que lo frena (guardarraíles), lo que lo detecta (verificación) y lo que el modelo no sabe (contexto).', options: { breakLine: true } },
  { text: ' ', options: { breakLine: true, fontSize: 8 } },
  { text: 'La orquestación se quedó simple: extractor, validador, revisor, persona y cargador.' },
], { x: 6.5, y: 1.45, w: 2.8, h: 3.3, fontSize: 13, color: C.text1, margin: 0, valign: 'top', isTextBox: true });
s.addNotes('Diseñamos los siete capítulos, pero no les dimos el mismo peso. Invertimos más en guardarraíles, verificación y contexto, porque el riesgo es un dato malo que llega a la app. La orquestación la dejamos simple: un extractor con IA, un validador con reglas fijas, un revisor con IA solo cuando hay dudas, una persona que confirma y un cargador fijo.');

// 4. Guardarraíles
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Capítulos' });
s.addText('Guardarraíles: lo grave no vive en el prompt', { placeholder: 'title' });
tarjeta(s, 0.5, 1.3, 4.3, 3.55, C.background2, 'Guías');
s.addText('Guías (texto para el modelo)', { x: 0.75, y: 1.45, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: C.accent4, margin: 0, isTextBox: true });
s.addText([
  { text: 'No inventar: lo que no se lee va a ilegibles', options: { bullet: true, breakLine: true } },
  { text: 'La fecha es la de la planilla, no la del mensaje', options: { bullet: true, breakLine: true } },
  { text: 'No hablar de ventas, precios ni "Al partir"', options: { bullet: true } },
], { x: 0.75, y: 1.95, w: 3.8, h: 2.7, fontSize: 14, color: C.text1, paraSpaceAfter: 8, valign: 'top', isTextBox: true });
tarjeta(s, 5.2, 1.3, 4.3, 3.55, C.text2, 'Guardias');
s.addText('Guardias (fuera del modelo)', { x: 5.45, y: 1.45, w: 3.8, h: 0.4, fontSize: 16, bold: true, color: C.accent2, margin: 0, isTextBox: true });
s.addText([
  { text: 'El rol del flujo no puede escribir en pesajes', options: { bullet: true, breakLine: true } },
  { text: 'Solo carga un borrador confirmado por un usuario autorizado', options: { bullet: true, breakLine: true } },
  { text: 'Quien envía no se confirma a sí mismo', options: { bullet: true, breakLine: true } },
  { text: 'Máximo 2 reintentos y luego una persona', options: { bullet: true } },
], { x: 5.45, y: 1.95, w: 3.8, h: 2.2, fontSize: 14, color: C.background1, paraSpaceAfter: 6, valign: 'top', isTextBox: true });
s.addText('9 de 9 bloqueos probados en SQL', { x: 5.45, y: 4.25, w: 3.8, h: 0.45, fontSize: 14, bold: true, italic: true, color: C.accent2, margin: 0, isTextBox: true });
s.addNotes('Aquí está la diferencia entre guía y guardia. Las guías son texto: el modelo podría no cumplirlas. Lo grave lo pusimos fuera del modelo, en permisos de Postgres. El flujo no puede escribir en las tablas de pesajes ni de sanidad. La única puerta es una función que exige un borrador confirmado por una persona autorizada, que no puede ser la misma que lo envió. Lo probamos en una base de datos y los nueve intentos de saltárselo quedaron bloqueados.');

// 5. Contexto + verificación
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Capítulos' });
s.addText('Lo que la IA sola no podía saber', { placeholder: 'title' });
const casos = [['V1', '0209', 'no está en el censo', 'La IA sola la dejó "lista para cargar"'], ['V5', '0303', 'subió 24 % en un mes', 'Sin el último peso, nadie lo notó'], ['V10', 'Lote 2026-B', 'son 6 animales', 'La IA sola no supo a quién vacunar']];
casos.forEach(([regla, dato, hecho, sin], i) => {
  const x = 0.5 + i * 3.05;
  tarjeta(s, x, 1.3, 2.85, 3.0, C.background2, 'Caso ' + regla);
  insignia(s, x + 0.2, 1.45, regla, C.accent3, C.background1);
  s.addText(dato, { x: x + 0.2, y: 2.1, w: 2.45, h: 0.6, fontSize: 24, bold: true, color: C.text2, margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
  s.addText(hecho, { x: x + 0.2, y: 2.7, w: 2.45, h: 0.45, fontSize: 15, color: C.text1, margin: 0, isTextBox: true });
  s.addText(sin, { x: x + 0.2, y: 3.3, w: 2.45, h: 0.8, fontSize: 13, italic: true, color: C.accent4, margin: 0, valign: 'top', isTextBox: true });
});
s.addText('Lo que se puede revisar con una regla lo revisa un programa (V1 a V10 y 24 pruebas); la IA solo juzga lo ambiguo.', { x: 0.5, y: 4.45, w: 9.0, h: 0.55, fontSize: 14, bold: true, color: C.text2, margin: 0, isTextBox: true });
s.addNotes('La sorpresa de la línea base: sin arnés, el modelo no inventó ningún peso. Falló por lo que no podía saber: que la 0209 no existe, que la 0303 pesaba 187 kilos hace un mes, y qué animales forman el lote 2026-B. El contexto le da el censo y el último peso, y un validador con reglas fijas hace la revisión. La IA solo juzga lo ambiguo, como si un número borroso es 348 o 368.');

// 6. Resultados
pres.addSection({ title: 'Resultados' });
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Resultados' });
s.addText('De 3 a 6 de 6, sin un solo peso inventado', { placeholder: 'title' });
s.addChart(pres.charts.BAR, [{ name: 'Casos base correctos', labels: ['Sin arnés', 'Con arnés', 'Con arnés mejorado'], values: [3, 6, 6] }], {
  x: 0.4, y: 1.2, w: 5.4, h: 3.85, barDir: 'col',
  chartColors: ['A3B18A', '2C5F2D', '2C5F2D'], invertedColors: ['A3B18A'], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: '1F2A1F', dataLabelFontSize: 14, dataLabelFontFace: '+mn-lt',
  catAxisLabelColor: '1F2A1F', catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valAxisMaxVal: 7, valAxisMinVal: 0,
  valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
  showTitle: true, title: 'Casos base correctos (de 6)', titleFontSize: 12, titleColor: '5B7553', titleFontFace: '+mn-lt',
});
const stats = [['9 de 9', 'casos correctos con el arnés mejorado (incluye 3 extra)'], ['0', 'errores graves en las tres etapas'], ['Sí', 'una sesión nueva retomó los 9 reportes sin explicación']];
stats.forEach(([n, t], i) => {
  const y = 1.3 + i * 1.2;
  s.addText(n, { x: 6.1, y, w: 3.4, h: 0.6, fontSize: 32, bold: true, color: C.text2, margin: 0, isTextBox: true, fontFace: THEME.headFontFace });
  s.addText(t, { x: 6.1, y: y + 0.58, w: 3.4, h: 0.5, fontSize: 13, color: C.text1, margin: 0, isTextBox: true });
});
s.addNotes('Los resultados con los mismos casos: sin arnés, tres de seis correctos; con arnés, seis de seis. Agregamos casos más difíciles para buscar errores reales. La primera versión falló en dos, y después de dos ciclos de mejora quedaron nueve de nueve. Errores graves: cero en las tres etapas. Y una sesión nueva retomó el trabajo solo con la bitácora.');

// 7. Ciclos y aprendizaje
s = pres.addSlide({ masterName: 'PORTADA_OSCURA', sectionTitle: 'Resultados' });
s.addText('El arnés no hizo más inteligente al modelo: hizo que sus errores no lleguen a la app', { placeholder: 'title', fontSize: 30 });
s.addText([
  { text: 'Ciclo 1: la regla de repetidos ahora distingue el tipo de evento', options: { bullet: true, breakLine: true } },
  { text: 'Ciclo 2: el censo encuentra el animal por chapeta, no el modelo', options: { bullet: true, breakLine: true } },
  { text: 'Las mejores mejoras salieron de errores reales', options: { bullet: true } },
], { placeholder: 'body', fontSize: 15, paraSpaceAfter: 6 });
s.addNotes('Dos ciclos de mejora con errores reales. Primero, el validador tomaba por repetido a un animal con dos tratamientos distintos el mismo día: era un sensor mal calibrado y lo corregimos. Segundo, una planilla anotada por chapeta trababa el flujo: faltaba una guía y un sensor, y ahora el censo encuentra el animal en vez del modelo. Lo que aprendimos: el arnés no vuelve más inteligente al modelo; hace que sus errores no lleguen a la app. Lo que sigue necesitando a una persona es saber la verdad de un dato dudoso.');

(async () => {
  await pres.writeFile({ fileName: SALIDA });
  await applyTheme(SALIDA, THEME);
  console.log('ok', path.resolve(SALIDA));
})();
