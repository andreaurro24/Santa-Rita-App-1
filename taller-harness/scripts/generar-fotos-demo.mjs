// Genera las fotos de la demo para la presentación (entrega/presentacion/img/demo-*.png).
// Recrea el chat de Telegram con los textos exactos que respondió el bot en la prueba en vivo del
// 30 de octubre de 2026 (tomados de campo.bitacora_jornadas y del borrador cc76f86f).
// No son capturas de pantalla. Requiere Google Chrome.  Uso: node taller-harness/scripts/generar-fotos-demo.mjs
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'entrega', 'presentacion', 'img');
const tmp = mkdtempSync(join(tmpdir(), 'fotos-demo-'));
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const bot = '@santarita_campo_prueba_bot';
const b = (quien, texto, tipo = '') => `<div class="b ${tipo}"><span>${quien}</span>${texto}</div>`;

const fotos = {
  'demo-respuesta': `${b('Andrés', '📷 Foto de la planilla del LOTE-2026-A', 'yo')}
    ${b(bot, 'Pesaje del LOTE-2026-A del 27/10/2026: 7 animales quedaron bien (0201 a 0207).<br>Queda 1 pendiente: la 0209 (268 kg) no está en el censo. ¿Es un animal nuevo o el número está mal escrito?<br>La hoja no trae a la 208, por si te ayuda a revisar.')}
    <div class="btns"><i>✅ Confirmar</i><i>🗑️ Confirmar sin los dudosos</i><i>❌ Rechazar</i></div>`,
  'demo-bloqueos': `${b('Andrés', 'pulsa ✅ Confirmar', 'yo')}
    ${b(bot, 'No se cargó nada: Quien envió el reporte no puede confirmarlo; lo confirma otra persona autorizada', 'no')}
    ${b('Compañero', 'pulsa ✅ Confirmar', 'yo')}
    ${b(bot, 'No se cargó nada: Quedan 1 dudosos sin resolver: corrígelos con un mensaje nuevo o descártalos', 'no')}`,
  'demo-cargado': `${b('Compañero', 'pulsa 🗑️ Confirmar sin los dudosos', 'yo')}
    ${b(bot, 'Listo: se cargaron 7 registros en la app.', 'ok')}
    <div class="nota">En la base: 7 pesajes nuevos del 27/10, cada uno con el borrador de origen. La 0209 quedó descartada en la bitácora.</div>`,
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap');
*{box-sizing:border-box;margin:0}
body{width:460px;height:520px;background:#eef3ee;font-family:Archivo,'Segoe UI',sans-serif;color:#16261c;padding:18px;display:flex;flex-direction:column;gap:10px;justify-content:center}
.b{background:#fff;border-radius:14px;padding:16px 20px;font-size:19px;line-height:1.32;max-width:96%;border-left:5px solid #c7d3ca}
.b span{display:block;font-size:13px;font-weight:650;color:#2f7a4a;margin-bottom:5px}
.b.yo{align-self:flex-end;background:#dff0e2;border-left:0;font-style:italic;color:#3b4b40;font-size:17px}
.b.no{border-left-color:#b23a2a}.b.ok{border-left-color:#2f7a4a;font-size:22px;font-weight:600}
.btns{display:grid;gap:8px;max-width:94%}.btns i{font-style:normal;background:#fff;border-radius:10px;padding:7px;text-align:center;font-size:16px;color:#2f7a4a;font-weight:600}
.nota{font-size:17px;line-height:1.4;color:#4a5a50;margin-top:10px;max-width:94%}
`;

for (const [nombre, cuerpo] of Object.entries(fotos)) {
  const f = join(tmp, `${nombre}.html`);
  writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>${css}</style>${cuerpo}`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=460,520', `--screenshot=${join(destino, `${nombre}.png`)}`, pathToFileURL(f).href], { stdio: 'ignore' });
}
rmSync(tmp, { recursive: true, force: true });
console.log('Fotos listas en entrega/presentacion/img/demo-*.png');
