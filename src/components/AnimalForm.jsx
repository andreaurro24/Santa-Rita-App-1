import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddAnimal, useEditarAnimal, useContratosVigentes } from '../data/hato';
import Button from './ui/Button';
import Modal from './ui/Modal';
import CampoPesos from './ui/CampoPesos';
import { Field, Input, Select, FormError } from './ui/Field';
import { CATEGORIAS_BOVINO, CATEGORIAS_EQUINO, esVientre, kiloDesdeTotal, pidePesoObjetivo, totalDesdeKilo } from '../domain/animales';
import { vientresHaciaCeba } from '../domain/lotes';
import { formatCOP } from '../domain/breakeven';
import { hoyISO, numeroParaCampo } from '../utils/format';
import { mensajeNombre, numeroAPesos, pesosANumero } from '../utils/validar';
import { mensajeError } from '../lib/errores';

const leerKg = (t) => Number(String(t).replace(',', '.'));

// Spec 016 · registrar o editar un animal (bovino o caballo).
// - R1: en edición no se cambian el lote, el peso ni la fecha de ingreso (son el primer pesaje).
// - R4: dueño escrito o elegido de los que ya existen (datalist).
// - R5/R6: tres tipos de vientre; el peso objetivo es opcional y no se pide a los vientres.
// - R7: compra por kilo o por animal, con la equivalencia a la vista.
// - R8: caballos sin chapeta, lote ni pesaje.
export default function AnimalForm({ especie = 'bovino', animal = null, lotes = [], duenos = [], onClose, onGuardado }) {
  const editando = Boolean(animal);
  const esCaballo = (animal?.especie ?? especie) === 'equino';
  const CATEGORIAS = esCaballo ? CATEGORIAS_EQUINO : CATEGORIAS_BOVINO;
  const addAnimal = useAddAnimal();
  const editar = useEditarAnimal();
  const contratos = useContratosVigentes();
  const guardando = addAnimal.isPending || editar.isPending;
  const [error, setError] = useState('');
  const [confirmarHembra, setConfirmarHembra] = useState(false);
  const lotesAbiertos = lotes.filter((l) => l.estado === 'activo' || l.estado === 'listo');
  const [form, setForm] = useState(() => ({
    numeroInterno: animal?.numeroInterno ?? '',
    chapetaICA: animal?.chapetaICA ?? '',
    sexo: animal?.sexo ?? 'Macho',
    categoria: animal?.categoria ?? (esCaballo ? 'caballo' : 'novillo'),
    origen: (animal?.origen ?? 'Compra').toLowerCase(),
    fechaNacimiento: animal?.fechaNacimiento ?? '',
    loteId: lotesAbiertos[0]?.id ?? '',
    pesoIngreso: '',
    pesoObjetivo: animal?.pesoObjetivo != null ? numeroParaCampo(animal.pesoObjetivo) : '',
    modoCompra: animal?.precioCompraKg ? 'kilo' : 'animal',
    precioKg: animal?.precioCompraKg ? numeroAPesos(animal.precioCompraKg) : '',
    costoCompra: animal?.costoCompra != null ? numeroAPesos(animal.costoCompra) : '',
    dueno: animal?.dueno ?? '',
    color: animal?.color ?? '',
    esquema: 'Propio',
    contratoId: '',
  }));

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setConfirmarHembra(false);
  }

  // R7: peso para la equivalencia: el de ingreso al registrar; el de ingreso guardado al editar.
  const pesoBase = editando ? animal.pesoIngreso : leerKg(form.pesoIngreso);
  const precioKg = pesosANumero(form.precioKg);
  const total = pesosANumero(form.costoCompra);
  const totalCalculado = form.modoCompra === 'kilo' ? totalDesdeKilo(precioKg, pesoBase) : null;
  const kiloCalculado = form.modoCompra === 'animal' ? kiloDesdeTotal(total, pesoBase) : null;

  function validar() {
    const etiquetaNumero = esCaballo ? 'el número o nombre' : 'el número interno';
    const problemas = [
      mensajeNombre(form.numeroInterno, etiquetaNumero, { maximo: 30 }),
      esCaballo ? '' : mensajeNombre(form.chapetaICA, 'la chapeta ICA', { maximo: 30 }),
      mensajeNombre(form.dueno, 'el dueño', { opcional: true }),
      mensajeNombre(form.color, 'el color', { maximo: 40, opcional: true }),
    ].filter(Boolean);
    if (problemas.length) return problemas[0];
    if (!esCaballo && !editando) {
      const ingreso = leerKg(form.pesoIngreso);
      if (!(ingreso > 0 && ingreso < 1500)) return 'El peso de ingreso debe estar entre 1 y 1.499 kg.';
      if (!form.loteId) return 'Selecciona un lote.';
    }
    if (!esCaballo && form.pesoObjetivo !== '' && pidePesoObjetivo(form.categoria)) {
      const objetivo = leerKg(form.pesoObjetivo);
      if (!(objetivo > 0 && objetivo < 1500)) return 'El peso objetivo debe estar entre 1 y 1.499 kg (o déjalo vacío).';
      if (pesoBase > 0 && objetivo <= pesoBase) return 'El peso objetivo debe ser mayor que el peso de ingreso.';
    }
    if (form.fechaNacimiento && form.fechaNacimiento > hoyISO()) return 'La fecha de nacimiento no puede ser futura.';
    if (form.esquema === 'Al partir' && !form.contratoId) return 'Selecciona el contrato "Al partir" del tenedor.';
    return null;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setError(problema);
    if (!esCaballo && !editando) {
      // R8 / D2 (spec 006): una hembra reproductiva en un lote de ceba pide confirmación.
      const loteElegido = lotes.find((l) => l.id === form.loteId);
      if (vientresHaciaCeba([{ categoria: form.categoria }], loteElegido).length && !confirmarHembra) {
        setError('');
        return setConfirmarHembra(true);
      }
    }
    setError('');
    const compra =
      form.modoCompra === 'kilo' && !esCaballo
        ? { precioCompraKg: precioKg, costoCompra: totalCalculado }
        : { precioCompraKg: null, costoCompra: total };
    const comun = {
      numeroInterno: form.numeroInterno,
      chapetaICA: esCaballo ? null : form.chapetaICA,
      sexo: form.sexo,
      categoria: form.categoria,
      origen: form.origen,
      fechaNacimiento: form.fechaNacimiento || null,
      pesoObjetivo: !esCaballo && form.pesoObjetivo !== '' && pidePesoObjetivo(form.categoria) ? leerKg(form.pesoObjetivo) : null,
      dueno: form.dueno,
      color: form.color,
      ...compra,
    };
    const alTerminar = { onSuccess: (id) => (onGuardado ?? onClose)(id), onError: (err) => setError(mensajeError(err)) };
    if (editando) return editar.mutate({ id: animal.id, cambios: comun }, alTerminar);
    const contrato = contratos.data?.find((c) => c.id === form.contratoId);
    addAnimal.mutate(
      {
        ...comun,
        especie: esCaballo ? 'equino' : 'bovino',
        fechaIngreso: hoyISO(),
        loteId: esCaballo ? null : form.loteId,
        pesoIngreso: esCaballo ? null : leerKg(form.pesoIngreso),
        contratoId: !esCaballo && form.esquema === 'Al partir' ? form.contratoId : null,
        fincaId: contrato?.fincaId ?? null,
      },
      alTerminar,
    );
  }

  const titulo = editando ? `Editar ${animal.numeroInterno}` : esCaballo ? 'Registrar caballo' : 'Registrar animal';

  return (
    <Modal
      titulo={titulo}
      onClose={onClose}
      pie={
        <>
          <Button variante="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-animal" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-animal" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={esCaballo ? 'Número o nombre' : 'Número interno'} required>
          <Input value={form.numeroInterno} maxLength={30} onChange={(e) => set('numeroInterno', e.target.value)} />
        </Field>
        {!esCaballo && (
          <Field label="Chapeta ICA / Sinigán" required>
            <Input value={form.chapetaICA} maxLength={30} onChange={(e) => set('chapetaICA', e.target.value)} autoCapitalize="characters" />
          </Field>
        )}
        <Field label="Sexo">
          <Select value={form.sexo} onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value, categoria: CATEGORIAS[e.target.value][0].valor }))}>
            <option>Macho</option>
            <option>Hembra</option>
          </Select>
        </Field>
        <Field label="Categoría">
          <Select value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
            {CATEGORIAS[form.sexo].map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {esCaballo && (
          <Field label="Color" ayuda="Opcional">
            <Input value={form.color} maxLength={40} onChange={(e) => set('color', e.target.value)} />
          </Field>
        )}
        <Field label="Dueño" ayuda="Opcional. Escribe uno nuevo o elige uno de la lista." className={esCaballo ? '' : 'sm:col-span-2'}>
          <Input value={form.dueno} maxLength={80} list="lista-duenos" onChange={(e) => set('dueno', e.target.value)} autoComplete="off" />
          <datalist id="lista-duenos">
            {duenos.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        {!esCaballo && !editando && (
          <>
            <Field label="Lote" required className="sm:col-span-2">
              {lotesAbiertos.length ? (
                <Select value={form.loteId} onChange={(e) => set('loteId', e.target.value)}>
                  {lotesAbiertos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900">
                  Primero crea un lote.{' '}
                  <Link to="/lotes" className="font-semibold underline">
                    Ir a Lotes
                  </Link>
                </p>
              )}
            </Field>
            <Field label="Peso de ingreso (kg)" required>
              <Input inputMode="decimal" value={form.pesoIngreso} onChange={(e) => set('pesoIngreso', e.target.value)} />
            </Field>
          </>
        )}
        {!esCaballo && pidePesoObjetivo(form.categoria) && (
          <Field label="Peso objetivo (kg)" ayuda="Opcional: el peso pactado para vender.">
            <Input inputMode="decimal" value={form.pesoObjetivo} onChange={(e) => set('pesoObjetivo', e.target.value)} />
          </Field>
        )}
        {!esCaballo && esVientre(form.categoria) && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">Los vientres son la "fábrica" de la finca: no se venden ni llevan peso objetivo.</p>
        )}

        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="mb-1 text-base font-semibold text-gray-800">Precio de compra</legend>
          {!esCaballo && (
            <div className="flex gap-2" role="radiogroup" aria-label="Cómo se compró">
              {[
                ['kilo', 'Por kilo'],
                ['animal', 'Por animal'],
              ].map(([valor, label]) => (
                <label key={valor} className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-base font-semibold ${form.modoCompra === valor ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-borde-control bg-white text-gray-700'}`}>
                  <input type="radio" name="modoCompra" value={valor} checked={form.modoCompra === valor} onChange={() => set('modoCompra', valor)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          )}
          {form.modoCompra === 'kilo' && !esCaballo ? (
            <Field label="Precio por kilo">
              <CampoPesos value={form.precioKg} onChange={(v) => set('precioKg', v)} />
              <span className="mt-1 block text-sm text-gray-700">
                {totalCalculado ? `Total aproximado: $${formatCOP(totalCalculado)}` : 'Escribe el peso de ingreso y el precio para ver el total.'}
              </span>
            </Field>
          ) : (
            <Field label={esCaballo ? 'Precio del animal' : 'Precio del animal (total)'} ayuda="Opcional si es cría propia.">
              <CampoPesos value={form.costoCompra} onChange={(v) => set('costoCompra', v)} />
              {!esCaballo && kiloCalculado && <span className="mt-1 block text-sm text-gray-700">Sale a unos ${formatCOP(kiloCalculado)} el kilo.</span>}
            </Field>
          )}
        </fieldset>

        {editando ? (
          <>
            <Field label="Origen">
              <Select value={form.origen} onChange={(e) => set('origen', e.target.value)}>
                <option value="compra">Compra</option>
                <option value="nacimiento">Nacimiento</option>
              </Select>
            </Field>
            <Field label="Fecha de nacimiento" ayuda="Opcional">
              <Input type="date" max={hoyISO()} value={form.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} />
            </Field>
          </>
        ) : (
          !esCaballo && (
            <>
              <Field label="Esquema">
                <Select value={form.esquema} onChange={(e) => set('esquema', e.target.value)}>
                  <option>Propio</option>
                  <option>Al partir</option>
                </Select>
              </Field>
              {form.esquema === 'Al partir' && (
                <Field label='Contrato "Al partir"' required className="sm:col-span-2">
                  <Select value={form.contratoId} onChange={(e) => set('contratoId', e.target.value)}>
                    <option value="">{contratos.isPending ? 'Cargando contratos…' : 'Selecciona el tenedor'}</option>
                    {contratos.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.etiqueta}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </>
          )
        )}

        {confirmarHembra && (
          <p role="alert" className="rounded-lg bg-alerta-50 px-3 py-2 text-sm text-alerta-900 sm:col-span-2">
            Vas a registrar una hembra en un lote de ceba, que es para vender. Las hembras con potencial reproductivo no se venden. Toca Guardar otra vez solo si es
            correcto.
          </p>
        )}
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  );
}
