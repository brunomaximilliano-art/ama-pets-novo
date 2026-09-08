# AMA Pets — Tienda online

Catálogo online con carrito de compras, checkout que finaliza por WhatsApp, y panel administrativo para cargar productos, fotos y videos. Construido a partir del mismo flujo de compra del sitio de referencia (catálogo Kyte), pero como código propio que podés hospedar donde quieras.

## ¿Qué incluye?

- **Tienda pública**: inicio con secciones por categoría, página de categoría, página de producto (galería de fotos, video opcional, descripción, botón de WhatsApp para consultas), carrito con selección de forma de entrega (envío con transportadora o retirada), y checkout con datos del cliente + método de pago. Al finalizar, arma un mensaje prolijo y lo envía por WhatsApp (`wa.me`), igual que el sitio de referencia.
- **Panel administrativo** (`/admin`): productos (crear/editar/eliminar, múltiples fotos, video por URL de YouTube o archivo corto), categorías, transportadoras y zona de envío gratis, métodos de pago habilitados y datos de transferencia, datos de la tienda (nombre, WhatsApp, logo, colores), y listado de pedidos recibidos.
- Todo lo que hay que conservar (base de datos y archivos subidos) vive en una única carpeta, `storage/`, para que hospedar el sitio sea lo más simple posible.

## Requisitos

- Node.js 18 o superior.

## Uso local

```bash
npm install
cp .env.example .env   # y editá el usuario/contraseña del admin
npm start
```

- Tienda: http://localhost:3000
- Panel administrativo: http://localhost:3000/admin (usuario/contraseña definidos en `.env`, o `admin` / `cambiar123` por defecto la primera vez que se inicia)

La primera vez que se inicia el servidor se crea automáticamente la carpeta `storage/` con la base de datos, el logo de AMA Pets, las categorías y productos de ejemplo, las transportadoras (Turil Cargo y DAC) y el usuario administrador. Las corridas siguientes no vuelven a pisar esos datos.

## Cómo publicarlo — Railway (recomendado, paso a paso bien simple)

No hace falta saber programar ni usar la terminal para esto. Vas a necesitar dos cuentas gratis: GitHub y Railway.

**1. Subí el código a GitHub**

