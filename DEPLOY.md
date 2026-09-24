# Cómo poner el MVP en línea (1 minuto, sin consola)

Este entorno donde se construyó el proyecto no tiene salida a internet hacia los
servicios de hosting (Vercel, Netlify, GitHub, etc.), así que el despliegue en vivo
lo tienes que disparar tú — pero es literalmente arrastrar una carpeta:

## Opción más rápida: Netlify Drop (sin cuenta, sin comandos)

1. Abre **https://app.netlify.com/drop** en tu navegador.
2. Arrastra la carpeta **`dist/`** (ya viene compilada y lista, incluida en
   `santa-rita-mvp-dist.zip`) directamente sobre la página.
3. En segundos te da una URL pública (`algo.netlify.app`) — esa es tu link en vivo
   para el video de demostración (H6) o para compartir con el profesor/Miguel Ángel.
4. Si quieres editarla luego (nombre de sitio, dominio propio), te ofrece crear una
   cuenta gratis para "reclamar" el sitio.

## Alternativa: Vercel (un comando, con tu cuenta)

Si prefieres tener el proyecto conectado a tu cuenta de Vercel para actualizaciones
futuras:

```bash
npm install -g vercel
cd santa-rita-mvp
npm install
vercel --prod
```

Te pedirá iniciar sesión (con GitHub, GitLab o email) la primera vez, y luego queda
desplegado con un dominio `tuproyecto.vercel.app`.

## Alternativa: GitHub Pages

1. Sube la carpeta `santa-rita-mvp/` a un repositorio de GitHub.
2. En Settings → Pages, o usando `npm install -D gh-pages` + un script de deploy,
   publica el contenido de `dist/`.
3. La app usa `HashRouter` (rutas tipo `#/animales`), así que funciona en GitHub
   Pages sin necesidad de configurar redirecciones — cualquier ruta refresca bien.

Cualquiera de las tres te da una URL funcionando con los mismos datos de
demostración y las mismas integraciones en vivo (clima y TRM) que probaste
localmente.
