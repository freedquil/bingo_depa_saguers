# Bingo Depa Saguerssss 🏠

Bingo doméstico para hasta 20 jugadores, listo para Netlify.

## Funciones
- Jugadores ingresan su nombre.
- Se asigna 1 de 20 cartones únicos.
- Admin con clave privada.
- Sorteo aleatorio sin repetir.
- Cartones se actualizan y marcan solos.
- Detecta bingo horizontal, vertical o diagonal.
- Jugador puede avisar bingo al admin.
- Admin ve historial, jugadores y ganadores.
- Botón de reinicio.
- Estado persistente con Netlify Blobs.

## Cómo subirlo
1. Sube esta carpeta a GitHub.
2. En Netlify: Add new project → Import an existing project.
3. Elige el repositorio.
4. Netlify detectará `netlify.toml`.
5. En Project configuration → Environment variables agrega:
   `ADMIN_PASSWORD`
   con la clave que quieras.
6. Deploy.

## Para probar localmente
```bash
npm install
npx netlify dev
```

## Cambiar productos
Edita la constante `PRODUCTS` en:
`netlify/functions/game.mjs`

## Antes de la fiesta
Entra al panel admin y toca `Reiniciar partida` para borrar pruebas anteriores.

No pongas la clave en el HTML ni en app.js. Déjala solo como variable de entorno en Netlify.
