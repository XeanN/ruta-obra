# RutaObra

Orquestador de trámites de construcción en Perú: de SUNARP a la conformidad de obra, en un solo lugar.
Estado: **prototipo de validación** (datos v0.1.0 al 30/09/2026). Producción: https://ruta-obra.vercel.app

- **Diagnóstico:** preguntas sobre el predio → modalidad de licencia, alertas y programas.
- **Hoja de ruta:** trámites por etapa, documentos y montos del TUPA por distrito, cada uno con su fuente.
- **Expedientes:** tablero, checklist de documentos, alertas de vencimiento y plazo de subsanación, bitácora de obra con fotos.
- **Cuentas:** ingreso con Google o enlace por correo; cada persona tiene un estudio y puede invitar a su equipo.
- **Modo demo:** `/demo` carga 3 expedientes de ejemplo en el navegador, sin cuenta.

Producto y alcance: [docs/PRD.md](docs/PRD.md). Datos: [docs/modelo-datos.md](docs/modelo-datos.md). Fases: [prompts/fases.md](prompts/fases.md). Reglas para Claude Code: [CLAUDE.md](CLAUDE.md).

## Stack

Next.js 16 (App Router) + TypeScript estricto, Tailwind + shadcn/ui, Zod, react-hook-form, date-fns.
Datos de usuarios en **Neon Postgres** con **Drizzle ORM**, cuentas con **Better Auth**, archivos en **Cloudflare R2** (API de S3), correos con **Resend**. Despliegue en **Vercel** (región `gru1`, São Paulo).
La base de conocimiento (trámites, tarifas, reglas) vive en `data/` como JSON versionado en git, no en la base de datos.

| Carpeta | Contenido |
|---|---|
| `data/` | Base de conocimiento en JSON (fuente de verdad) + `ruta-obra.xlsx` para revisar |
| `schema/` | JSON Schema de los datos y del modelo de expedientes |
| `fixtures/` | Casos del motor (`casos.json`), resultados del motor Python y expedientes de la demo (`demo.json`) |
| `scripts/` | `validate_data.py`, `simulate.py` (motor de referencia), `export_excel.py`, `migrar.mjs` |
| `src/domain/` | Lógica de negocio pura y probada (motor de reglas, hoja de ruta, alertas, bitácora, demo) |
| `src/data/` | Repositorios: conocimiento, expedientes (navegador, Postgres, Server Actions), R2 |
| `src/features/`, `app/` | Pantallas y rutas |
| `drizzle/` | Migraciones SQL versionadas |
| `e2e/` | Pruebas de Playwright a 375 px |

## Correr el proyecto

Requisitos: Node 24, pnpm 12 (`corepack enable`), Python 3.11 para los scripts de datos.

```bash
pnpm install
cp .env.example .env.local      # y completa los valores (ver abajo)
pnpm db:migrate                 # aplica las migraciones en la base de DATABASE_URL_UNPOOLED
pnpm dev                        # http://localhost:3000
```

Sin `.env.local` funcionan el diagnóstico, la hoja de ruta, las fuentes y los expedientes en modo invitado o demo (todo en el navegador). Las cuentas, la nube y las fotos necesitan las variables.

### Variables de entorno

