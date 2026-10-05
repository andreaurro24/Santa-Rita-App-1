import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Pencil, Trash2, Archive, BadgeDollarSign, ArrowLeft, Tag, RotateCcw } from 'lucide-react';
import { useCambiarFoto, useDarDeBaja, useEliminarAnimal, useReactivar, useVenderCaballo, useVentaCaballo } from '../data/hato';
import { useFotos } from '../data/fotos';
import AnimalForm from './AnimalForm';
import CampoFoto from './CampoFoto';
import Card from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import CampoPesos from './ui/CampoPesos';
import { Field, Input, Select, FormError } from './ui/Field';
import { esVientre, etiquetaCategoria } from '../domain/animales';
import { formatCOP } from '../domain/breakeven';
import { formatFecha, hoyISO } from '../utils/format';
import { mensajeNombre, pesosANumero } from '../utils/validar';
import { mensajeError } from '../lib/errores';

// Specs 017 y 024: foto del animal en la ficha (tomar o elegir, cuadrar, reemplazar o quitar).
export function FotoAnimal({ animal, puedeEditar }) {
  const fotos = useFotos([animal.fotoPath]);
  const cambiar = useCambiarFoto();
  const [error, setError] = useState('');
  const url = fotos.data?.get(animal.fotoPath);

  function guardar(recorte) {
    setError('');
    cambiar.mutate(
      { id: animal.id, recorte, anterior: animal.fotoPath },
      {
        onSettled: () => recorte?.vista && URL.revokeObjectURL(recorte.vista),
        onError: (err) => setError(err.message?.includes(' ') ? err.message : mensajeError(err)),
      },
    );
  }

  return (
    <div className="space-y-3">
      {animal.fotoPath ? (
        url ? (
          <img src={url} alt={`Foto de ${animal.numeroInterno}`} className="aspect-square w-full max-w-sm rounded-xl object-cover" />
        ) : (
          <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-xl bg-gray-100 text-base text-gray-600">Cargando foto…</div>
        )
      ) : (
        !puedeEditar && (
          <div className="flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white text-base text-gray-600">
            <Camera size={28} aria-hidden="true" />
            Sin foto
          </div>
        )
      )}
      {puedeEditar && (
        <div className="no-print max-w-sm">
          {cambiar.isPending ? (
            <p role="status" className="text-base text-gray-700">Guardando la foto…</p>
          ) : (
            <CampoFoto
              sinVista
              nombre={animal.numeroInterno}
              onRecorte={guardar}
              onQuitar={animal.fotoPath ? () => guardar(null) : undefined}
            />
          )}
        </div>
      )}
      <FormError>{error}</FormError>
    </div>
  );
}

// Spec 016 · R1–R3 y spec 019 · R1: acciones sobre el animal.
export function AccionesAnimal({ animal, lotes, duenos }) {
  const [abierto, setAbierto] = useState(null);
  const reactivar = useReactivar();
  const activo = animal.estado === 'Activo';
  const esCaballo = animal.especie === 'equino';
  const vendible = activo && !esCaballo && !esVientre(animal.categoria) && animal.loteId;
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variante="secundario" icono={Pencil} onClick={() => setAbierto('editar')}>
        Editar
      </Button>
      {vendible && (
        <Link
          to={`/ventas/nueva?lote=${animal.loteId}&animal=${animal.id}`}
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 text-base font-semibold text-white hover:bg-brand-800 md:min-h-11 md:text-sm"
        >
          <BadgeDollarSign size={18} aria-hidden="true" />
          Vender este animal
        </Link>
      )}
      {esCaballo && activo && (
        <Button icono={BadgeDollarSign} onClick={() => setAbierto('vender')}>
          Vender caballo
        </Button>
      )}
      {activo && (
        <Button variante="secundario" icono={Archive} onClick={() => setAbierto('baja')}>
          Dar de baja
        </Button>
      )}
      {animal.estado === 'Perdido' && (
        <Button variante="secundario" icono={RotateCcw} disabled={reactivar.isPending} onClick={() => reactivar.mutate({ id: animal.id })}>
          Apareció: reactivar
        </Button>
      )}
      {reactivar.isError && <p role="alert" className="w-full text-base text-peligro">{mensajeError(reactivar.error)}</p>}
      <Button variante="fantasma" icono={Trash2} onClick={() => setAbierto('eliminar')}>
        Eliminar
      </Button>
      {abierto === 'editar' && <AnimalForm animal={animal} lotes={lotes} duenos={duenos} onClose={() => setAbierto(null)} />}
      {abierto === 'baja' && <BajaModal animal={animal} onClose={() => setAbierto(null)} />}
      {abierto === 'eliminar' && <EliminarModal animal={animal} onClose={() => setAbierto(null)} onBaja={() => setAbierto('baja')} />}
      {abierto === 'vender' && <VenderCaballoModal animal={animal} onClose={() => setAbierto(null)} />}
    </div>
  );
}

