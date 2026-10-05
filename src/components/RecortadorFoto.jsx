import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCw, ZoomIn, ZoomOut, ImagePlus } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import BotonArchivo from './BotonArchivo';
import { FormError } from './ui/Field';
import { centrar, hacerZoom, limitarZoom, mover, ZOOM_MAXIMO } from '../domain/recorte';

const MARGEN = 20; // franja oscurecida alrededor del cuadro (R2)

function ladoSegunPantalla() {
  if (typeof window === 'undefined') return 280;
  return window.matchMedia('(min-width: 768px)').matches ? 360 : Math.min(280, window.innerWidth - 2 * MARGEN - 48);
}

// Spec 024 · R2: recortador cuadrado sin dependencias. Se arrastra con el dedo o el mouse, se
// acerca con el deslizador, con dos dedos (pellizco) o con la rueda, y se puede girar 90°.
// Se carga solo cuando se abre (React.lazy en CampoFoto): no pesa en el paquete inicial (R7).
export default function RecortadorFoto({ imagen: imagenInicial, onListo, onOtra, onCancelar }) {
  const [lado] = useState(ladoSegunPantalla);
  const total = lado + 2 * MARGEN;
  const [imagen, setImagen] = useState(imagenInicial);
  const [estado, setEstado] = useState(() => centrar(imagenInicial.width, imagenInicial.height, lado));
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const canvas = useRef(null);
  const punteros = useRef(new Map());
  const estadoRef = useRef(estado);
  useLayoutEffect(() => {
    estadoRef.current = estado;
  });

  // Dibuja la foto completa, oscurece lo que queda fuera del cuadro y marca el borde.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(total * dpr);
    c.height = Math.round(total * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'black'; // fondo neutro de visor de fotos
    ctx.fillRect(0, 0, total, total);
    const e = (lado / Math.min(imagen.width, imagen.height)) * estado.zoom;
    ctx.drawImage(imagen, MARGEN + estado.x, MARGEN + estado.y, imagen.width * e, imagen.height * e);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, total, total);
    ctx.rect(MARGEN, MARGEN, lado, lado);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(MARGEN, MARGEN, lado, lado);
  }, [imagen, estado, lado, total]);

  const aplicar = (fn) => setEstado((e) => fn(e));
  const zoomA = (z, px, py) => aplicar((e) => hacerZoom(e, z, imagen.width, imagen.height, lado, px, py));

  function punto(ev) {
    const r = canvas.current.getBoundingClientRect();
    return { x: ev.clientX - r.left - MARGEN, y: ev.clientY - r.top - MARGEN };
  }

  function abajo(ev) {
    canvas.current.setPointerCapture?.(ev.pointerId);
    punteros.current.set(ev.pointerId, punto(ev));
  }

  function moverPuntero(ev) {
    const mapa = punteros.current;
    if (!mapa.has(ev.pointerId)) return;
    const antes = [...mapa.values()];
    mapa.set(ev.pointerId, punto(ev));
    const ahora = [...mapa.values()];
    if (ahora.length === 1) {
      const dx = ahora[0].x - antes[0].x;
      const dy = ahora[0].y - antes[0].y;
      aplicar((e) => mover(e, dx, dy, imagen.width, imagen.height, lado));
    } else if (ahora.length >= 2) {
      // Pellizco: la distancia entre los dos dedos cambia el zoom alrededor del punto medio.
      const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const d0 = dist(antes);
      if (d0 < 1) return;
      const medio = { x: (ahora[0].x + ahora[1].x) / 2, y: (ahora[0].y + ahora[1].y) / 2 };
      zoomA(estadoRef.current.zoom * (dist(ahora) / d0), medio.x, medio.y);
    }
  }

  function arriba(ev) {
    punteros.current.delete(ev.pointerId);
  }

  function rueda(ev) {
    const p = punto(ev);
    zoomA(estadoRef.current.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), p.x, p.y);
  }

  // La rueda necesita un listener no pasivo para no desplazar la página.
  useEffect(() => {
    const c = canvas.current;
    const fn = (ev) => {
      ev.preventDefault();
      rueda(ev);
    };
    c?.addEventListener('wheel', fn, { passive: false });
    return () => c?.removeEventListener('wheel', fn);
  });

  async function girarFoto() {
    const { girar } = await import('../lib/fotos');
    const nueva = girar(imagen);
    setImagen(nueva);
    setEstado(centrar(nueva.width, nueva.height, lado));
  }

  async function listo() {
    setProcesando(true);
    setError('');
    try {
      const { recortar } = await import('../lib/fotos');
      onListo(await recortar(imagen, estado, lado));
    } catch (err) {
      setError(err.message || 'No se pudo preparar la foto.');
      setProcesando(false);
    }
  }

  return (
    <Modal
      titulo="Cuadrar la foto"
      onClose={onCancelar}
      pie={
        <>
          <Button variante="fantasma" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={listo} disabled={procesando}>
            {procesando ? 'Preparando…' : 'Listo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-base text-gray-700">Mueve la foto con el dedo para que el animal quede dentro del cuadro. Acerca con dos dedos o con la barra.</p>
        <canvas
          ref={canvas}
          role="img"
          aria-label="Vista del recorte de la foto"
          data-testid="recortador"
          style={{ width: total, height: total, touchAction: 'none' }}
          className="mx-auto block cursor-grab rounded-xl active:cursor-grabbing"
          onPointerDown={abajo}
          onPointerMove={moverPuntero}
          onPointerUp={arriba}
          onPointerCancel={arriba}
        />
        <label className="flex min-h-12 items-center gap-3">
          <ZoomOut size={20} className="shrink-0 text-gray-600" aria-hidden="true" />
          <span className="sr-only">Acercar</span>
          <input
            type="range"
            min="1"
            max={ZOOM_MAXIMO}
            step="0.01"
            value={estado.zoom}
            onChange={(e) => zoomA(limitarZoom(e.target.value))}
            className="h-12 w-full accent-brand-700"
          />
          <ZoomIn size={20} className="shrink-0 text-gray-600" aria-hidden="true" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button variante="secundario" icono={RotateCw} onClick={girarFoto} disabled={procesando}>
            Girar
          </Button>
          <BotonArchivo icono={ImagePlus} variante="secundario" onArchivo={onOtra} disabled={procesando}>
            Otra foto
          </BotonArchivo>
        </div>
        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}