1. Si no tenés cuenta, andá a [github.com](https://github.com) y creá una (botón "Sign up").
2. Ya logueado, hacé clic en el botón verde **"New"** (o el ícono "+" arriba a la derecha → "New repository").
3. Ponele un nombre, por ejemplo `amapets` (podés dejarlo como "Private"). Hacé clic en **"Create repository"**.
4. En la página que se abre, buscá el link que dice **"uploading an existing file"** y hacé clic ahí.
5. En tu computadora, descomprimí el .zip que te pasé. Arrastrá **todos los archivos y carpetas de adentro** (no la carpeta zip en sí, lo de adentro) al recuadro de la página de GitHub.
6. Esperá a que termine de subir, bajá al final de la página y hacé clic en **"Commit changes"**.

**2. Creá el sitio en Railway**

1. Andá a [railway.app](https://railway.app) y creá una cuenta (lo más fácil: "Login with GitHub", así queda todo conectado).
2. Hacé clic en **"New Project"** → **"Deploy from GitHub repo"** → elegí el repositorio `amapets` que acabás de crear.
3. Railway va a detectar que es un proyecto Node.js y va a empezar a instalarlo y desplegarlo solo. Esperá un par de minutos.
4. Cuando termine, hacé clic en el servicio (la cajita con el nombre de tu proyecto) → pestaña **"Settings"** → sección **"Networking"** → **"Generate Domain"**. Ahí te va a dar un link tipo `amapets-production.up.railway.app` — ese es tu sitio.

**3. Agregá las variables (usuario, contraseña, y dónde guardar los datos)**

1. Dentro del servicio, andá a la pestaña **"Variables"**.
2. Agregá una por una (botón "New Variable"), con nombre y valor:
   - `ADMIN_USER` → el usuario que vas a usar para entrar al panel (ej: `amapets`)
   - `ADMIN_PASSWORD` → una contraseña segura tuya
   - `COOKIE_SECRET` → cualquier texto largo random, ej: `ama-pets-2026-xyz789-secreto`
   - `STORAGE_DIR` → escribí exactamente `/data`
3. Railway va a reiniciar el servicio solo después de guardar las variables.

**4. Agregá el almacenamiento permanente (para que los productos y fotos no se borren)**

1. Todavía dentro del servicio, andá a la pestaña **"Settings"** → bajá hasta la sección **"Volumes"**.
2. Hacé clic en **"New Volume"**.
3. En "Mount path" escribí exactamente `/data` (lo mismo que pusiste en `STORAGE_DIR` en el paso anterior).
4. Guardá. El servicio se va a reiniciar de nuevo, ahora con un disco permanente conectado.

**Listo.** Entrá a tu link de Railway + `/admin` (por ejemplo `https://amapets-production.up.railway.app/admin`), iniciá sesión con el usuario y contraseña que pusiste en las variables, y empezá a cargar tus productos reales. Cada vez que quieras cambiar algo del código, subí los archivos nuevos a GitHub (mismo paso 1.4-1.6) y Railway va a actualizar el sitio solo.

## Cómo publicarlo — Render (alternativa)

Es un proceso parecido a Railway, con una diferencia importante: en Render, para poder agregar un disco persistente (necesario para que no se borren los productos y fotos) hace falta pasar el servicio al plan pago más chico ("Starter", no es el plan gratis). Si preferís no pagar nada, Railway es la opción más simple de las dos.

1. Subí el código a GitHub (mismos pasos de arriba).
2. En [render.com](https://render.com), creá una cuenta y hacé clic en **"New" → "Web Service"**, conectá tu cuenta de GitHub y elegí el repositorio.
3. Build Command: `npm install`. Start Command: `npm start`.
4. En "Environment", agregá las mismas variables: `ADMIN_USER`, `ADMIN_PASSWORD`, `COOKIE_SECRET`, y `STORAGE_DIR` = `/data`.
5. En "Disks", agregá un disco con Mount Path `/data` (esto requiere el plan Starter).

## Cómo publicarlo — Vercel

Vercel no tiene disco persistente, así que en vez del volumen de Railway/Render, el sitio usa dos servicios externos gratuitos: [Turso](https://turso.tech) para la base de datos y **Vercel Blob** para las fotos/videos. Es un poco más de configuración que Railway. Si te interesa esta opción, avisame y te preparo el paso a paso detallado (ya está soportado en el código: solo hay que crear esas dos cuentas y cargar las variables `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` y `BLOB_READ_WRITE_TOKEN`).

## Estructura del proyecto

```
server.js               punto de entrada para local / Railway / Render / VPS (llama a app.listen)
api/index.js             punto de entrada para Vercel (exporta la app sin listen)
vercel.json               enruta todas las requests hacia api/index.js (solo aplica en Vercel)
src/app.js                arma la app de Express (rutas, vistas, estáticos) — la usan ambos entry points
src/db.js                 conexión a la base (archivo local en storage/, o Turso si está configurado)
src/lib/storage.js        guarda archivos subidos en storage/uploads/, o en Vercel Blob si está configurado
src/seed.js               datos iniciales (categorías, productos de ejemplo, admin, logo por defecto)
src/routes/public.js      páginas de la tienda
src/routes/admin.js       panel administrativo
src/routes/api.js         API usada por el carrito (productos, transportadoras, pedidos)
src/middleware/           autenticación del admin (cookie firmada) y subida de archivos (multer)
views/                    plantillas EJS (tienda + admin)
public/css, public/js     estilos y JS del carrito (sin frameworks, JS simple)
public/img/logo-default.jpg   logo de AMA Pets por defecto (se sirve siempre, no depende del hosting)
storage/                  base de datos + fotos/videos subidos por el panel (se crea sola; no aplica en Vercel)
```

## Pendiente de completar (lo dejé como placeholder para que lo cargues vos)

- Datos bancarios reales para la opción "Transferencia bancaria" (Panel → Pagos).
- Dirección exacta de retiro en el local (Panel → Entrega).
- Tus productos reales, con fotos y videos (Panel → Productos). Dejé 8 productos de ejemplo para que veas cómo se ve la tienda funcionando; podés editarlos o borrarlos.
- Revisar el número de WhatsApp y los colores/logo en Panel → Tienda (ya cargué tu logo y una paleta de colores basada en él).

## Seguridad antes de publicar

- Cambiá `ADMIN_USER` / `ADMIN_PASSWORD` (no dejes la contraseña por defecto `cambiar123`).
- Usá un `COOKIE_SECRET` largo y que no sea obvio.
- Nunca subas el archivo `.env` a GitHub (ya está en `.gitignore`, así que si seguiste los pasos de arriba no se sube solo).
