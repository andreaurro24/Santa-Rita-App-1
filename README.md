# Finca Santa Rita — MVP de trazabilidad y apoyo a la decisión de venta

MVP funcional desarrollado para el proyecto **"End-to-End IT Automation & Operational
Improvement Project — Finca Santa Rita"** (Gerencia de TI, Universidad de La Sabana,
2026-2). Implementa el alcance definido en el Capítulo 5.3.1 del Project Charter:

- Registro digital individual del animal (marca de finca, número interno, chapeta ICA/Sinigán).
- Historial de peso por animal (carga manual, sin hardware de pesaje).
- Registro de vacunas y tratamientos por animal, con alertas de vacunación pendiente.
- Trazabilidad del esquema **"Al partir"** (tenedor y condiciones pactadas).
- Consulta centralizada de variables externas: **clima en vivo (Open-Meteo)**, **TRM en
  vivo (datos.gov.co)** y **precio del kilo en pie** (referencia editable, Fedegán/SIPSA
  no exponen API pública formal).
- Cálculo de punto de equilibrio por lote y motor de recomendación de venta basado en reglas.
- Reporte resumen imprimible/exportable a PDF como apoyo a la decisión de venta.

## Stack técnico

React 19 + Vite + React Router + Tailwind CSS 4 + Recharts + lucide-react. Sin backend:
los datos viven en `localStorage` del navegador, sembrados con un set de ejemplo de
~140 reses generado de forma determinística (`scripts/generate-seed.mjs`).

## Cómo correrlo localmente

```bash
npm install
npm run dev       # http://localhost:5173
```

Build de producción:

```bash
npm run build      # genera dist/
npm run preview    # sirve el build localmente para probarlo
```

## Acceso de demostración

| Rol | Usuario | Contraseña |
|---|---|---|
| Dueño / decisión de venta (Miguel Ángel Lacouture) | `miguel` | `santarita2026` |
| Administrador operativo | `admin` | `finca2026` |

El login es una simulación sin backend (pensada para el MVP académico); las
credenciales están a la vista en la propia pantalla de login.

## Notas sobre las integraciones externas

- **Clima**: se consulta en vivo contra la API pública de [Open-Meteo](https://open-meteo.com)
  (sin API key) para las coordenadas de Badillo, Cesar. Si no hay conexión, se muestra
  un valor de respaldo etiquetado como tal.
- **TRM**: se consulta en vivo contra el portal de Datos Abiertos de Colombia
  (datos.gov.co / Socrata), también sin API key.
- **Precio del kilo en pie**: el Capítulo 4 del proyecto documenta que Fedegán/SIPSA no
  tienen una API pública formal. Por eso este dato se modela como una serie de
  referencia pre-cargada con valores publicados en sus boletines, editable desde el
  módulo "Mercado y clima" — igual que hoy se hace manualmente, pero centralizado.

## Estructura del proyecto

```
src/
  api/          integraciones externas (clima, TRM)
  components/   piezas de UI reutilizables (charts, layout, badges)
  context/      estado global (auth, datos del hato) con persistencia en localStorage
  data/         datos semilla (usuarios demo, precios de referencia, animales)
  pages/        una página por módulo del MVP
  utils/        lógica de negocio (punto de equilibrio) y formateo
scripts/
  generate-seed.mjs   genera src/data/seedAnimals.json (determinístico, reproducible)
```

## Fuera de alcance de este MVP (Cap. 5.3.2 del proyecto)

Automatización de hardware de pesaje, integración institucional en tiempo real con
ICA/SINIGAN, modelo predictivo de machine learning, y expansión a múltiples fincas.
