import { supabase } from './supabase';

// Spec 017 · fotos de los animales. Este módulo se carga solo cuando se usa (import dinámico),
// así el paquete inicial no crece (R5). Habla directo con la API de Storage con el token de la
// sesión: las políticas del bucket `fotos-animales` solo dejan entrar a miembros (R3).
const BUCKET = 'fotos-animales';
const LADO_MAXIMO = 1280; // R2
const CALIDAD = 0.82;
const MAXIMO_BYTES = 1024 * 1024;

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

// R2: reduce la foto en el dispositivo (lado máximo 1.280 px) y la guarda en WebP, o en JPEG si el
// navegador no sabe hacer WebP. Si aun así pasa de 1 MB, baja la calidad hasta que quepa.
export async function reducirImagen(archivo) {
  if (!archivo?.type?.startsWith('image/')) throw new Error('El archivo no es una foto. Elige una imagen JPG, PNG o WebP.');
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se pudo leer la foto. Prueba con otra imagen (JPG o PNG).');
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(imagen, 0, 0, ancho, alto);
  imagen.close?.();

  let tipo = 'image/webp';
  let calidad = CALIDAD;
  let blob = await aBlob(canvas, tipo, calidad);
  if (!blob || blob.type !== 'image/webp') {
    tipo = 'image/jpeg';
    blob = await aBlob(canvas, tipo, calidad);
  }
  while (blob && blob.size > MAXIMO_BYTES && calidad > 0.4) {
    calidad -= 0.1;
    blob = await aBlob(canvas, tipo, calidad);
  }
  if (!blob || blob.size > MAXIMO_BYTES) throw new Error('La foto quedó muy pesada aun reducida. Prueba con otra.');
  return { blob, tipo, ancho, alto };
}

// Sube la foto reducida y devuelve su ruta en el bucket. Un nombre nuevo cada vez evita que el
// navegador muestre la foto vieja desde su caché.
export async function subirFoto(animalId, { blob, tipo }) {
  const ruta = `${animalId}/${Date.now()}.${tipo === 'image/webp' ? 'webp' : 'jpg'}`;
  const res = await fetch(`${base()}/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: await cabeceras({ 'Content-Type': tipo, 'x-upsert': 'false' }),
    body: blob,
  });
  if (!res.ok) throw new Error(res.status === 413 ? 'La foto pesa más de 1 MB.' : 'No se pudo subir la foto. Revisa la conexión e inténtalo otra vez.');
  return ruta;
}

export async function borrarFoto(ruta) {
  const res = await fetch(`${base()}/object/${BUCKET}`, {
    method: 'DELETE',
    headers: await cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [ruta] }),
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
