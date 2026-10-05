import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAddAnimal, useEditarAnimal, useContratosVigentes, useHato, useCambiarFoto } from '../data/hato';
import { useFotos } from '../data/fotos';
import Button from './ui/Button';
import Modal from './ui/Modal';
import CampoPesos from './ui/CampoPesos';
import CampoFoto from './CampoFoto';
import { Field, Input, Select, FormError } from './ui/Field';
import {
  CATEGORIAS_BOVINO,
  CATEGORIAS_EQUINO,
  MESES,
  RAZAS_BOVINO,
  RAZAS_EQUINO,
  cuentaCompra,
  esVientre,
  mesAnioDesdeNacimiento,
  nacimientoDesdeMesAnio,
  pidePesoObjetivo,
  problemaNacimiento,
  sugerirNombre,
} from '../domain/animales';
import { vientresHaciaCeba } from '../domain/lotes';
import { pesoActual as pesoActualDe } from '../domain/breakeven';
import { formatCOP } from '../domain/breakeven';
import { formatKg, hoyISO, numeroParaCampo } from '../utils/format';
import { mensajeNombre, numeroAPesos, pesosANumero } from '../utils/validar';
import { mensajeError } from '../lib/errores';

const leerKg = (t) => Number(String(t).replace(',', '.'));
const pesoValido = (n) => n > 0 && n < 1500;

