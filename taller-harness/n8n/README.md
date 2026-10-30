# Canal Telegram + n8n + Supabase: cómo conectarlo

Los flujos están listos para importar, pero **no se han probado en vivo**: hacen falta tres
cuentas y tres llaves que solo puede poner una persona del equipo. Claude no crea cuentas ni
escribe llaves.

## 1. Supabase (proyecto de desarrollo, nunca producción)
1. Hecho el 2026-10-30: el SQL está aplicado en el proyecto `fixnszbgrsglwftqjkky` (org Andresitow),
   que reemplaza al proyecto de la org GuardIA, borrada. Para otro proyecto: SQL Editor → pegar y
   correr `taller-harness/supabase/001_arnes_campo.sql`.
   Hecho también: datos simulados del censo demo, usuarios `miguel.prueba@santarita.test` (dueno) y
   `admin.prueba@santarita.test` (administrador), y la clave de `arnes_campo`. Las claves están en
   `credenciales-prueba.local` en la raíz del repo (git lo ignora); los pasos 2 y 4 ya no hacen falta.
2. En el mismo editor, ponerle clave al rol del flujo (guárdenla en el gestor de claves del equipo):
   `alter role arnes_campo with password '<clave larga>';`
3. Registrar quién puede usar el bot (ids de Telegram: se ven escribiéndole a @userinfobot):
   ```sql
   insert into campo.telegram_autorizados (telegram_user_id, nombre, puede_enviar, puede_confirmar)
   values (<id del administrador de prueba>, 'Administrador (prueba)', true, false),
          (<id de quien confirma>, 'Miguel (prueba)', true, true);
   ```
4. Cargar el censo de demostración en la base de desarrollo, nunca datos reales de Miguel.

Antes de aplicarlo, el SQL se probó con `probar-pglite.mjs` sobre un Postgres embebido. Ese script
necesita `npm i @electric-sql/pglite` en una carpeta aparte, no en el repo. El resultado está en
`../supabase/prueba-pglite.txt`.

## 2. Bot de Telegram (hecho el 2026-10-30)
- Bot creado: **@santarita_campo_prueba_bot** ("Santa Rita Campo (prueba)"), con descripción.
- El token está en el chat con @BotFather de la cuenta de Telegram de Andrés. Se copia **directo a
  la credencial de n8n** (paso 3); no se pega en documentos ni en el chat.
- El id de Telegram de cada usuario autorizado se ve en la primera ejecución del flujo
  (`message.from.id` en el nodo "Telegram: mensaje") o escribiéndole a @userinfobot.

## 3. n8n (n8n Cloud de prueba o `npx n8n` local)
1. Crear tres credenciales con estos nombres exactos:
   - **Telegram Santa Rita**: tipo Telegram API, con el token del bot.
   - **Anthropic**: tipo Header Auth, con nombre `x-api-key` y valor = la llave de la API de Claude.
   - **Supabase arnes_campo**: tipo Postgres. Host del pooler de Supabase (Settings → Database),
     usuario `arnes_campo.<ref del proyecto>`, la clave del paso 1.2, SSL activado.
2. Importar `procesar-reporte.json` (Workflows → Import from file). Es un solo flujo a propósito: Telegram
   admite un solo webhook por bot, y con dos disparadores el último que se activa deja al otro sin eventos
   (así fallaron los botones en la primera prueba en vivo, 2026-10-30).
3. En cada nodo con credencial, elegir la que corresponde (al importar quedan como "CAMBIAR").
4. Activar los dos flujos.

## 4. Probar los casos
Mandar al bot, desde el Telegram del administrador de prueba, las fotos de `casos/caso-N/planilla.jpg`
y los textos de `casos/caso-5` y `casos/caso-8`. Luego pulsar los botones desde el Telegram de
quien confirma. Tomar capturas de: el chat con el resumen y los botones, el flujo de n8n con la
ejecución en verde, y las tablas `campo.borradores_campo` y `campo.bitacora_jornadas`.

Pruebas de guardarraíl que vale la pena capturar:
- Escribirle al bot desde un Telegram no autorizado: no responde y queda `mensaje_ignorado`.
- Pulsar "Confirmar" en el caso 3, que tiene un dudoso: "No se cargó nada: quedan 1 dudosos…".
- El administrador pulsa "Confirmar" en su propio reporte: "no puede confirmarlo".

## Qué hace cada flujo
- **procesar-reporte:** Telegram → ¿remitente autorizado? → censo (vista `campo.censo_arnes`) →
  extractor (Claude, hasta 3 intentos con los errores del validador) → validador (el mismo código de
  `arnes/validador.mjs`) → revisor (Claude, solo si hay dudas) → guarda el borrador → resumen con
  botones.
- **Rama de botones (mismo flujo):** el nodo "¿Es un botón?" manda los toques de Confirmar o Rechazar
  a `campo.confirmar_y_cargar` o `campo.rechazar_borrador` en Supabase → respuesta en Telegram → bitácora.

Si cambian las instrucciones, las skills o el validador, regeneren los flujos con
`node taller-harness/scripts/generar-n8n.mjs` y vuelvan a importarlos.