// R3: muerte o pérdida, con fecha y motivo.
function BajaModal({ animal, onClose }) {
  const baja = useDarDeBaja();
  const [form, setForm] = useState({ estado: 'muerto', fecha: hoyISO(), motivo: '' });
  const [error, setError] = useState('');
  function guardar(e) {
    e.preventDefault();
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha no puede ser futura.');
    if (form.fecha < animal.fechaIngreso) return setError(`La fecha no puede ser anterior al ingreso (${formatFecha(animal.fechaIngreso)}).`);
    if (form.motivo.length > 200) return setError('El motivo puede tener hasta 200 caracteres.');
    baja.mutate({ id: animal.id, ...form }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }
  return (
    <Modal
      titulo={`Dar de baja a ${animal.numeroInterno}`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-baja" disabled={baja.isPending}>
            {baja.isPending ? 'Guardando…' : 'Dar de baja'}
          </Button>
        </>
      }
    >
      <form id="form-baja" onSubmit={guardar} noValidate className="space-y-4">
        <p className="text-base text-gray-700">El animal deja de contar como activo, pero se conservan su historial y sus costos.</p>
        <Field label="Motivo">
          <Select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
            <option value="muerto">Murió</option>
            <option value="perdido">Se perdió o lo robaron</option>
          </Select>
        </Field>
        <Field label="Fecha">
          <Input type="date" max={hoyISO()} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
        </Field>
        <Field label="Detalle" ayuda="Opcional, por ejemplo: picadura de culebra">
          <Input value={form.motivo} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}

// R2: eliminar solo para errores de registro; si ya está en una venta, se ofrece dar de baja.
function EliminarModal({ animal, onClose, onBaja }) {
  const eliminar = useEliminarAnimal();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  function confirmar() {
    eliminar.mutate(
      { id: animal.id, fotoPath: animal.fotoPath },
      {
        onSuccess: () => navigate(animal.especie === 'equino' ? '/animales?ver=caballos' : '/animales', { replace: true }),
        onError: (err) => {
          if (err.code === '23503') {
            setBloqueado(true);
            return setError('Este animal ya está en una venta y no se puede eliminar. Si murió o se perdió, dalo de baja.');
          }
          setError(err.code === '42501' ? 'Solo un dueño puede eliminar animales.' : mensajeError(err));
        },
      },
    );
  }
  return (
    <Modal
      titulo={`¿Eliminar ${animal.numeroInterno}?`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          {bloqueado && animal.estado === 'Activo' ? (
            <Button onClick={onBaja}>Dar de baja</Button>
          ) : (
            <Button variante="peligro" onClick={confirmar} disabled={eliminar.isPending || bloqueado}>
              {eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-base text-gray-800">
        <p>Úsalo solo si lo registraste por error. Se borran el animal, sus pesajes, su sanidad, sus gastos propios y su foto. No se puede deshacer.</p>
        <p>Si el animal murió o se perdió, mejor usa "Dar de baja": así se conserva su historial.</p>
        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}

// Spec 016 · R8: venta de un caballo por precio del animal.
function VenderCaballoModal({ animal, onClose }) {
  const vender = useVenderCaballo();
  const [form, setForm] = useState({ fecha: hoyISO(), comprador: '', precio: '', notas: '' });
  const [error, setError] = useState('');
  function guardar(e) {
    e.preventDefault();
    const problema = mensajeNombre(form.comprador, 'el comprador');
    if (problema) return setError(problema);
    const precio = pesosANumero(form.precio);
    if (!(precio > 0)) return setError('Escribe el precio de venta.');
    if (!form.fecha || form.fecha > hoyISO()) return setError('La fecha no puede ser futura.');
    if (form.fecha < animal.fechaIngreso) return setError(`La fecha no puede ser anterior al ingreso (${formatFecha(animal.fechaIngreso)}).`);
    vender.mutate({ id: animal.id, fecha: form.fecha, comprador: form.comprador, precioCop: precio, notas: form.notas }, { onSuccess: onClose, onError: (err) => setError(mensajeError(err)) });
  }
  return (
    <Modal
      titulo={`Vender ${animal.numeroInterno}`}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-vender-caballo" disabled={vender.isPending}>
            {vender.isPending ? 'Guardando…' : 'Guardar venta'}
          </Button>
        </>
      }
    >
      <form id="form-vender-caballo" onSubmit={guardar} noValidate className="space-y-4">
        <Field label="Comprador" required>
          <Input value={form.comprador} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, comprador: e.target.value }))} />
        </Field>
        <Field label="Precio de venta" required>
          <CampoPesos value={form.precio} onChange={(v) => setForm((f) => ({ ...f, precio: v }))} />
        </Field>
        <Field label="Fecha de la venta">
          <Input type="date" max={hoyISO()} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
        </Field>
        <Field label="Notas" ayuda="Opcional">
          <Input value={form.notas} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
        </Field>
        {animal.costoCompra != null && pesosANumero(form.precio) > 0 && (
          <p className="text-base text-gray-800">
            Se compró en ${formatCOP(animal.costoCompra)}: {pesosANumero(form.precio) >= animal.costoCompra ? 'ganancia' : 'pérdida'} de $
            {formatCOP(Math.abs(pesosANumero(form.precio) - animal.costoCompra))}.
          </p>
        )}
        <FormError>{error}</FormError>
      </form>
    </Modal>
  );
}

// Spec 016 · R8: ficha de un caballo (sin pesajes, lote ni recomendación).
export function FichaCaballo({ caballo, lotes, duenos, puedeEditar }) {
  const venta = useVentaCaballo(caballo.id, caballo.estado === 'Vendido');
  return (
    <div className="space-y-5">
      <Link to="/animales?ver=caballos" className="no-print inline-flex min-h-12 items-center gap-1 text-base text-gray-600 hover:text-brand-700">
        <ArrowLeft size={18} aria-hidden="true" /> Volver a los caballos
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{caballo.numeroInterno}</h1>
        <Badge tono="potrero">{etiquetaCategoria(caballo.categoria)}</Badge>
        {caballo.estado !== 'Activo' && <Badge>{caballo.estado}</Badge>}
      </div>
      {puedeEditar && <AccionesAnimal animal={caballo} lotes={lotes} duenos={duenos} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FotoAnimal animal={caballo} puedeEditar={puedeEditar} />
        <Card titulo="Datos" icono={Tag}>
          <dl className="space-y-2 text-base">
            {[
              ['Sexo', caballo.sexo],
              ['Color', caballo.color ?? '—'],
              ['Dueño', caballo.dueno ?? '—'],
              ['Fecha de ingreso', formatFecha(caballo.fechaIngreso)],
              ['Precio de compra', caballo.costoCompra != null ? `$${formatCOP(caballo.costoCompra)}` : '—'],
              ...(caballo.fechaBaja ? [['Baja', `${formatFecha(caballo.fechaBaja)}${caballo.motivoBaja ? `, ${caballo.motivoBaja}` : ''}`]] : []),
              ...(venta.data ? [['Vendido', `${formatFecha(venta.data.fecha)} a ${venta.data.comprador} por $${formatCOP(venta.data.precioCop)}`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-2 last:border-0">
                <dt className="text-gray-600">{k}</dt>
                <dd className="text-right font-medium text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