// Specs 016, 023 y 024 · registrar o editar un animal (bovino o caballo).
// - 023 · R1: "Nombre" con número sugerido (Luna-042). 016 · R4: dueño escrito o de la lista.
// - 023 · R2: raza de la lista o escrita. 023 · R3: nacimiento por mes y año ("Mes desconocido").
// - 023 · R4/R5: peso inicial con fecha de ingreso, peso actual (igual al inicial si entró hoy) y
//   objetivo opcional (los vientres no lo llevan). 023 · R7: al editar no se cambian el lote, el
//   peso inicial ni la fecha de ingreso.
// - 023 · R6: compra por kilo o por animal, con los dos valores y la cuenta a la vista.
// - 024 · R1/R5/R6: foto cuadrada; se sube después de guardar el animal.
export default function AnimalForm({ especie = 'bovino', animal = null, lotes = [], duenos = [], onClose, onGuardado }) {
  const editando = Boolean(animal);
  const esCaballo = (animal?.especie ?? especie) === 'equino';
  const CATEGORIAS = esCaballo ? CATEGORIAS_EQUINO : CATEGORIAS_BOVINO;
  const RAZAS = esCaballo ? RAZAS_EQUINO : RAZAS_BOVINO;
  const hoy = hoyISO();
  const addAnimal = useAddAnimal();
  const editar = useEditarAnimal();
  const cambiarFoto = useCambiarFoto();
  const contratos = useContratosVigentes();
  const hato = useHato();
  const fotoActual = useFotos(editando ? [animal.fotoPath] : []);
  const todos = useMemo(() => (hato.data ? [...hato.data.animales, ...hato.data.caballos] : []), [hato.data]);
  const guardando = addAnimal.isPending || editar.isPending || cambiarFoto.isPending;
  const [error, setError] = useState('');
  const [fotoNoSubio, setFotoNoSubio] = useState(null);
  const [confirmarHembra, setConfirmarHembra] = useState(false);
  const [recorte, setRecorte] = useState(null);
  const [quitarFoto, setQuitarFoto] = useState(false);
  const lotesAbiertos = lotes.filter((l) => l.estado === 'activo' || l.estado === 'listo');
  const [form, setForm] = useState(() => {
    const nacimiento = mesAnioDesdeNacimiento(animal?.fechaNacimiento, animal?.nacimientoMesConocido);
    return {
      numeroInterno: animal?.numeroInterno ?? '',
      chapetaICA: animal?.chapetaICA ?? '',
      sexo: animal?.sexo ?? 'Macho',
      categoria: animal?.categoria ?? (esCaballo ? 'caballo' : 'novillo'),
      origen: (animal?.origen ?? 'Compra').toLowerCase(),
      mesNacimiento: nacimiento.mes,
      anioNacimiento: nacimiento.anio,
      raza: animal?.raza ?? '',
      loteId: lotesAbiertos[0]?.id ?? '',
      fechaIngreso: hoy,
      pesoIngreso: '',
      pesoActual: '',
      actualTocado: false,
      pesoObjetivo: animal?.pesoObjetivo != null ? numeroParaCampo(animal.pesoObjetivo) : '',
      modoCompra: esCaballo ? 'animal' : animal && !animal.precioCompraKg ? 'animal' : 'kilo',
      precioKg: animal?.precioCompraKg ? numeroAPesos(animal.precioCompraKg) : '',
      costoCompra: animal?.costoCompra != null && !animal?.precioCompraKg ? numeroAPesos(animal.costoCompra) : '',
      dueno: animal?.dueno ?? '',
      color: animal?.color ?? '',
      esquema: 'Propio',
      contratoId: '',
    };
  });

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setConfirmarHembra(false);
  }

  // 023 · R1: sugerencia del nombre con el siguiente número de la finca.
  const sugerencia = sugerirNombre(form.numeroInterno, todos.filter((a) => a.id !== animal?.id));

  // 023 · R4/R5: el peso actual sigue al inicial hasta que se cambie; si entró hoy, es el mismo.
  const entroHoy = form.fechaIngreso === hoy;
  const pesoActualCampo = entroHoy || !form.actualTocado ? form.pesoIngreso : form.pesoActual;

  // 023 · R6: la cuenta usa el peso inicial (el guardado, al editar).
  const pesoBase = editando ? animal.pesoIngreso : leerKg(form.pesoIngreso);
  const precioKg = pesosANumero(form.precioKg);
  const total = pesosANumero(form.costoCompra);
  const cuenta = esCaballo ? null : cuentaCompra({ modo: form.modoCompra, precioKg, total, peso: pesoBase }, formatCOP);
  const totalCompra = form.modoCompra === 'kilo' ? (cuenta?.calculado ?? null) : total || null;
  const kiloCompra = form.modoCompra === 'kilo' ? precioKg || null : (cuenta?.calculado ?? null);

  function validar() {
    const problemas = [
      mensajeNombre(form.numeroInterno, 'el nombre', { maximo: 30 }),
      esCaballo ? '' : mensajeNombre(form.chapetaICA, 'la chapeta ICA', { maximo: 30 }),
      mensajeNombre(form.raza, 'la raza', { maximo: 40, opcional: true }),
      mensajeNombre(form.dueno, 'el dueño', { opcional: true }),
      mensajeNombre(form.color, 'el color', { maximo: 40, opcional: true }),
      problemaNacimiento(form.mesNacimiento, form.anioNacimiento, hoy),
    ].filter(Boolean);
    if (problemas.length) return problemas[0];
    if (!esCaballo && !editando) {
      if (!pesoValido(leerKg(form.pesoIngreso))) return 'El peso inicial debe estar entre 1 y 1.499 kg.';
      if (!form.fechaIngreso) return 'Escribe la fecha de ingreso.';
      if (form.fechaIngreso > hoy) return 'La fecha de ingreso no puede ser futura.';
      if (form.fechaIngreso < '2000-01-01') return 'Revisa la fecha de ingreso.';
      if (!pesoValido(leerKg(pesoActualCampo))) return 'El peso actual debe estar entre 1 y 1.499 kg.';
      if (!form.loteId) return 'Selecciona un lote.';
    }
    if (!esCaballo && form.pesoObjetivo !== '' && pidePesoObjetivo(form.categoria)) {
      const objetivo = leerKg(form.pesoObjetivo);
      if (!pesoValido(objetivo)) return 'El peso objetivo debe estar entre 1 y 1.499 kg (o déjalo vacío).';
      const referencia = editando ? pesoActualDe(animal) : leerKg(pesoActualCampo);
      if (referencia > 0 && objetivo <= referencia) return 'El peso objetivo debe ser mayor que el peso actual.';
    }
    if (form.esquema === 'Al partir' && !form.contratoId) return 'Selecciona el contrato "Al partir" del tenedor.';
    return null;
  }

  // 024 · R5/R6: la foto se sube con el id del animal ya guardado. Si falla, el animal queda.
  async function subirFoto(id) {
    if (!recorte && !quitarFoto) return true;
    try {
      await cambiarFoto.mutateAsync({ id, recorte: quitarFoto ? null : recorte, anterior: animal?.fotoPath ?? null });
      return true;
    } catch {
      setFotoNoSubio(id);
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (guardando) return;
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
    const comun = {
      numeroInterno: form.numeroInterno,
      chapetaICA: esCaballo ? null : form.chapetaICA,
      sexo: form.sexo,
      categoria: form.categoria,
      origen: form.origen,
      ...nacimientoDesdeMesAnio(form.mesNacimiento, form.anioNacimiento),
      raza: form.raza,
      pesoObjetivo: !esCaballo && form.pesoObjetivo !== '' && pidePesoObjetivo(form.categoria) ? leerKg(form.pesoObjetivo) : null,
      dueno: form.dueno,
      color: form.color,
      precioCompraKg: esCaballo ? null : kiloCompra,
      costoCompra: totalCompra,
    };
    try {
      let id = animal?.id;
      if (editando) {
        await editar.mutateAsync({ id, cambios: comun });
      } else {
        const contrato = contratos.data?.find((c) => c.id === form.contratoId);
        const inicial = leerKg(form.pesoIngreso);
        const actual = leerKg(pesoActualCampo);
        id = await addAnimal.mutateAsync({
          ...comun,
          especie: esCaballo ? 'equino' : 'bovino',
          fechaIngreso: esCaballo ? hoy : form.fechaIngreso,
          loteId: esCaballo ? null : form.loteId,
          pesoIngreso: esCaballo ? null : inicial,
          pesoActual: !esCaballo && !entroHoy && actual !== inicial ? actual : null,
          contratoId: !esCaballo && form.esquema === 'Al partir' ? form.contratoId : null,
          fincaId: contrato?.fincaId ?? null,
        });
      }
      if (await subirFoto(id)) (onGuardado ?? onClose)(id);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  const titulo = editando ? `Editar ${animal.numeroInterno}` : esCaballo ? 'Registrar caballo' : 'Registrar animal';

  // 024 · R6: el animal quedó guardado pero la foto no subió.
  if (fotoNoSubio) {
    return (
      <Modal
        titulo="Foto sin subir"
        onClose={() => (onGuardado ?? onClose)(fotoNoSubio)}
        pie={<Button onClick={() => (onGuardado ?? onClose)(fotoNoSubio)}>Entendido</Button>}
      >
        <p role="alert" className="text-base text-gray-800">
          El animal quedó guardado, pero la foto no subió: vuelve a intentarlo desde su ficha.
        </p>
      </Modal>
    );
  }

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
        <Field label="Nombre" required ayuda="Por ejemplo, Luna-042. Escribe el nombre y la app te sugiere el número." className="sm:col-span-2">
          <Input value={form.numeroInterno} maxLength={30} onChange={(e) => set('numeroInterno', e.target.value)} autoComplete="off" />
          {sugerencia && (
            <button
              type="button"
              onClick={() => set('numeroInterno', sugerencia)}
              className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-lg bg-brand-50 px-3 text-base font-semibold text-brand-800 hover:bg-brand-100"
            >
              <Sparkles size={18} aria-hidden="true" />
              Usar «{sugerencia}»
            </button>
          )}
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

        <fieldset className="grid grid-cols-2 gap-3 sm:col-span-2">
          <legend className="mb-1 text-base font-semibold text-gray-800">
            Nacimiento <span className="font-normal text-gray-600">(opcional)</span>
          </legend>
          <Field label="Mes">
            <Select value={form.mesNacimiento} onChange={(e) => set('mesNacimiento', e.target.value)}>
              <option value="">Mes desconocido</option>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Año">
            <Select value={form.anioNacimiento} onChange={(e) => set('anioNacimiento', e.target.value)}>
              <option value="">No se sabe</option>
              {Array.from({ length: Number(hoy.slice(0, 4)) - 1999 }, (_, i) => String(Number(hoy.slice(0, 4)) - i)).map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <Field label="Raza" ayuda="Opcional. Elige de la lista o escribe otra.">
          <Input value={form.raza} maxLength={40} list="lista-razas" onChange={(e) => set('raza', e.target.value)} autoComplete="off" />
          <datalist id="lista-razas">
            {RAZAS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Color" ayuda="Opcional">
          <Input value={form.color} maxLength={40} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field label="Dueño" ayuda="Opcional. Escribe uno nuevo o elige uno de la lista." className="sm:col-span-2">
          <Input value={form.dueno} maxLength={80} list="lista-duenos" onChange={(e) => set('dueno', e.target.value)} autoComplete="off" />
          <datalist id="lista-duenos">
            {duenos.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>

        {!esCaballo && !editando && (
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
                Primero crea un lote con el botón "Crear lote".{' '}
                <Link to="/animales" onClick={onClose} className="font-semibold underline">
                  Ir a Animales
                </Link>
              </p>
            )}
          </Field>
        )}

        {!esCaballo && (
          <fieldset className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-1 text-base font-semibold text-gray-800">Pesos</legend>
            {editando ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-base text-gray-800 sm:col-span-2">
                Peso inicial: <strong>{formatKg(animal.pesoIngreso)}</strong> · Peso actual: <strong>{formatKg(pesoActualDe(animal))}</strong>. El peso actual se
                cambia con un pesaje desde la ficha.
              </p>
            ) : (
              <>
                <Field label="Peso inicial (kg)" required>
                  <Input inputMode="decimal" value={form.pesoIngreso} onChange={(e) => set('pesoIngreso', e.target.value)} />
                </Field>
                <Field label="Fecha de ingreso" required ayuda="Cuándo llegó a la finca.">
                  <Input type="date" max={hoy} min="2000-01-01" value={form.fechaIngreso} onChange={(e) => set('fechaIngreso', e.target.value)} />
                </Field>
                <Field label="Peso actual (kg)" ayuda={entroHoy ? 'Si entró hoy, el peso actual es el inicial.' : 'Igual al inicial si no lo has vuelto a pesar.'}>
                  <Input
                    inputMode="decimal"
                    value={pesoActualCampo}
                    disabled={entroHoy}
                    onChange={(e) => setForm((f) => ({ ...f, pesoActual: e.target.value, actualTocado: true }))}
                  />
                </Field>
              </>
            )}
            {pidePesoObjetivo(form.categoria) ? (
              <Field label="Peso objetivo (kg)" ayuda="Opcional: el peso al que se quiere vender.">
                <Input inputMode="decimal" value={form.pesoObjetivo} onChange={(e) => set('pesoObjetivo', e.target.value)} />
              </Field>
            ) : (
              esVientre(form.categoria) && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">Los vientres son la "fábrica" de la finca: no se venden ni llevan peso objetivo.</p>
              )
            )}
          </fieldset>
        )}

        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="mb-1 text-base font-semibold text-gray-800">Precio de compra</legend>
          {esCaballo ? (
            <Field label="Precio del animal" ayuda="Opcional si es cría propia.">
              <CampoPesos value={form.costoCompra} onChange={(v) => set('costoCompra', v)} />
            </Field>
          ) : (
            <>
              <div className="flex gap-2" role="radiogroup" aria-label="Cómo se compró">
                {[
                  ['kilo', 'Compré por kilo'],
                  ['animal', 'Compré por animal'],
                ].map(([valor, label]) => (
                  <label
                    key={valor}
                    className={`relative flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-base font-semibold ${form.modoCompra === valor ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-borde-control bg-white text-gray-700'}`}
                  >
                    <input type="radio" name="modoCompra" value={valor} checked={form.modoCompra === valor} onChange={() => set('modoCompra', valor)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Precio por kilo">
                  {form.modoCompra === 'kilo' ? (
                    <CampoPesos value={form.precioKg} onChange={(v) => set('precioKg', v)} />
                  ) : (
                    <ValorCalculado valor={kiloCompra} />
                  )}
                </Field>
                <Field label="Precio por animal" ayuda="Opcional si es cría propia.">
                  {form.modoCompra === 'animal' ? (
                    <CampoPesos value={form.costoCompra} onChange={(v) => set('costoCompra', v)} />
                  ) : (
                    <ValorCalculado valor={totalCompra} />
                  )}
                </Field>
              </div>
              <p data-testid="cuenta-compra" className={`rounded-lg px-3 py-2 text-base ${cuenta?.cuenta ? 'bg-brand-50 font-semibold text-brand-900' : 'bg-gray-50 text-gray-700'}`}>
                {cuenta?.cuenta ?? cuenta?.falta}
              </p>
            </>
          )}
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-base font-semibold text-gray-800">
            Foto <span className="font-normal text-gray-600">(opcional)</span>
          </legend>
          <CampoFoto
            recorte={recorte}
            urlActual={quitarFoto ? null : fotoActual.data?.get(animal?.fotoPath)}
            nombre={form.numeroInterno}
            deshabilitado={guardando}
            onRecorte={(r) => {
              setRecorte(r);
              setQuitarFoto(false);
            }}
            onQuitar={
              recorte || (animal?.fotoPath && !quitarFoto)
                ? () => {
                    if (recorte) URL.revokeObjectURL(recorte.vista);
                    setRecorte(null);
                    if (animal?.fotoPath) setQuitarFoto(true);
                  }
                : undefined
            }
          />
        </fieldset>

        {editando ? (
          <Field label="Origen">
            <Select value={form.origen} onChange={(e) => set('origen', e.target.value)}>
              <option value="compra">Compra</option>
              <option value="nacimiento">Nacimiento</option>
            </Select>
          </Field>
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

// 023 · R6: el valor que la app calcula, al lado del que se escribe.
function ValorCalculado({ valor }) {
  return (
    <output className="flex min-h-12 items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-base font-semibold text-gray-900">
      {valor ? `$${formatCOP(valor)}` : '—'}
    </output>
  );
}
