// Arma el video corto de la demo (entrega/presentacion/video/demo.mp4) a partir de material real:
// la foto del caso 2, los textos que el bot respondió (tomados de campo.bitacora_jornadas y del
// borrador cc76f86f), la captura del flujo en n8n y la evidencia de la base.
// El chat se recrea en HTML con esos textos; no es una grabación de pantalla.
// Requiere Google Chrome y ffmpeg instalados.  Uso: node taller-harness/scripts/generar-video-demo.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'entrega', 'presentacion');
const tmp = join(raiz, 'video', '_cuadros');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const img = (f) => pathToFileURL(join(raiz, 'img', f)).href;
const burbuja = (quien, texto, tipo = '') => `<div class="b ${tipo}"><span>${quien}</span>${texto}</div>`;
const botones = `<div class="btns"><i>✅ Confirmar</i><i>🗑️ Confirmar sin los dudosos</i><i>❌ Rechazar</i></div>`;
const bot = '@santarita_campo_prueba_bot';

const cuadros = [
  ['La foto de la báscula llega al grupo de Telegram', 'Caso 2: 8 filas del LOTE-2026-A. La 209 no existe en el censo.', `<img class="foto" src="${img('planilla-caso2.jpg')}">`],
  ['El bot lee, valida y pregunta en segundos', 'Claude lee la foto, las reglas fijas la revisan y otro agente redacta la duda.',
    `<div class="chat">${burbuja(bot, 'Pesaje del LOTE-2026-A del 27/10/2026: 7 animales quedaron bien (0201 a 0207).<br>Queda 1 pendiente: la 0209 (268 kg) no está en el censo. ¿Es un animal nuevo o el número está mal escrito?<br>La hoja no trae a la 208, por si te ayuda a revisar.')}${botones}</div>`],
  ['Quien envía no puede confirmar su propio reporte', 'La regla vive en la base de datos, no en el prompt.',
    `<div class="chat">${burbuja('Andrés', 'pulsa ✅ Confirmar', 'yo')}${burbuja(bot, 'No se cargó nada: Quien envió el reporte no puede confirmarlo; lo confirma otra persona autorizada', 'no')}</div>`],
  ['Con un dudoso pendiente, tampoco se carga', 'La base exige resolver o descartar la 0209 antes de tocar la app.',
    `<div class="chat">${burbuja('Compañero', 'pulsa ✅ Confirmar', 'yo')}${burbuja(bot, 'No se cargó nada: Quedan 1 dudosos sin resolver: corrígelos con un mensaje nuevo o descártalos', 'no')}</div>`],
  ['Otra persona confirma y descarta la duda', 'Queda en la bitácora quién confirmó y qué se descartó.',
    `<div class="chat">${burbuja('Compañero', 'pulsa 🗑️ Confirmar sin los dudosos', 'yo')}${burbuja(bot, 'Listo: se cargaron 7 registros en la app.', 'ok')}</div>`],
  ['Todo corre en un solo flujo de n8n', 'Un disparador recibe fotos y botones; 38 nodos.', `<img class="ancho" src="${img('n8n-flujo.jpg')}">`],
  ['Los 7 pesajes llegan a la app con su origen', 'Cada registro dice de qué borrador vino. La 0209 no entró.', `<img class="recorte" src="${img('evidencia-base.png')}">`],
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap');
*{box-sizing:border-box;margin:0}
body{width:1280px;height:720px;background:#fff;color:#16261c;font-family:Archivo,'Segoe UI',sans-serif;display:grid;grid-template-columns:470px 1fr;gap:48px;padding:64px 64px 56px}
.paso{font-size:18px;color:#2f7a4a;font-weight:600;margin-bottom:18px;font-variant-numeric:tabular-nums}
h1{font-size:44px;line-height:1.08;font-weight:760;font-stretch:88%;letter-spacing:-.01em}
p{font-size:21px;line-height:1.4;color:#4a5a50;margin-top:20px}
.pie{position:absolute;left:64px;bottom:26px;font-size:14px;color:#8a978e}
.der{display:flex;align-items:center;justify-content:center;min-width:0}
.foto{max-height:600px;max-width:100%;border-radius:4px;box-shadow:0 1px 0 #e3e7e2}
.ancho{width:100%;border:1px solid #e3e7e2;border-radius:6px}
.recorte{width:100%;height:600px;object-fit:cover;object-position:0 100%;border:1px solid #e3e7e2;border-radius:6px}
.chat{width:100%;background:#eef3ee;border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:14px}
.b{background:#fff;border-radius:12px;padding:14px 18px;font-size:20px;line-height:1.4;max-width:92%;border-left:5px solid #c7d3ca}
.b span{display:block;font-size:14px;font-weight:650;color:#2f7a4a;margin-bottom:4px}
.b.yo{align-self:flex-end;background:#dff0e2;border-left:0;font-style:italic;color:#3b4b40}
.b.no{border-left-color:#b23a2a}.b.ok{border-left-color:#2f7a4a}
.btns{display:grid;gap:6px;max-width:92%}.btns i{font-style:normal;background:#fff;border-radius:8px;padding:9px;text-align:center;font-size:17px;color:#2f7a4a;font-weight:600}
`;

cuadros.forEach(([titulo, sub, derecha], i) => {
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><div><div class="paso">Paso ${i + 1} de ${cuadros.length}</div><h1>${titulo}</h1><p>${sub}</p></div><div class="der">${derecha}</div><div class="pie">Prueba en vivo del 30 de octubre de 2026 · datos simulados · chat recreado con los mensajes reales del bot</div>`;
  const f = join(tmp, `c${i}.html`);
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=1280,720', `--screenshot=${join(tmp, `c${i}.png`)}`, pathToFileURL(f).href], { stdio: 'ignore' });
});

// Cada cuadro dura 4,5 s con un fundido de 0,5 s entre cuadros.
const dur = 4.5, fundido = 0.5;
const entradas = cuadros.flatMap((_, i) => ['-loop', '1', '-t', String(dur), '-i', join(tmp, `c${i}.png`)]);
let filtro = '', prev = '[0:v]', t = dur - fundido;
for (let i = 1; i < cuadros.length; i++) {
  const sal = i === cuadros.length - 1 ? '[v]' : `[x${i}]`;
  filtro += `${prev}[${i}:v]xfade=transition=fade:duration=${fundido}:offset=${t.toFixed(2)}${sal};`;
  prev = sal; t += dur - fundido;
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtro.slice(0, -1), '-map', '[v]', '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', join(raiz, 'video', 'demo.mp4')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, 'c1.png'), join(raiz, 'video', 'demo-portada.jpg')]);
rmSync(tmp, { recursive: true, force: true });
console.log('Video listo: entrega/presentacion/video/demo.mp4');
