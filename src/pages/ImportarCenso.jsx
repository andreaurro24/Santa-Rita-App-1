import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useHato, useImportarAnimales } from '../data/hato';
import { useLotes } from '../data/lotes';
import { COLUMNAS, PLANTILLA_CSV, parsearCSV, validarFilas } from '../domain/censo';
import { ConDatos } from '../components/EstadoCarga';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { FormError } from '../components/ui/Field';
import { mensajeError } from '../lib/errores';
import { hoyISO } from '../utils/format';

// Spec 013 · importar el censo desde un CSV, con vista previa y validación por fila.
export default function ImportarCenso() {
  const hato = useHato();
  const lotes = useLotes();
  return <ConDatos queries={[hato, lotes]}>{() => <ImportarContenido animales={hato.data.animales} lotes={lotes.data} />}</ConDatos>;
}

function descargarPlantilla() {
  // R5: plantilla con encabezados y una fila de ejemplo (BOM para que Excel lea las tildes).
  const url = URL.createObjectURL(new Blob(['﻿' + PLANTILLA_CSV], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-censo-santa-rita.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function ImportarContenido({ animales, lotes }) {
  const importar = useImportarAnimales();
  const [archivo, setArchivo] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState(0);
  const [final, setFinal] = useState(null);

  async function leer(file) {
    setFinal(null);
    setArchivo(file?.name ?? null);
    if (!file) return setResultados(null);
    const texto = await file.text();
    const { filas, error: errorArchivo } = parsearCSV(texto);
    if (errorArchivo) {
      setResultados(null);
      return setError(errorArchivo);
    }
    setError('');
    const existentes = {
      numeros: new Set(animales.map((a) => a.numeroInterno.toUpperCase())),
      chapetas: new Set(animales.map((a) => a.chapetaICA.toUpperCase())),
    };
    setResultados(validarFilas(filas, { hoy: hoyISO(), lotes: lotes.filter((l) => l.estado !== 'vendido' && l.estado !== 'cerrado'), existentes }));
  }

  const validas = resultados?.filter((r) => r.animal) ?? [];
  const conErrores = resultados?.filter((r) => !r.animal) ?? [];

  function importarValidas() {
    setProgreso(0);
    importar.mutate(
      { animales: validas.map((r) => r.animal), onProgreso: setProgreso },
      {
        onSuccess: (r) => {
          setFinal(r);
          setResultados(null);
          setArchivo(null);
        },
        onError: (err) => setError(mensajeError(err)),
      },
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/animales" className="inline-flex min-h-12 items-center gap-1 text-sm text-gray-600 hover:text-brand-700 md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al hato
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Importar censo</h1>
        <p className="text-sm text-gray-500">Carga el hato desde un archivo CSV. En Excel: Archivo, Guardar como, CSV UTF-8.</p>
      </div>

      <Card titulo="1. Prepara el archivo">
        <p className="mb-3 text-sm text-gray-700">
          Columnas: {COLUMNAS.map((c) => c.encabezado).join(', ')}. Las fechas en dd/mm/aaaa y el costo de compra es opcional.
        </p>
        <Button variante="secundario" icono={Download} onClick={descargarPlantilla}>
          Descargar plantilla
        </Button>
      </Card>

      <Card titulo="2. Elige el archivo">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-borde-control px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
          <Upload size={20} aria-hidden="true" />
          <span>{archivo ?? 'Toca para elegir un archivo .csv'}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Archivo CSV del censo" onChange={(e) => leer(e.target.files?.[0])} />
        </label>
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      </Card>

      {resultados && (
        <Card titulo="3. Revisa e importa">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tono="ok" icono={CheckCircle2}>
              {validas.length} filas válidas
            </Badge>
            {conErrores.length > 0 && (
              <Badge tono="peligro" icono={AlertTriangle}>
                {conErrores.length} con errores
              </Badge>
            )}
          </div>
          {conErrores.length > 0 && (
            <ul className="mb-4 divide-y divide-gray-100 text-sm">
              {conErrores.map((r) => (
                <li key={r.linea} className="py-2">
                  <p className="font-semibold text-gray-900">Fila {r.linea}</p>
                  <ul className="list-disc pl-5 text-peligro">
                    {r.errores.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {validas.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button icono={Upload} disabled={importar.isPending} onClick={importarValidas}>
                {importar.isPending ? `Importando ${progreso} de ${validas.length}…` : `Importar ${validas.length} ${validas.length === 1 ? 'animal' : 'animales'}`}
              </Button>
              {conErrores.length > 0 && <p className="text-sm text-gray-600">Se omitirán las {conErrores.length} filas con errores (R3).</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-700">Ninguna fila es válida. Corrige el archivo y vuelve a cargarlo.</p>
          )}
        </Card>
      )}

      {final && (
        <div role="status" className="rounded-xl border border-ok bg-ok-50 p-4 text-sm text-gray-900">
          <p className="font-semibold">
            Se importaron {final.creados} {final.creados === 1 ? 'animal' : 'animales'}.
          </p>
          {final.fallidos.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-peligro">
              {final.fallidos.map((f) => (
                <li key={f.numeroInterno}>
                  {f.numeroInterno}: {mensajeError(f.error)}
                </li>
              ))}
            </ul>
          )}
          <Link to="/animales" className="mt-2 inline-flex min-h-12 items-center font-medium text-brand-700 hover:underline">
            Ver el hato
          </Link>
        </div>
      )}
    </div>
  );
}
