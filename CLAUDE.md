# CLAUDE.md — RutaObra

Instrucciones para Claude Code en este repo. Léelas completas antes de cada tarea.

@AGENTS.md

## Qué es

Prototipo de validación de un orquestador de trámites de construcción en Perú (saneamiento → licencia → obra → conformidad). Producto y alcance: `docs/PRD.md`. Datos: `docs/modelo-datos.md`.

## Stack (decidido)

- **Next.js 15+ (App Router) + TypeScript estricto** (`"strict": true`, sin `any`).
- **Tailwind CSS + shadcn/ui** para la UI. Íconos: `lucide-react`.
- **Zod** para validar los JSON de `data/` al cargarlos y los formularios.
- **react-hook-form** para el diagnóstico y las fichas.
- **Vitest** para el dominio. **Playwright** solo para 1–2 flujos críticos.
- **date-fns** para fechas (días hábiles).
- Despliegue: **Vercel**. Gestor de paquetes: `pnpm`.
- **Datos de usuario (desde la Fase 5):** Postgres en **Neon** con **Drizzle ORM** (migraciones en `drizzle/`), cuentas con **Better Auth** (tablas en el mismo Postgres; Google + enlace mágico por correo con Resend) y archivos en **Cloudflare R2** usando la API de S3 (`@aws-sdk/client-s3`). Elegidos por ser gratuitos ahora y portables a AWS (RDS/Aurora, S3) cuando se construya el agente.
- `localStorage` solo para el **modo invitado y demo** (sin cuenta), detrás del mismo repositorio.
- La base de conocimiento sigue en `data/` (JSON en git). No se mueve a la base de datos.

## Arquitectura (respetarla)

```
data/                 # Base de conocimiento (JSON). Fuente de verdad. NO editar desde la app.
schema/               # JSON Schema de data/ y del modelo de usuario (expediente)
fixtures/casos.json   # Casos de prueba del motor (esperados)
fixtures/demo.json    # Expedientes del modo demo (referencian casos.json)
scripts/              # Python: validate_data.py, export_excel.py, simulate.py (motor de referencia)
src/
  domain/             # TypeScript PURO: sin React, sin Next, sin fetch, sin localStorage
    types.ts          # Tipos derivados de los esquemas Zod
    schemas.ts        # Zod de cada archivo de data/ y de Expediente
    rules-engine.ts   # cumple(), diagnosticar()  <- replica EXACTA de scripts/simulate.py
    roadmap.ts        # arma la hoja de ruta con tarifas por distrito, totales y fuentes
    checklist.ts      # une requisitos, calcula vencimientos
    alerts.ts         # alertas por vencimiento y por reglas
    expediente.ts     # crear, actualizar, migrar y resumir expedientes
    analisis.ts       # todo lo derivado de un expediente (ruta, checklist, alertas, resumen)
    demo.ts           # expedientes de ejemplo (fixtures/demo.json) con fechas relativas a hoy
    business-days.ts  # días hábiles
  data/               # Capa de datos (patrón Repository)
    knowledge-repo.ts # carga y valida data/*.json (en build: import estático)
    expediente-repo.ts          # interfaz ExpedienteRepository
    expediente-repo.local.ts    # implementación localStorage (modo invitado y demo)
    expediente-repo.db.ts       # implementación Postgres/Drizzle (servidor; Fase 5)
    expediente-repo.remoto.ts   # implementación cliente que llama a Server Actions (Fase 5)
    db/schema.ts  db/client.ts  # Drizzle (solo servidor: import "server-only")
    archivos.ts                 # R2 vía API de S3, URLs prefirmadas (solo servidor)
  features/           # UI por funcionalidad
    diagnostico/  hoja-de-ruta/  checklist/  expedientes/  bitacora/  alertas/  fuentes/
  components/ui/      # shadcn
drizzle/              # migraciones SQL versionadas (drizzle-kit)
app/                  # Rutas Next.js (App Router)
  page.tsx                          # landing + CTA "Diagnosticar mi predio"
  diagnostico/page.tsx  diagnostico/resultado/  diagnostico/hoja-de-ruta/
  expedientes/page.tsx              # tablero multi-expediente
  expedientes/nuevo/page.tsx        # ficha para crear un expediente desde el diagnóstico
  expedientes/[id]/page.tsx         # ruta + checklist + alertas + datos (+ bitácora) en tabs
  expedientes/acciones.ts           # Server Actions (Fase 5)
  api/auth/[...all]/route.ts        # Better Auth (Fase 5)
  ingresar/  privacidad/            # Fase 5
  demo/page.tsx                     # modo demo: 3 expedientes de ejemplo en el navegador (Fase 7)
  fuentes/page.tsx
```

