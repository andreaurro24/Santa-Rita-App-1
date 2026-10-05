import { supabase } from './supabase';
import { areaFuente, rutaMiniatura } from '../domain/recorte';

// Specs 017 y 024 · fotos de los animales. Este módulo se carga solo cuando se usa (import
// dinámico), así el paquete inicial no crece. Habla directo con la API de Storage con el token de
// la sesión: las políticas del bucket `fotos-animales` solo dejan entrar a miembros.
const BUCKET = 'fotos-animales';
const MAXIMO_ENTRADA = 30 * 1024 * 1024; // 024 · R3
const LADO_TRABAJO = 2400; // la foto abierta se reduce a esto para que el recortador vaya fluido
// 024 · R4: foto de la ficha y miniatura para listas.
const SALIDAS = {
  grande: { lado: 800, calidad: 0.82, maximo: 300 * 1024 },
  mini: { lado: 200, calidad: 0.75, maximo: 40 * 1024 },
};

const base = () => `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1`;

async function cabeceras(extra = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw Object.assign(new Error('Inicia sesión de nuevo para subir la foto.'), { code: '42501' });
  return { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, ...extra };
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}

// 024 · R3: abre cualquier foto que el navegador sepa leer (respeta la orientación de la cámara) y
// la reduce a un tamaño de trabajo. Devuelve un canvas.
export async function abrirImagen(archivo) {
  if (!archivo) throw new Error('No se eligió ninguna foto.');
  if (archivo.type && !archivo.type.startsWith('image/')) throw new Error('El archivo no es una foto. Elige una imagen.');
  if (archivo.size > MAXIMO_ENTRADA) throw new Error('La foto pesa más de 30 MB. Elige otra o tómala con menos resolución.');
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Este celular no pudo abrir esa foto. Prueba con otra, o tómala de nuevo con la cámara.');
  }
  const escala = Math.min(1, LADO_TRABAJO / Math.max(imagen.width, imagen.height));
  const c = lienzo(Math.round(imagen.width * escala), Math.round(imagen.height * escala));
  c.getContext('2d').drawImage(imagen, 0, 0, c.width, c.height);
  imagen.close?.();
  return c;
}

// "Girar": devuelve la imagen rotada 90° a la derecha.
export function girar(imagen) {
  const c = lienzo(imagen.height, imagen.width);
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(imagen, 0, 0);
  return c;
}

async function exportar(imagen, area, { lado, calidad, maximo }) {
  const c = lienzo(lado, lado);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, area.sx, area.sy, area.sLado, area.sLado, 0, 0, lado, lado);
  let tipo = 'image/webp';
  let q = calidad;
  let blob = await aBlob(c, tipo, q);
  if (!blob || blob.type !== 'image/webp') {
    tipo = 'image/jpeg';
    blob = await aBlob(c, tipo, q);
  }
  while (blob && blob.size > maximo && q > 0.35) {
    q -= 0.1;
    blob = await aBlob(c, tipo, q);
  }
  if (!blob) throw new Error('No se pudo preparar la foto. Prueba con otra.');
  return { blob, tipo };
}

// 024 · R4: del recorte salen la foto de 800 px y la miniatura de 200 px.
export async function recortar(imagen, estado, ladoCuadro) {
  const area = areaFuente(estado, imagen.width, imagen.height, ladoCuadro);
  const grande = await exportar(imagen, area, SALIDAS.grande);
  const mini = await exportar(imagen, area, SALIDAS.mini);
  return { grande, mini, vista: URL.createObjectURL(grande.blob) };
}

async function subir(ruta, { blob, tipo }) {
  const res = await fetch(`${base()}/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: await cabeceras({ 'Content-Type': tipo, 'x-upsert': 'false' }),
    body: blob,
  });
  if (!res.ok) throw new Error(res.status === 413 ? 'La foto pesa más de 1 MB.' : 'No se pudo subir la foto. Revisa la conexión e inténtalo otra vez.');
}

// 024 · R5: sube la foto y su miniatura; si una falla, borra la otra. Un nombre nuevo cada vez evita
// que el navegador muestre la foto vieja desde su caché. Devuelve la ruta de la foto grande.
export async function subirFotoConMiniatura(animalId, { grande, mini }) {
  const ruta = `${animalId}/${Date.now()}.${grande.tipo === 'image/webp' ? 'webp' : 'jpg'}`;
  await subir(ruta, grande);
  try {
    // El mismo navegador produce el mismo formato para las dos, así la ruta de la miniatura se deriva.
    await subir(rutaMiniatura(ruta), mini);
  } catch (err) {
    await borrarFoto(ruta).catch(() => {});
    throw err;
  }
  return ruta;
}

// Borra la foto y su miniatura (si no existe una, el Storage simplemente no la encuentra).
export async function borrarFoto(ruta) {
  if (!ruta) return;
  const res = await fetch(`${base()}/object/${BUCKET}`, {
    method: 'DELETE',
    headers: await cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [ruta, rutaMiniatura(ruta)] }),
  });
  if (!res.ok) throw new Error('No se pudo borrar la foto anterior.');
}

// URLs firmadas (el bucket es privado) para varias fotos a la vez. Duran una hora.
export async function urlsFirmadas(rutas) {
  if (!rutas.length) return new Map();
  const res = await fetch(`${base()}/object/sign/${BUCKET}`, {
    method: 'POST',
    headers: await cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn: 3600, paths: rutas }),
  });
  if (!res.ok) throw new Error('No se pudieron cargar las fotos.');
  const lista = await res.json();
  return new Map(lista.filter((x) => x.signedURL).map((x) => [x.path, `${base()}${x.signedURL}`]));
}
