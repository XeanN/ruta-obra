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
- Sin backend en el prototipo: datos de usuario en `localStorage` detrás de un repositorio.

## Arquitectura (respetarla)

```
data/                 # Base de conocimiento (JSON). Fuente de verdad. NO editar desde la app.
schema/               # JSON Schema de data/ y del modelo de usuario (expediente)
fixtures/casos.json   # Casos de prueba del motor (esperados)
scripts/              # Python: validate_data.py, export_excel.py, simulate.py (motor de referencia)
src/
  domain/             # TypeScript PURO: sin React, sin Next, sin fetch, sin localStorage
    types.ts          # Tipos derivados de los esquemas Zod
    schemas.ts        # Zod de cada archivo de data/ y de Expediente
    rules-engine.ts   # cumple(), diagnosticar()  <- replica EXACTA de scripts/simulate.py
    roadmap.ts        # arma la hoja de ruta con tarifas por distrito, totales y fuentes
    checklist.ts      # une requisitos, calcula vencimientos
    alerts.ts         # alertas por vencimiento y por reglas
    business-days.ts  # días hábiles
  data/               # Capa de datos (patrón Repository)
    knowledge-repo.ts # carga y valida data/*.json (en build: import estático)
    expediente-repo.ts          # interfaz ExpedienteRepository
    expediente-repo.local.ts    # implementación localStorage (prototipo)
  features/           # UI por funcionalidad
    diagnostico/  hoja-de-ruta/  checklist/  expedientes/  bitacora/  alertas/  fuentes/
  components/ui/      # shadcn
app/                  # Rutas Next.js (App Router)
  page.tsx                          # landing + CTA "Diagnosticar mi predio"
  diagnostico/page.tsx
  expedientes/page.tsx              # tablero multi-expediente
  expedientes/[id]/page.tsx         # ruta + checklist + alertas + bitácora (tabs)
  fuentes/page.tsx
```

Reglas:
1. **El dominio es puro y testeado.** Toda lógica de negocio va en `src/domain`. Los componentes no deciden modalidades ni filtran reglas.
2. **Las reglas viven en `data/reglas.json`**, no en `if` del código. Si falta una regla, se agrega al JSON (y un caso a `fixtures/casos.json`).
3. **Paridad con el motor Python.** `rules-engine.ts` debe dar el mismo resultado que `scripts/simulate.py` para todos los `fixtures/casos.json`. Hay un test que lo verifica.
4. **Nunca mostrar un dato como cierto si su `estado_verificacion` no es `verificado`.** Se muestra con etiqueta ("Por confirmar", "Referencial", "Versión anterior") y enlace a la fuente.
5. **Montos:** usar `tarifas_distritales.json` del ubigeo; si no hay, `costo_referencial` del procedimiento; si tampoco, "Consultar TUPA". Nunca inventar montos.
6. **Repository:** la UI solo usa `ExpedienteRepository`. Cambiar a Supabase después debe ser solo una nueva implementación.
7. **Semántica de condiciones** (idéntica al Python): campo ausente o null → `false` (salvo `existe: false`); `todas: []` → `true`; modalidad = primera regla `modalidad` que cumpla, ordenada por `orden`; `_modalidad` se inyecta antes de evaluar las demás reglas; pasos sin duplicados, ordenados por `etapa.orden`, conservando el orden de aparición dentro de la etapa.

## Comandos

```bash
pnpm dev                          # desarrollo
pnpm test                         # vitest (dominio + paridad con fixtures)
pnpm lint && pnpm typecheck
python scripts/validate_data.py   # antes de commitear cambios en data/
python scripts/simulate.py        # motor de referencia contra fixtures
python scripts/simulate.py --export  # regenerar fixtures/resultados-motor.json (paridad TS)
pnpm test:coverage                # tests + cobertura del dominio (mínimo 90 %)
python scripts/export_excel.py    # regenerar data/ruta-obra.xlsx
```

## Convenciones

- Código y nombres de archivos en inglés; **textos de UI y datos en español (Perú)**.
- Commits: Conventional Commits (`feat:`, `fix:`, `data:` para cambios de datos).
- Cada cambio en `data/` o `fixtures/casos.json` → correr `validate_data.py`, `simulate.py` y `simulate.py --export` (CI falla si `resultados-motor.json` no está al día).
- Fechas de UI `dd/mm/aaaa`; moneda `S/ 1,234.50`.
- Móvil primero; probar a 375 px.

## Qué NO hacer

- No agregar backend, auth ni pagos en el prototipo.
- No llamar APIs del Estado ni hacer scraping desde la app.
- No mover lógica de negocio a componentes.
- No borrar `estado_verificacion` ni `fuente_id` de ningún dato.

## Si algún día migras a Angular

El dominio (`src/domain`) es TypeScript puro y se copia tal cual. Equivalencias: App Router → Angular Router con standalone components; react-hook-form → Reactive Forms; `ExpedienteRepository` → servicio `@Injectable` con la misma interfaz; SSR/SEO → `@angular/ssr`; shadcn → Angular Material o Spartan UI. Los datos y los esquemas no cambian.