Reglas:
1. **El dominio es puro y testeado.** Toda lógica de negocio va en `src/domain`. Los componentes no deciden modalidades ni filtran reglas.
2. **Las reglas viven en `data/reglas.json`**, no en `if` del código. Si falta una regla, se agrega al JSON (y un caso a `fixtures/casos.json`).
3. **Paridad con el motor Python.** `rules-engine.ts` debe dar el mismo resultado que `scripts/simulate.py` para todos los `fixtures/casos.json`. Hay un test que lo verifica.
4. **Nunca mostrar un dato como cierto si su `estado_verificacion` no es `verificado`.** Se muestra con etiqueta ("Por confirmar", "Referencial", "Versión anterior") y enlace a la fuente.
5. **Montos:** usar `tarifas_distritales.json` del ubigeo; si no hay, `costo_referencial` del procedimiento; si tampoco, "Consultar TUPA". Nunca inventar montos.
6. **Repository:** la UI solo usa `ExpedienteRepository`. Cambiar de backend (local → Neon → AWS) debe ser solo una nueva implementación; las mismas pruebas de contrato corren contra todas.
7. **Semántica de condiciones** (idéntica al Python): campo ausente o null → `false` (salvo `existe: false`); `todas: []` → `true`; modalidad = primera regla `modalidad` que cumpla, ordenada por `orden`; `_modalidad` se inyecta antes de evaluar las demás reglas; pasos sin duplicados, ordenados por `etapa.orden`, conservando el orden de aparición dentro de la etapa.
8. **Autorización en el servidor:** toda lectura o escritura de datos de usuario filtra por el estudio de la sesión; un id de otro estudio se trata como inexistente. La base de datos, R2 y los secretos solo se usan en código de servidor (`import "server-only"`); nunca en componentes cliente.

## Comandos

```bash
pnpm dev                          # desarrollo
pnpm test                         # vitest (dominio + paridad con fixtures)
pnpm lint && pnpm typecheck
python scripts/validate_data.py   # antes de commitear cambios en data/
python scripts/simulate.py        # motor de referencia contra fixtures
python scripts/simulate.py --export  # regenerar fixtures/resultados-motor.json (paridad TS)
pnpm test:coverage                # tests + cobertura del dominio (mínimo 90 %)
python scripts/watch_sources.py --dry-run  # vigilancia de fuentes (Fase 8), sin tocar GitHub
python scripts/extract_tupa.py --ubigeo <ubigeo> --pdf <ruta|URL> --dry-run  # extracción de TUPA con IA (Fase 10)
python -m pytest scripts/tests    # pruebas de los scripts de Python
python scripts/export_excel.py    # regenerar data/ruta-obra.xlsx
pnpm e2e                          # Playwright a 375 px
pnpm db:generate                  # (Fase 5) generar migración desde src/data/db/schema.ts
pnpm db:migrate                   # (Fase 5) aplicar migraciones (usa DATABASE_URL_UNPOOLED)
```

Variables de entorno: ver `.env.example` (Fase 5). Nunca commitear valores; en Vercel se cargan por entorno (producción y preview).

## Convenciones

- Código y nombres de archivos en inglés; **textos de UI y datos en español (Perú)**.
- Commits: Conventional Commits (`feat:`, `fix:`, `data:` para cambios de datos).
- Cada cambio en `data/` o `fixtures/casos.json` → correr `validate_data.py`, `simulate.py` y `simulate.py --export` (CI falla si `resultados-motor.json` no está al día).
- Fechas de UI `dd/mm/aaaa`; moneda `S/ 1,234.50`.
- Móvil primero; probar a 375 px.

## Qué NO hacer

- No agregar pagos ni facturación en el prototipo.
- No guardar datos de clientes solo en el navegador: `localStorage` es para el modo invitado y demo.
- No acceder a la base de datos ni a R2 desde componentes cliente, ni exponer secretos al navegador.
- No editar una migración ya aplicada: se crea una nueva.
- No llamar APIs del Estado ni hacer scraping desde la app.
- No mover lógica de negocio a componentes.
- No borrar `estado_verificacion` ni `fuente_id` de ningún dato.
- No actualizar montos ni requisitos automáticamente sin revisión humana: lo extraído o reportado entra como `por_verificar` por PR `data:` (ver "Reglas del mantenimiento de datos" en `prompts/fases.md`).

## Migración a AWS (Fase 11, con el agente)

Neon → RDS o Aurora Postgres (`pg_dump` / `pg_restore`; Drizzle no cambia). R2 → S3 (mismo SDK; cambian endpoint y credenciales). Better Auth se queda (sus tablas viajan con la base de datos). Modelo de IA vía Amazon Bedrock o API de Anthropic. El dominio y las pantallas no cambian.

## Si algún día migras a Angular

El dominio (`src/domain`) es TypeScript puro y se copia tal cual. Equivalencias: App Router → Angular Router con standalone components; react-hook-form → Reactive Forms; `ExpedienteRepository` → servicio `@Injectable` con la misma interfaz; SSR/SEO → `@angular/ssr`; shadcn → Angular Material o Spartan UI. Los datos y los esquemas no cambian.