Los nombres están en [.env.example](.env.example). Los valores nunca se suben a git: van en `.env.local` y en Vercel.

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Neon con pooling, para la app |
| `DATABASE_URL_UNPOOLED` | Neon sin pooling, para las migraciones |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Archivos en Cloudflare R2 (token con lectura y escritura solo en el bucket) |
| `BETTER_AUTH_SECRET` | Secreto de sesiones (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | URL pública de la app (en local, `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ingreso con Google |
| `RESEND_API_KEY`, `EMAIL_FROM` | Enlaces de acceso e invitaciones por correo (dominio verificado en Resend) |
| `NEXT_PUBLIC_CORREO_CONTACTO` | Correo público en `/privacidad` (por defecto `info@aliiatech.com`) |
| `NEXT_PUBLIC_SITE_URL` | Opcional: URL canónica para Open Graph y el sitemap (por defecto, la de producción de Vercel) |

En Vercel cada variable se carga por entorno (Production y Preview; Preview usa la rama `preview` de Neon):

```bash
vercel env add NOMBRE production
vercel env add NOMBRE preview
```

> En Windows no subas valores con una tubería de PowerShell (`"valor" | vercel env add ...`): agrega un BOM invisible y la variable queda rota ("Invalid URL"). Escríbelos cuando el comando los pida o usa un script de Node.

## Comandos

```bash
pnpm dev                          # desarrollo
pnpm lint && pnpm typecheck       # ESLint y TypeScript
pnpm test                         # Vitest: dominio, repositorios (PGlite) y paridad con Python
pnpm test:coverage                # con cobertura (mínimo 90 % en src/domain)
pnpm e2e                          # Playwright a 375 px (levanta el servidor solo)
pnpm build                        # build de producción

python scripts/validate_data.py   # valida data/ contra schema/
python scripts/simulate.py        # motor de referencia contra fixtures/casos.json
python scripts/simulate.py --export  # regenera fixtures/resultados-motor.json (paridad TS)
python scripts/export_excel.py    # regenera data/ruta-obra.xlsx
python scripts/watch_sources.py --dry-run   # vigilancia de fuentes: imprime el reporte sin tocar GitHub
python -m pytest scripts/tests    # pruebas de los scripts de Python

pnpm db:generate                  # nueva migración desde src/data/db/*.ts
pnpm db:migrate                   # aplica migraciones pendientes
pnpm db:studio                    # explorar la base (Drizzle Studio)
pnpm auth:generate                # regenera el esquema de Better Auth
```

## Base de datos

### Migraciones

1. Cambia las tablas en `src/data/db/expedientes-schema.ts` (o `auth-schema.ts` con `pnpm auth:generate`).
2. `pnpm db:generate` crea un SQL nuevo en `drizzle/`. Revísalo y súbelo en el mismo PR.
3. Se aplican solas al desplegar: Vercel corre `pnpm vercel-build` (`migrar.mjs` y luego `next build`) contra la base de cada entorno.

Nunca edites una migración ya aplicada: crea una nueva.

### Respaldo

El plan gratuito de Neon no protege la rama `production` y solo permite restaurar unas horas hacia atrás. Antes de cargar datos reales, y luego cada semana, saca un respaldo (necesita `pg_dump` de la misma versión mayor de Postgres que tu proyecto en Neon):

```bash
# Respaldo (formato comprimido de pg_dump); la carpeta respaldos/ está en .gitignore
pg_dump "$DATABASE_URL_UNPOOLED" -Fc --no-owner -f respaldos/rutaobra-$(date +%F).dump

# Restaurar en una base vacía (por ejemplo, una rama nueva de Neon)
pg_restore --no-owner --clean --if-exists -d "<URL de la base destino>" respaldos/rutaobra-AAAA-MM-DD.dump
```

Los archivos de R2 no entran en el respaldo de la base: se pueden copiar con `rclone` o con la API de S3. Los respaldos contienen datos personales (Ley 29733): guárdalos cifrados y fuera del repositorio.

## Flujo de trabajo

- Solo vive `master`, protegido: todo cambio entra por **rama → PR → CI verde → squash merge**. La rama se borra al fusionar y un workflow semanal limpia las que queden.
- El CI tiene dos checks obligatorios: **data** (validación, simulación y paridad de `resultados-motor.json`) y **app** (lint, typecheck, pruebas con cobertura, build y e2e).
- Commits en Conventional Commits: `feat:`, `fix:`, `docs:`, `data:` para cambios en `data/`.
- Cada cambio en `data/` o `fixtures/casos.json` necesita `validate_data.py`, `simulate.py` y `simulate.py --export`. Los montos y requisitos nunca se actualizan sin revisión humana.

## Vigilancia de fuentes

Cada lunes a las 07:00 (Lima) el workflow **Vigilancia de fuentes** revisa las URLs de `data/fuentes.json` y actualiza el issue "Vigilancia de fuentes" (etiqueta `vigilancia-datos`): caídas, cambios con los datos afectados, fuentes sin revisar hace más de 180 días y recordatorios (UIT, TUPAs y programas antiguos). No cambia datos: cada novedad se corrige con un PR `data:` y, al revisar la fuente, se actualiza su `fecha_consulta`. Se puede correr a mano desde Actions; con la opción `dry_run` solo imprime el reporte.

### Antigüedad y reportes de usuarios

- Cada fuente muestra "Revisado el dd/mm/aaaa". Un dato `verificado` cuya fuente lleva más de 12 meses sin revisarse se muestra como "Versión anterior" con el aviso "Sin revisar desde hace más de 12 meses". El umbral está en `data/meta.json` (`vigencia_verificacion_meses`); `/fuentes` cuenta los datos vencidos por archivo.
- Cada paso de la hoja de ruta y cada monto del distrito tienen el enlace "¿Este dato cambió? Repórtalo". Abre el Google Form de RutaObra con los datos prellenados (se cambia con `NEXT_PUBLIC_REPORTE_URL`, ver `.env.example`); si se quita el formulario, un correo prellenado a `NEXT_PUBLIC_CORREO_REPORTE` (por defecto, angel.xp.pb@gmail.com). Las respuestas se ven en la pestaña "Respuestas" del formulario. Cada reporte se pasa a un issue con la plantilla "Dato desactualizado" (etiqueta `vigilancia-datos`) y luego a un PR `data:`.

## Despliegue

Vercel despliega solo: cada PR genera una vista previa (con la rama `preview` de Neon y sin indexar en buscadores) y cada merge a `master` va a producción. Las migraciones corren en el build. Para revisar un despliegue: `vercel ls` y `vercel inspect <url>`.

## Cobertura de datos

- **Nacional:** 7 etapas, 50 procedimientos, 42 documentos, 22 instituciones, 3 zonas especiales, 5 programas, 47 reglas.
- **Distrital:** La Molina (completo, referencia), Surco (parcial), Chorrillos y Villa El Salvador (estructura y códigos; montos por extraer).
- Cada dato tiene `fuente_id` y `estado_verificacion`. Lo pendiente está en [docs/modelo-datos.md](docs/modelo-datos.md).

## Aviso

Información referencial. No es asesoría legal. Confirma montos y plazos en el TUPA vigente de cada entidad.
