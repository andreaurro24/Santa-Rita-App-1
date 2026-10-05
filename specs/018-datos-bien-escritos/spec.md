# Spec 018 — Dinero con miles y nombres válidos

- Estado: hecha
- Sprint: 5
- Módulos del plan: transversal

## Contexto
Juan vio que al escribir precios es fácil poner un cero de más, y que los nombres aceptan cualquier
carácter. Miguel debe ver el dinero como lo escribe en papel: $1.000.000.

## Requisitos (EARS)
- R1 — Mientras se escribe un monto en pesos, el sistema deberá mostrar los puntos de miles en vivo
  ("1000000" se ve "1.000.000"), aceptar solo dígitos y mantener el cursor en su lugar. Aplica a todos
  los campos de dinero (compra, gastos, precios, contratos, ventas).
- R2 — Los nombres y textos cortos (dueño, finca, lote, potrero, tenedor, comprador, número interno,
  color) solo deberán aceptar letras (con tildes y ñ), números, espacios y `. , - ' ( ) # /`, con un
  largo máximo (80; 30 para número interno y chapeta). La regla deberá valer en el formulario y en la
  base de datos.

## Diseño
- `src/components/ui/CampoPesos.jsx` (input `inputMode="numeric"`, valor interno entero) y
  `src/utils/validar.js` (`nombreValido`, `mensajeNombre`).
- Migración 1700: `private.texto_valido(texto, maximo)` y checks en las columnas.

## Tareas
- [ ] T1 CampoPesos en todos los formularios de dinero — verifica: E2E escribe 1000000 y ve 1.000.000
- [ ] T2 Validación de nombres en cliente y base — verifica: unitarias + inserción directa rechazada

## Aprobación
- [x] Aprobada por Andrés Sánchez el 2026-10-04 (plan v2 del Sprint 05)
