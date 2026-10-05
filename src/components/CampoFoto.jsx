import { lazy, Suspense, useState } from 'react';
import { Camera, ImageOff, Images } from 'lucide-react';
import Button from './ui/Button';
import BotonArchivo from './BotonArchivo';
import { FormError } from './ui/Field';

const RecortadorFoto = lazy(() => import('./RecortadorFoto'));

// Spec 024 · R1–R3: recuadro de foto con "Tomar foto" y "Elegir de la galería". Abre la foto, la
// deja cuadrar y entrega el recorte (`{ grande, mini, vista }`) a quien la sube.
// `urlActual` es la foto ya guardada (al editar). "Quitar foto" aparece solo si llega `onQuitar`.
// `sinVista` oculta el recuadro (la ficha ya muestra la foto en grande).
export default function CampoFoto({ recorte, urlActual, nombre, onRecorte, onQuitar, deshabilitado = false, sinVista = false }) {
  const [imagen, setImagen] = useState(null);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState('');
  const vista = recorte?.vista ?? urlActual;

  async function abrir(archivo) {
    setError('');
    setAbriendo(true);
    try {
      const { abrirImagen } = await import('../lib/fotos');
      setImagen(await abrirImagen(archivo));
    } catch (err) {
      setError(err.message || 'No se pudo abrir la foto.');
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {sinVista ? null : vista ? (
          <img src={vista} alt={nombre ? `Foto de ${nombre}` : 'Foto del animal'} className="size-32 shrink-0 rounded-xl object-cover shadow-sm" />
        ) : (
          <div className="flex size-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600">
            <Camera size={28} aria-hidden="true" />
            Sin foto
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <BotonArchivo camara icono={Camera} variante="secundario" onArchivo={abrir} disabled={deshabilitado || abriendo}>
            {abriendo ? 'Abriendo la foto…' : 'Tomar foto'}
          </BotonArchivo>
          <BotonArchivo icono={Images} variante="secundario" onArchivo={abrir} disabled={deshabilitado || abriendo}>
            Elegir de la galería
          </BotonArchivo>
          {onQuitar && (
            <Button variante="fantasma" icono={ImageOff} onClick={onQuitar} disabled={deshabilitado}>
              Quitar foto
            </Button>
          )}
        </div>
      </div>
      <FormError>{error}</FormError>
      {imagen && (
        <Suspense fallback={null}>
          <RecortadorFoto
            imagen={imagen}
            onCancelar={() => setImagen(null)}
            onOtra={(archivo) => {
              setImagen(null);
              abrir(archivo);
            }}
            onListo={(nuevo) => {
              setImagen(null);
              if (recorte?.vista) URL.revokeObjectURL(recorte.vista);
              onRecorte(nuevo);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
