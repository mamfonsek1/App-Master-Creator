# Aula · Refuerzo Master Creador Lans

Entorno local de curso y reproducción. Sirve para ver las 77 lecciones del
curso desde el disco, sin plataforma, sin conexión y con el progreso guardado
en el propio equipo.

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Effect** para servicios, validación con `Schema` y manejo de errores
- **Bun** como gestor de paquetes y runtime de los scripts
- Diseño tomado de la identidad de Lans Studios (EB Garamond, tinta, papel
  cálido y azul `#0072EF`)

## Requisitos

- [Bun](https://bun.sh) 1.4 o superior
- Node.js 20 o superior (Next.js lo usa para el servidor)
- Los vídeos del curso en `media/` (no se versionan: son ~5 GB)

## Puesta en marcha

```bash
bun install
bun run content:build   # genera content/course.json a partir de media/
bun run dev             # http://localhost:3000
```

Para producción local:

```bash
bun run build
bun run start
```

## Estructura

```
media/                     Vídeos, una carpeta por módulo (ignorado por git)
content/
  source-manifest.json     Export de la plataforma: títulos, duraciones, URLs
  course.json              Generado: modelo que consume la app
data/progress.json         Progreso local (se crea al primer guardado)
docs/                      Índice en PDF y su HTML
scripts/
  build-course.ts          Genera content/course.json y verifica los archivos
  descargar-lans.ps1       Descarga reanudable de los vídeos originales
src/
  app/                     Rutas, layout y API
  components/              UI (curso, reproductor, temario lateral)
  domain/                  Esquemas y reglas puras (curso, progreso)
  lib/                     Formato y utilidades
  server/                  Servicios Effect, capa y acceso a disco
```

## Cómo funciona

1. `bun run content:build` lee `content/source-manifest.json`, empareja cada
   lección con su archivo en `media/` por el prefijo `NN - `, comprueba que
   existe y anota el tamaño real del disco. El resultado se valida con
   `CourseSchema` y se escribe en `content/course.json`.
2. La app carga ese JSON una sola vez por proceso (`CourseRepository`, con
   `Effect.cached`) y lo expone como modelo tipado.
3. El reproductor pide el vídeo a `/api/media/<id>`, que resuelve la ruta,
   valida que no se sale de `media/` y responde con soporte de `Range` para
   poder buscar dentro del vídeo.
4. Cada 5 segundos, al pausar y al terminar, se guarda la posición en
   `data/progress.json` mediante una escritura atómica serializada. Al 90 % la
   lección se marca como vista.

## API

| Método | Ruta               | Descripción                                  |
| ------ | ------------------ | -------------------------------------------- |
| GET    | `/api/course`      | Curso completo con módulos y lecciones        |
| GET    | `/api/progress`    | Estado de progreso                            |
| PUT    | `/api/progress`    | Guarda posición y estado de una lección       |
| GET    | `/api/media/<id>`  | Vídeo con `Range`, `206` y `Accept-Ranges`    |

`PUT /api/progress` espera:

```json
{ "lessonId": "manicura/01-brocas-para-manicura", "positionSeconds": 92.5, "completed": false }
```

## Variables de entorno

Todas son opcionales; por defecto se resuelven desde la raíz del proyecto.

| Variable        | Por defecto            |
| --------------- | ---------------------- |
| `MEDIA_DIR`     | `media`                |
| `CONTENT_FILE`  | `content/course.json`  |
| `PROGRESS_FILE` | `data/progress.json`   |

## Aviso

Los vídeos son material con copyright de Lans Studios y se usan aquí para
consumo personal. No se distribuyen con el código: `media/` está ignorado por
git y el repositorio solo contiene la aplicación y los metadatos del temario.
