# Aula · Refuerzo Master Creador Lans

Entorno local de curso y reproducción. Sirve para ver las 77 lecciones del
curso desde el disco, sin plataforma, sin conexión y con el progreso guardado
en el propio equipo. Cada persona entra con su cuenta y tiene su propio
progreso.

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Effect** para servicios, validación con `Schema` y manejo de errores
- **SQLite** (`node:sqlite`) para cuentas, sesiones y progreso
- **Bun** como gestor de paquetes y runtime de los scripts
- Diseño tomado de la identidad de Lans Studios (EB Garamond, tinta, papel
  cálido y azul `#0072EF`)

## Requisitos

- [Bun](https://bun.sh) 1.4 o superior
- Node.js 24 o superior (Next.js lo usa para el servidor y `node:sqlite`)
- Los vídeos del curso en `media/` (no se versionan: son ~5 GB)

## Puesta en marcha

```bash
bun install
bun run content:build   # genera content/course.json a partir de media/
bun run dev             # http://localhost:3000
```

La primera vez, la app abre `/setup` para crear la cuenta inicial. Esa cuenta
queda como **administradora** y puede añadir al resto desde **Ajustes**.

Para producción local:

```bash
bun run build
bun run start
```

## Cuentas

| Persona | Usuario  | Rol           |
| ------- | -------- | ------------- |
| Maria   | `maria`  | Administradora |
| Hylary  | `hylary` | Miembro        |
| Yeisy   | `yeisy`  | Miembro        |

Las tres se crean con `bun run scripts/create-accounts.ts` y una contraseña
temporal (`Lans2026!` por defecto, o la que indique `TEMP_PASSWORD`). Cámbiala
en **Ajustes → Cambiar contraseña**.

La administradora puede, además:

- crear cuentas nuevas,
- restablecer la contraseña de cualquier cuenta,
- eliminar cuentas (con su progreso, por clave foránea en cascada).

Nadie puede eliminar su propia cuenta.

## Estructura

```
media/                     Vídeos, una carpeta por módulo (ignorado por git)
content/
  source-manifest.json     Export de la plataforma: títulos, duraciones, URLs
  course.json              Generado: modelo que consume la app
data/aula.db               SQLite: usuarios, sesiones y progreso (ignorado)
docs/                      Índice en PDF y su HTML
scripts/
  build-course.ts          Genera content/course.json y verifica los archivos
  create-accounts.ts       Crea las tres cuentas con su rol
  smoke.ts                 Prueba cuentas, sesiones y aislamiento de progreso
  descargar-lans.ps1       Descarga reanudable de los vídeos originales
src/
  app/                     Rutas, layout, login y API
  components/              UI (curso, reproductor, temario lateral)
  domain/                  Esquemas y reglas puras (curso, progreso)
  lib/                     Formato y utilidades
  server/                  Servicios Effect, autenticación y acceso a disco
```

## Cómo funciona

1. `bun run content:build` lee `content/source-manifest.json`, empareja cada
   lección con su archivo en `media/` por el prefijo `NN - `, comprueba que
   existe y anota el tamaño real del disco. El resultado se valida con
   `CourseSchema` y se escribe en `content/course.json`.
2. La app carga ese JSON una sola vez por proceso (`CourseRepository`, con
   `Effect.cached`) y lo expone como modelo tipado.
3. La sesión viaja en una cookie `HttpOnly` con un token de 32 bytes; en la
   base solo se guarda su SHA-256. Las contraseñas se derivan con **scrypt**.
4. El reproductor pide el vídeo a `/api/media/<id>`, que exige sesión, resuelve
   la ruta, valida que no se sale de `media/` y responde con soporte de `Range`
   para poder buscar dentro del vídeo.
5. Cada 5 segundos, al pausar y al terminar, se guarda la posición en SQLite.
   Al 90 % la lección se marca como vista y nunca se desmarca al reproducir.

## API

| Método | Ruta               | Descripción                                  |
| ------ | ------------------ | -------------------------------------------- |
| GET    | `/api/course`      | Curso completo con módulos y lecciones        |
| GET    | `/api/progress`    | Progreso de la persona con sesión             |
| PUT    | `/api/progress`    | Guarda posición y estado de una lección       |
| GET    | `/api/media/<id>`  | Vídeo con `Range`, `206` y `Accept-Ranges`    |

## Interfaz

- **Temario** en `/` con buscador y progreso por módulo.
- **Reproductor** en `/leccion/<id>`, con reanudación y guardado cada 5 s.
- **Índice** en `/indice`: el temario completo dentro de la app, con enlace
  directo a cada lección.
- **Ajustes** en `/cuenta`: nombre, cambio de contraseña y, para la
  administradora, alta/borrado de cuentas y restablecimiento de contraseñas.
- **Menú de usuario** en la cabecera: ajustes, modo oscuro y cerrar sesión.

`PUT /api/progress` espera:

```json
{ "lessonId": "manicura/01-brocas-para-manicura", "positionSeconds": 92.5, "completed": false }
```

## Variables de entorno

Todas son opcionales; por defecto se resuelven desde la raíz del proyecto.

| Variable        | Por defecto           |
| --------------- | --------------------- |
| `MEDIA_DIR`     | `media`               |
| `CONTENT_FILE`  | `content/course.json` |
| `DATABASE_FILE` | `data/aula.db`        |

## Comprobaciones

```bash
bun run typecheck
bun run lint
bun run build
DATABASE_FILE=data/verify.db bun run scripts/smoke.ts
```

El smoke test usa una base temporal y verifica registro, duplicados,
contraseña incorrecta, sesión, aislamiento de progreso y cierre de sesión.

## App de escritorio (Tauri)

El aula también se empaqueta como aplicación de Windows: una ventana propia,
sin navegador ni terminal, que arranca su servidor interno y lo apaga al
cerrarse.

```bash
bun run desktop:build
```

Eso hace, en orden:

1. `next build` en modo `standalone`.
2. Copia el servidor, `public/`, `content/` y el `node.exe` del sistema a
   `src-tauri/resources/`.
3. `tauri build`, que genera el ejecutable y el instalador NSIS en
   `src-tauri/target/release/bundle/nsis/`.

Requisitos para compilar: Rust (`rustup`) y Visual Studio Build Tools con el
workload de C++. WebView2 ya viene con Windows 10/11.

La app instalada guarda en `%APPDATA%\com.lans.aula`:

- `aula.db` — cuentas, sesiones y progreso.
- `config.json` — ruta de la carpeta de vídeos y puerto del servidor interno.

El puerto es estable (41820 por defecto): cookies de sesión y preferencias del
webview se guardan por origen, así que un puerto distinto en cada arranque
cerraría la sesión y perdería el modo oscuro.

Los vídeos **no** se copian dentro del instalador: la primera vez la app pide
la carpeta `media/` y la recuerda. Así el instalador pesa ~150 MB en vez de
5 GB, y puedes mover o respaldar los vídeos sin reinstalar.

El instalador queda en `src-tauri/target/release/bundle/nsis/`. No está
firmado, así que Windows SmartScreen puede avisar la primera vez: «Más
información → Ejecutar de todas formas».

## Aviso

Los vídeos son material con copyright de Lans Studios y se usan aquí para
consumo personal. No se distribuyen con el código: `media/` está ignorado por
git y el repositorio solo contiene la aplicación y los metadatos del temario.
