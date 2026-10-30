---
name: leer-evento-sanidad
description: Convierte un mensaje del administrador sobre vacunas, purgas o tratamientos en eventos sanitarios con fecha. Úsala cuando el reporte hable de vacunar, purgar, bañar, desparasitar o tratar animales.
---

# Leer un evento de sanidad

## Cuándo se usa
- Mensajes como "ayer vacunamos el lote 2026-B contra aftosa" o "le puse antibiótico a la 204".
- **No** se usa para pesos (eso es `leer-jornada-pesaje`).

## Pasos
1. **Tipo** (glosario):
   - vacunar → `vacuna`
   - purgar, bañar, desparasitar, ivermectina → `desparasitacion`
   - antibiótico, curación, vitaminas, tratamiento → `tratamiento`
2. **Descripción:** el producto o la enfermedad, en pocas palabras ("Aftosa", "Ivermectina").
3. **Fecha:** la del evento, no la del mensaje.
   - "hoy" = fecha del mensaje · "ayer" = fecha del mensaje menos 1 día · "antier" = menos 2.
   - Un día de la semana ("el lunes") = el último lunes antes de la fecha del mensaje.
4. **A quién:**
   - Si nombra animales sueltos, un registro por animal con su número interno a 4 dígitos.
   - Si dice "todo el lote X", un solo registro con `alcance_lote: "LOTE-…"`. **No** listes
     los animales: el validador los saca del censo.
   - Si el lote se nombra por el potrero ("los de La Ceiba"), usa el lote de ese potrero
     según el censo.
5. Si falta el tipo, la fecha o a quién se aplicó, manda el mensaje a `ilegibles` con lo que
   falta.

## Ejemplo
Ver el ejemplo B en `contexto/ejemplos/ejemplos.md`.
