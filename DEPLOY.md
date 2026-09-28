# Despliegue (Vercel + Supabase)

La app es un sitio estático (Vite) que habla directo con Supabase. Toda la seguridad de los
datos está en las políticas RLS de la base de datos, así que el sitio solo necesita la URL y la
llave **publicable**.

## 1. Subir el código a GitHub

```bash
git push origin main
```

El repositorio del equipo es `andreaurro24/Santa-Rita-App-1`.

## 2. Crear el proyecto en Vercel

1. En https://vercel.com/new importa el repositorio. Vercel detecta Vite solo:
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. En **Settings → Environment Variables** agrega estas dos variables, para Production y Preview:
   - `VITE_SUPABASE_URL`: la URL del proyecto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: la llave publicable (`sb_publishable_…`).
3. Despliega. Cada push a `main` vuelve a desplegar.

La app usa rutas con `#` (HashRouter), así que no necesita reglas de reescritura.

**Nunca** pongas la llave `service_role` ni contraseñas en Vercel: el cliente no las necesita.

## 3. Supabase antes de usarlo con datos reales

1. Crea un proyecto de **producción** aparte del de desarrollo (`santa-rita-dev`) y aplica las
   migraciones de `supabase/migrations/` en orden.
2. En **Authentication → Sign In / Providers**, desactiva el registro público (*Allow new users
   to sign up*) y activa la protección de contraseñas filtradas.
3. Crea el usuario de Miguel en **Authentication → Users → Add user** y dale su perfil:
   ```sql
   insert into public.perfiles (id, nombre, rol) values ('<uuid>', 'Miguel Ángel Lacouture', 'dueno');
   ```
4. En **Authentication → URL Configuration** agrega la URL de Vercel como *Site URL*.
5. No corras `npm run db:seed` contra producción: el script solo acepta el proyecto de
   desarrollo.

## 4. Comprobar

- Sin sesión, cualquier ruta lleva al login.
- Con la cuenta de Miguel se ven el hato y el panel.
- En `dist/` no deben aparecer `service_role` ni contraseñas:
  ```bash
  grep -r service_role dist
  ```
