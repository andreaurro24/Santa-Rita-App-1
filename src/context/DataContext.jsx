import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import seedAnimals from '../data/seedAnimals.json';
import { PRECIO_KILO_EN_PIE_HISTORICO } from '../data/seedMercado';

const ANIMALS_KEY = 'santarita_animales_v1';
const PRECIOS_KEY = 'santarita_precios_v1';

const DataContext = createContext(null);

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function DataProvider({ children }) {
  const [animales, setAnimales] = useState(() => loadFromStorage(ANIMALS_KEY, seedAnimals));
  const [precios, setPrecios] = useState(() => loadFromStorage(PRECIOS_KEY, PRECIO_KILO_EN_PIE_HISTORICO));

  useEffect(() => {
    try {
      localStorage.setItem(ANIMALS_KEY, JSON.stringify(animales));
    } catch {
      /* localStorage lleno o no disponible: los cambios solo viven en memoria de esta sesión */
    }
  }, [animales]);

  useEffect(() => {
    try {
      localStorage.setItem(PRECIOS_KEY, JSON.stringify(precios));
    } catch {
      /* noop */
    }
  }, [precios]);

  function addAnimal(nuevo) {
    setAnimales((prev) => [...prev, nuevo]);
  }

  function addPeso(animalId, registro) {
    setAnimales((prev) =>
      prev.map((a) => (a.id === animalId ? { ...a, pesos: [...a.pesos, registro] } : a)),
    );
  }

  function addSanidad(animalId, evento) {
    setAnimales((prev) =>
      prev.map((a) => (a.id === animalId ? { ...a, sanidad: [...a.sanidad, evento] } : a)),
    );
  }

  function addPrecio(registro) {
    setPrecios((prev) =>
      [...prev, registro].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    );
  }

  function resetDatosEjemplo() {
    setAnimales(seedAnimals);
    setPrecios(PRECIO_KILO_EN_PIE_HISTORICO);
  }

  const lotes = useMemo(() => {
    const map = new Map();
    for (const a of animales) {
      if (!map.has(a.lote)) map.set(a.lote, { codigo: a.lote, nombre: a.loteNombre, animales: [] });
      map.get(a.lote).animales.push(a);
    }
    return [...map.values()];
  }, [animales]);

  const precioActual = precios.length ? [...precios].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1) : null;

  const value = {
    animales,
    lotes,
    precios,
    precioActual,
    addAnimal,
    addPeso,
    addSanidad,
    addPrecio,
    resetDatosEjemplo,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
