# Prompts por fase para Claude Code

Úsalos en orden, uno por sesión o por rama. Cada uno termina con criterios de aceptación: no pases a la siguiente fase sin cumplirlos. Antes de empezar, Claude Code debe leer `CLAUDE.md`.

## Estado y orden

| Fase | Qué entrega | Estado | Orden sugerido |
|---|---|---|---|
| 0 | Setup del proyecto + CI | Hecha (#1) | — |
| 1 | Dominio, motor de reglas y paridad con Python | Hecha (#2) | — |
| 2 | Diagnóstico (F1) | Hecha (#3) | — |
| 3 | Hoja de ruta (F2) y fuentes (F7) | Hecha (#5) | — |
| 4 | Expedientes, checklist y alertas (F3, F4, F5), guardados en el navegador | Hecha (#8) | — |
| 5 | Backend, cuentas y persistencia (F8): Neon + Cloudflare R2 + Better Auth | Hecha (#10); ingreso probado en producción | — |
| 6 | Bitácora de obra (F6), con fotos en R2 | Hecha (#11) | — |
| 7 | Landing, pulido, modo demo y despliegue | Hecha (#13) | — |
| 8 | Vigilancia automática de fuentes | Hecha (#16) | — |
| 9 | Antigüedad visible y "Reportar un dato desactualizado" | Hecha | — |
| 10 | Extracción asistida por IA de TUPAs | Pendiente | **Siguiente**, cuando haya que cargar distritos nuevos o la Fase 8 detecte un TUPA nuevo |
| 11 | Agente de consultas y migración a AWS | Futuro | Después de validar con profesionales (ver PRD, sección 9) |

**Dónde vive cada dato** (detalle en `docs/PRD.md`, sección 6):
- Base de conocimiento (trámites, tarifas, reglas): JSON en `data/`, versionado en git y revisado por PR. No va a la base de datos.
- Datos de los usuarios (expedientes, predios, actores, pasos, documentos, bitácora): Postgres en Neon desde la Fase 5.
- Archivos (fotos de obra, documentos escaneados): Cloudflare R2 desde la Fase 5.
- Navegador (`localStorage`): solo el modo invitado y el modo demo. Al crear cuenta se ofrece subir lo que haya en el navegador.

Las fases 8 a 10 forman el **ciclo de mantenimiento de datos**: la 8 detecta qué cambió, el flujo de actualización con revisión (ver "Prompts de mantenimiento") lo corrige con un PR `data:`, la 9 hace visible la antigüedad y recoge reportes de los usuarios, y la 10 acelera la carga de montos nuevos. Ninguna cambia datos sin revisión humana (ver "Reglas del mantenimiento de datos").

---

## Fase 0: Setup del proyecto

```
Lee CLAUDE.md, docs/PRD.md y docs/modelo-datos.md.
Inicializa en este repo (sin borrar data/, schema/, scripts/, fixtures/, docs/, prompts/) un proyecto
Next.js con App Router, TypeScript estricto, Tailwind, ESLint, pnpm, alias @/* -> src/*.
Instala shadcn/ui (button, card, badge, tabs, dialog, input, select, radio-group, progress, sheet,
table, toast), lucide-react, zod, react-hook-form, @hookform/resolvers, date-fns, vitest.
Crea la estructura de carpetas de CLAUDE.md con archivos index vacíos.
Scripts package.json: dev, build, test, lint, typecheck.
```
**Aceptación:** `pnpm dev` levanta; `pnpm typecheck` y `pnpm test` pasan (aunque todavía no haya tests).

**Entregado (#1):**
- Next.js 16 (App Router, Turbopack), TypeScript estricto (`noUncheckedIndexedAccess`), Tailwind v4, ESLint, pnpm; alias `@/*` → `src/*` y `@data/*` → `data/*`.
- shadcn/ui sobre Base UI (`toast` reemplazado por `sonner`), lucide-react, zod, react-hook-form, date-fns, Vitest.
- CI (`.github/workflows/ci.yml`): job `data` (validate_data.py, simulate.py, resultados-motor.json al día) y job `app` (lint, typecheck, tests con cobertura, build, Playwright). Ambos obligatorios en el ruleset de `master`, sin bypass.
- Flujo: rama → PR → CI verde → squash merge; la rama se borra al fusionar y `cleanup-branches.yml` borra cada lunes las ramas sin PR abierto.
- Vercel: producción en cada merge a `master` y vista previa por PR.

---

## Fase 1: Dominio y paridad con el motor Python

```
Implementa src/domain:
1. schemas.ts: esquemas Zod de TODOS los archivos de data/ según schema/data.schema.json, y de
   Expediente, Paso, DocumentoCargado, EntradaBitacora y Alerta según schema/expediente.schema.json.
   types.ts exporta los tipos inferidos.
2. data/knowledge-repo.ts: importa los JSON estáticamente, los valida con Zod al cargar y expone
   getters tipados (getProcedimiento(id), getTarifas(ubigeo, procId), etc.).
3. rules-engine.ts: cumple(cond, respuestas) y diagnosticar(respuestas) con la MISMA semántica que
   scripts/simulate.py (ver la sección "Semántica de condiciones" de CLAUDE.md).
4. Test de paridad: por cada caso de fixtures/casos.json verifica modalidad, incluye, excluye y alertas.
5. business-days.ts: sumar días hábiles (lunes a viernes) + tests.
```
**Aceptación:** 6/6 casos de `fixtures/casos.json` pasan en Vitest; cobertura del dominio ≥ 90 %.

**Entregado (#2):**
- `schemas.ts` y `types.ts`: los 14 archivos de `data/` y el modelo de expedientes; si un JSON no cumple, el build falla con un mensaje claro.
- `knowledge-repo.ts`: carga validada y getters tipados.
- `rules-engine.ts`: réplica de `simulate.py`, incluidas sus particularidades (bool como 0/1, el primer operador presente gana).
- Paridad **completa**: `python scripts/simulate.py --export` escribe `fixtures/resultados-motor.json` y el test compara la salida entera (pasos, orden, opcionales, alternativas, alertas, programas). CI falla si el archivo no está al día.
- `business-days.ts`: sumar y contar días hábiles, con feriados opcionales.

---

## Fase 2: Diagnóstico (F1)

```
Crea app/diagnostico con un asistente paso a paso (una pregunta por pantalla en móvil) que lee
data/diagnostico_preguntas.json, respeta mostrar_si (igual / en), valida con Zod y muestra progreso.
Al terminar llama a diagnosticar() y muestra: modalidad con explicación, alertas por nivel
(crítica / alta / media) y programas aplicables. Botones: "Ver mi hoja de ruta" y "Guardar como expediente".
Las respuestas se guardan en el estado de la URL o en sessionStorage para no perderlas al recargar.
```
**Aceptación:** el caso `caso-angel` ingresado a mano da modalidad B y las alertas A-TITULO-BLOQUEA y A-PANTANOS. Se ve bien a 375 px.

**Entregado (#3, #4):**
- `domain/diagnostico.ts`: preguntas visibles, limpieza de respuestas ocultas, validación con Zod, respuestas en la URL y resumen del resultado.
- `/diagnostico`: una pregunta por pantalla con progreso, Atrás, Omitir y Siguiente; el avance vive en la URL (recargar o compartir no pierde nada).
- `/diagnostico/resultado`: modalidad explicada con su licencia (alcance, plazo, etiqueta, fuentes), alertas por prioridad, programas y respuestas editables una por una.
- Componentes reutilizables: etiqueta de estado de verificación y enlaces a fuentes.
- Playwright a 375 px con el caso real de referencia.
- PR `data:` (#4): tildes y signos de apertura en todos los textos visibles, sin tocar ids ni valores.

---

## Fase 3: Hoja de ruta (F2) y fuentes (F7)

```
Implementa domain/roadmap.ts: a partir del resultado de diagnosticar() y el ubigeo arma pasos
enriquecidos: procedimiento, institución, requisitos (documentos), plazo, costo (regla: tarifa del
distrito > costo_referencial > "Consultar TUPA"), variantes de tarifa, profesionales, normas,
fuentes y estado_verificacion. Totales: suma de montos conocidos, cuántos montos faltan y días
hábiles estimados (suma de plazos conocidos).
UI: línea de tiempo vertical por etapa (E1–E7) con tarjetas plegables; badge de estado de
verificación (verde / ámbar / naranja / rojo, según CLAUDE.md); enlace "Fuente" en cada dato;
alternativas como "También puedes: …"; opcionales marcados.
Crea app/fuentes con fuentes.json, normas.json, fecha de corte y aviso legal.
```
**Aceptación:** ningún monto aparece sin fuente; los datos `por_verificar` nunca se muestran como ciertos; los tests de roadmap pasan.

**Entregado (#5):**
- `domain/roadmap.ts`: pasos por etapa con entidad (la municipalidad concreta si es distrital), plazo, costo, requisitos, resultados, normas, fuentes y alternativas; totales de costo (rango), montos faltantes, montos no verificados, días hábiles y plazos faltantes.
- Costo: si el TUPA tiene varias variantes se muestra el rango (no se elige una variante en código). Un monto sin fuente no se muestra como monto.
- `/diagnostico/hoja-de-ruta`: línea de tiempo E1–E7 con tarjetas plegables.
- `/fuentes`: fecha de corte, etiquetas, cobertura por distrito, normas y fuentes por tipo, aviso legal.
- Invariante probada: ningún monto sin fuente en los 6 casos × 4 distritos + sin distrito.
- Pendiente de datos que la app deja a la vista: montos de Chorrillos y Villa El Salvador (Fase 10 o carga manual). Si se quiere el monto exacto en vez del rango, agregar a `reglas.json` reglas que elijan la variante según las respuestas.

---

## Fase 4: Expedientes, checklist y alertas (F3, F4, F5)

```
1. Repositorio (patrón Repository; la UI solo conoce la interfaz):
   - src/data/expediente-repo.ts: interfaz ExpedienteRepository con listar, obtener(id), crear,
     actualizar, eliminar, exportar(id) -> JSON e importar(JSON).
   - src/data/expediente-repo.local.ts: implementación con localStorage.
     * Todo acceso en try/catch (modo incógnito, almacenamiento lleno o bloqueado): la UI muestra un
       aviso y no se rompe.
     * Valida con ExpedienteSchema (Zod) al leer; un expediente corrupto se separa y se avisa, no
       tumba el tablero.
     * Migración por version_datos: si el expediente se creó con datos anteriores, se recalculan los
       pasos con el motor actual conservando estado, fechas, n.° de trámite y montos pagados de los
       pasos que siguen existiendo; los que ya no aplican se marcan, no se borran.
   - Pasar a Supabase después debe ser solo otra implementación de la misma interfaz.
2. Crear un expediente:
   - Se activan los botones "Guardar como expediente" del resultado y de la hoja de ruta; llevan las
     respuestas por URL a /expedientes/nuevo.
   - Ficha con react-hook-form + Zod: nombre del expediente, dirección, distrito (prellenado desde el
     diagnóstico), partida registral y actores (rol, nombre, teléfono, correo, colegiatura CAP/CIP).
   - Guarda respuestas, modalidad, version_datos y los pasos del motor en estado "pendiente".
3. Tablero /expedientes (domain/expediente.ts calcula todo, la UI solo muestra):
   - Tarjeta por expediente: nombre, distrito, modalidad, etapa actual (la primera con pasos sin
     cerrar), % de avance (pasos aprobados o "no aplica" sobre el total, sin opcionales), próximo
     paso y próximas 3 alertas.
   - Filtros por distrito y por estado (en curso, con alertas, terminado). Estado vacío con botón al
     diagnóstico.
4. Detalle /expedientes/[id] con pestañas:
   - Ruta: la hoja de ruta de la Fase 3 más el estado de cada paso (pendiente, en preparación,
     presentado, observado, subsanado, aprobado, denegado, no aplica), n.° de trámite en la
     entidad, fecha de presentación, de observación y de resultado, monto pagado y notas.
   - Checklist (domain/checklist.ts): requisitos de todos los pasos sin duplicados, con quién lo
     emite y su vigencia; estado falta / en trámite / obtenido / vencido; con la fecha de emisión
     calcula el vencimiento (vigencia_dias de documentos.json, p. ej. copia literal 30 días) y pasa
     a "vencido" solo.
   - Alertas (domain/alerts.ts, puro, "hoy" como parámetro): vencimientos de vencimientos.json con
     aviso en los días de alertar_dias_antes; paso "observado" -> 5 días hábiles para subsanar
     desde la fecha de observación (business-days.ts); alertas del diagnóstico. Ordenadas por fecha
     y nivel.
   - Datos: predio y actores editables.
5. Respaldo: exportar un expediente como archivo JSON e importarlo (validado con Zod; si el id
   existe, preguntar si reemplazar o duplicar).
6. Tests de dominio (expediente, checklist, alerts) con fechas fijas; Playwright: crear desde el
   diagnóstico, marcar una observación y ver la alerta, recargar y que siga.
```
**Aceptación:** crear 3 expedientes de prueba, marcar una observación y ver la alerta de 5 días hábiles; recargar la página no pierde nada; con `localStorage` bloqueado la app avisa y no se rompe; cobertura del dominio ≥ 90 %.

**Entregado (#8):**
- Dominio puro: `expediente.ts` (crear, pasos, documentos, datos, migración por `version_datos`, resumen), `checklist.ts`, `alerts.ts` (vencimientos y plazo de subsanación según `vencimientos.json`) y `analisis.ts`.
- `ExpedienteRepository` y su implementación con `localStorage` (validación Zod, registros corruptos conservados, almacenamiento bloqueado controlado, exportar e importar respaldos).
- Tablero con filtros, detalle con pestañas Ruta / Checklist / Alertas / Datos, seguimiento de cada trámite.
- Limitación conocida, resuelta en la Fase 5: los datos viven solo en el navegador (se pierden al borrarlo, no se comparten entre personas ni equipos).

---

## Fase 5: Backend, cuentas y persistencia (F8)

Objetivo: que los expedientes vivan en un servidor, con cuentas y estudios de varias personas, sin cambiar las pantallas (la UI solo usa `ExpedienteRepository`). Stack gratuito ahora y fácil de llevar a AWS después (ver PRD, sección 6).

Antes de empezar, la persona dueña del proyecto crea las cuentas y pasa las variables (nunca al repo):
- Neon: proyecto en la región más cercana disponible (São Paulo si existe; si no, us-east). Una rama `main` para producción y otra `preview` para las vistas previas de Vercel. Variables: `DATABASE_URL` (con pooling) y `DATABASE_URL_UNPOOLED` (para migraciones).
- Cloudflare R2: bucket privado `rutaobra-archivos` y un token de API con permiso solo sobre ese bucket. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- Google Cloud: cliente OAuth (pantalla de consentimiento con el dominio de Vercel). Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Correo para enlaces de acceso: Resend (plan gratuito). Variable: `RESEND_API_KEY` y remitente verificado.
- `BETTER_AUTH_SECRET` (aleatorio) y `BETTER_AUTH_URL`.
Las variables se cargan en Vercel (producción y preview) y en `.env.local` para desarrollo; `.env.example` lista los nombres sin valores.

```
1. Base de datos (Neon Postgres + Drizzle ORM):
   - src/data/db/schema.ts con Drizzle, mapeado 1:1 a schema/expediente.schema.json:
     estudios (id, nombre, creado_en), miembros (estudio_id, usuario_id, rol: dueno | miembro),
     predios, expedientes (estudio_id, predio_id, nombre, respuestas_diagnostico jsonb, modalidad,
     version_datos, creado_por, creado_en, actualizado_en), pasos, actores, documentos_cargados,
     entradas_bitacora, archivos (estudio_id, expediente_id, clave_r2, tipo, tamano, creado_por).
     Claves foráneas con ON DELETE CASCADE desde expediente; índices por estudio_id y expediente_id.
   - Migraciones versionadas en drizzle/ generadas con drizzle-kit (pnpm db:generate) y aplicadas con
     pnpm db:migrate usando DATABASE_URL_UNPOOLED. Nunca editar una migración ya aplicada.
   - src/data/db/client.ts: cliente @neondatabase/serverless + drizzle, solo en servidor
     (import "server-only").
2. Cuentas (Better Auth, tablas en el mismo Postgres):
   - Ingreso con Google y con enlace mágico por correo (Resend). Sin contraseñas.
   - Al primer ingreso se crea el estudio personal del usuario ("Estudio de <nombre>") y queda como
     dueño. El dueño puede invitar por correo a otros miembros; todos ven los expedientes del estudio.
   - app/api/auth/[...all]/route.ts, app/ingresar/page.tsx y menú de cuenta en el encabezado.
   - Rutas /expedientes protegidas: sin sesión, modo invitado (ver punto 5).
3. Repositorio en el servidor:
   - src/data/expediente-repo.db.ts implementa ExpedienteRepository con Drizzle. TODA consulta filtra
     por el estudio de la sesión; un id de otro estudio se responde como "no existe".
   - Server Actions (app/expedientes/acciones.ts) que validan la sesión y la entrada con Zod y
     llaman al repositorio; src/data/expediente-repo.remoto.ts implementa la misma interfaz en el
     cliente llamando a esas acciones. Las pantallas no cambian: solo el proveedor elige la
     implementación (remota con sesión, local sin sesión).
   - Concurrencia: actualizar() recibe actualizado_en y rechaza si otro miembro guardó antes
     ("Este expediente cambió, recarga para ver la última versión").
   - Tests de contrato: la misma batería de tests corre contra la versión local y contra la de base
     de datos (Postgres de prueba en CI con un servicio de GitHub Actions o rama efímera de Neon),
     incluido "un estudio no ve ni modifica expedientes de otro".
4. Archivos (Cloudflare R2 con la API de S3, @aws-sdk/client-s3):
   - src/data/archivos.ts: subir con URL prefirmada (PUT, 5 min, máximo 10 MB, solo imágenes y PDF),
     descargar con URL prefirmada (GET, 10 min). Claves: <estudio_id>/<expediente_id>/<uuid>.<ext>.
     Bucket privado: nunca enlaces públicos.
   - El mismo código funcionará con AWS S3 cambiando solo endpoint y credenciales.
5. Modo invitado y migración sin pérdida:
   - Sin sesión, los expedientes siguen en localStorage (como hoy) con un aviso: "Se guardan solo
     en este navegador. Crea tu cuenta para no perderlos y compartirlos con tu equipo."
   - Al iniciar sesión, si hay expedientes en el navegador: "Subir N expedientes a tu cuenta". Se
     suben uno por uno (validados), se informa el resultado y solo entonces se ofrece borrarlos del
     navegador. El respaldo JSON sigue disponible.
6. Datos personales (Ley 29733):
   - Página /privacidad: qué datos se guardan, para qué, dónde (proveedores y país), cuánto tiempo,
     cómo pedir acceso, corrección o eliminación, y contacto del responsable.
   - Consentimiento al crear la cuenta y aviso al registrar datos de terceros (propietarios,
     profesionales): "Registra solo los datos necesarios y con autorización de la persona".
   - Eliminar la cuenta borra los expedientes y archivos del estudio (si el usuario es el único
     dueño), con confirmación.
   - Revisar con un abogado la inscripción del banco de datos ante la Autoridad Nacional de
     Protección de Datos Personales antes de cargar datos reales de clientes.
7. Seguridad y operación:
   - Secretos solo en variables de entorno; nada de claves en el repo ni en el cliente.
   - La base de datos y R2 solo se usan desde el servidor.
   - Respaldo: script pnpm db:respaldo (pg_dump a un archivo local) documentado en el README; los
     planes gratuitos tienen retención corta: antes de cargar datos reales, decidir plan o rutina de
     respaldo semanal.
   - CI: job app corre migraciones contra la base de prueba y los tests de contrato.
```
**Aceptación:** iniciar sesión con Google o enlace mágico; crear un expediente, cerrar sesión y verlo desde otro navegador al volver a entrar; un segundo miembro invitado al estudio ve y edita el mismo expediente; un usuario de otro estudio no puede verlo ni por URL; los expedientes del modo invitado se suben a la cuenta sin perder pasos, documentos ni fechas; subir y ver una imagen privada desde R2; tests de contrato en verde contra ambas implementaciones; ningún secreto en el repo.

---

## Fase 6: Bitácora de obra (F6)

```
1. Pestaña "Bitácora" en el expediente con alta rápida (pensada para usarse en obra, en el celular):
   tipo (avance, compra, pago, visita municipal, reunión, incidencia, cambio de obra, otro), fecha
   (hoy por defecto), descripción, monto, % de avance y responsable elegido entre los actores.
2. Fotos en Cloudflare R2 (Fase 5): se comprimen en el navegador antes de subir (lado mayor 1600 px,
   JPEG ~80 %), se suben con URL prefirmada y la entrada guarda solo la referencia al archivo. Se
   ven con URL prefirmada temporal. Máximo 10 MB por archivo. En modo invitado (sin cuenta) las
   fotos no se guardan: se invita a crear la cuenta.
3. Vista cronológica (más reciente primero), agrupada por mes, con filtros por tipo y por
   responsable; editar y eliminar entradas (al eliminar, se borran también sus fotos de R2).
4. Totales (domain/bitacora.ts, puro): gasto por tipo y por mes, gasto total, último % de avance
   registrado. Montos en S/ 1,234.50 y fechas dd/mm/aaaa.
5. Tests del dominio de totales; la bitácora (sin las fotos) entra en el respaldo JSON del expediente.
```
**Aceptación:** registrar 10 entradas; los totales cuadran; se ve bien en móvil; una foto tomada con el celular se comprime, se sube a R2 y se ve desde otro equipo del mismo estudio; un usuario de otro estudio no puede abrirla.

---

## Fase 7: Landing, pulido y despliegue

```
1. Landing (app/page.tsx) para profesionales gestores: "Todos tus expedientes de obra, de SUNARP a
   la conformidad, en un solo lugar"; CTA al diagnóstico y al tablero; 3 beneficios (saber qué
   sigue y cuánto cuesta por distrito; no perder documentos por vencimiento; seguir varios
   expedientes y la obra en un solo lugar); un caso real anonimizado (compraventa sin inscribir
   cerca de Pantanos de Villa: qué se descubrió antes de que la municipalidad observara); aviso
   legal y enlace a "Cómo sabemos esto".
2. Modo demo: botón "Ver demo" que carga 3 expedientes de ejemplo desde fixtures (uno en cada
   estado: recién creado, con observación, casi terminado) en el modo invitado (navegador), marcados
   como demo y fáciles de borrar. No toca la base de datos ni requiere cuenta.
3. Accesibilidad: etiquetas en todos los campos, contraste AA, foco visible, navegación por
   teclado, textos alternativos.
4. SEO y compartir: título y descripción por página, Open Graph e imagen para WhatsApp, sitemap y
   robots.
5. README: cómo correr el proyecto, variables de entorno (.env.example), migraciones, respaldo de
   la base de datos, comandos, flujo de PR y despliegue en Vercel.
```
**Aceptación:** Lighthouse móvil ≥ 90 en Performance y Accesibilidad; el modo demo carga en 1 clic.

---

## Fase 8: Vigilancia automática de fuentes

Objetivo: enterarse cada semana de qué fuentes cambiaron, se cayeron o llevan mucho tiempo sin revisarse, **sin cambiar ningún dato**. Corre en GitHub Actions, fuera de la app (respeta "no scraping desde la app").

```
Crea scripts/watch_sources.py y .github/workflows/vigilancia-fuentes.yml.

1. Revisión de URLs (data/fuentes.json):
   - GET a cada url con timeout de 20 s, siguiendo redirecciones, máximo 1 petición por segundo y
     User-Agent que identifique el proyecto (RutaObra-vigilancia + URL del repo).
   - Registra: código HTTP, URL final (si redirige), content-type y una huella sha256 del contenido.
     PDF/binarios: huella de los bytes. HTML: huella del texto visible normalizado (sin scripts,
     estilos ni espacios repetidos), para no dar falsos cambios por tokens o fechas de la página.
   - Clasifica cada fuente en: OK, CAMBIÓ (huella distinta a la anterior), CAÍDA (4xx/5xx, timeout,
     error de red; 2 semanas seguidas para no alarmar por caídas puntuales), REDIRIGE (la URL final
     cambió de dominio o ruta).
2. Impacto: por cada fuente con novedad, lista qué datos dependen de ella (procedimientos.fuentes,
   tarifas_distritales.fuente_id, distritos.tupa.fuente_id, normas.fuente_id, reglas.fuentes,
   programas.fuentes, zonas_especiales.fuentes, vencimientos.fuente_id) con sus ids, para saber
   exactamente qué revisar.
3. Antigüedad: marca las fuentes con fecha_consulta de más de 180 días (umbral en
   meta.json -> "vigilancia": {"dias_sin_revision": 180}), agrupadas por archivo de data/.
4. Recordatorios de calendario (sin red):
   - En enero, si meta.uit.anio < año actual: "Actualizar la UIT del año".
   - Distritos cuyo tupa.anio tenga 2 o más años de antigüedad.
   - Programas con anio < año actual (Techo Propio y otros cambian por convocatoria).
5. Estado entre corridas: NO se commitea nada (master está protegido). El estado (huellas y
   contador de caídas por fuente) se guarda en un bloque oculto
   <!-- estado-vigilancia {...json...} --> dentro del cuerpo del issue de vigilancia; el script lo
   lee al empezar y lo reescribe al terminar.
6. Reporte: UN solo issue abierto con la etiqueta "vigilancia-datos" y título
   "Vigilancia de fuentes". Si ya existe, se actualiza su cuerpo (no se crean duplicados) y se
   agrega un comentario corto solo cuando hay novedades nuevas respecto de la corrida anterior.
   Secciones: 🔴 Caídas, 🟠 Cambiaron (con los datos afectados), 🟡 Sin revisar hace más de 180 días,
   📅 Recordatorios. Cada fuente con su título, URL e id.
7. Workflow: cron semanal (lunes 07:00 hora de Lima) + workflow_dispatch con opción dry_run que
   solo imprime el reporte en el log. Permisos mínimos: contents: read, issues: write.
8. Modo local: python scripts/watch_sources.py --dry-run imprime el reporte sin tocar GitHub.
9. Tests (pytest en scripts/tests/): normalización de HTML, clasificación de estados con respuestas
   simuladas, cálculo de impacto y lectura/escritura del bloque de estado. Agrega pytest al job
   "data" del CI.
```
**Aceptación:** `--dry-run` local imprime el reporte; la primera corrida en Actions crea el issue y la segunda sin cambios lo actualiza sin duplicarlo ni comentar; una fuente con la URL alterada a propósito aparece como CAÍDA a la segunda semana; ningún archivo de `data/` cambia; CI en verde.

**Entregado (#16):**
- `scripts/watch_sources.py` (solo biblioteca estándar) y `.github/workflows/vigilancia-fuentes.yml` (lunes 07:00 de Lima y manual con `dry_run`).
- Estados OK, CAMBIÓ, CAÍDA y REDIRIGE. CAÍDA exige 2 corridas seguidas sin respuesta y al menos 7 días entre la primera y la última (antes se muestra como "sin respuesta esta semana"); un reintento a los 5 s, con timeout de 60 s, evita falsas fallas por límites anti-bots o portales lentos.
- Huella de HTML: solo el contenido principal (`<main>`/`<article>`, o el cuerpo sin menú, encabezado, pie ni barras laterales). Un cambio se confirma solo si la huella nueva se repite en la corrida siguiente: las páginas que varían en cada visita (publicidad, horas con zona horaria) no dan falsas alarmas.
- En el reporte, las caídas llevan el aviso de que un 403, 418 o timeout puede ser un bloqueo a servidores fuera del Perú (la vigilancia corre en GitHub, en EE. UU.).
- Un CAMBIÓ se sigue mostrando hasta que se actualiza la `fecha_consulta` de la fuente en `fuentes.json`, así no se pierde si nadie lo revisó esa semana.
- Los portales con certificado HTTPS inválido se leen igual y se listan aparte.
- Umbral en `meta.json` → `vigilancia.dias_sin_revision`. `python scripts/watch_sources.py --dry-run --estado-local estado.json` simula semanas seguidas en local.
- 20 pruebas con pytest en el job `data` del CI.
- Primera revisión (01/10/2026): MiVivienda (`F-MIVIVIENDA-CSP`) redirige a la portada; `F-DATOS-CONF-MML` apunta a `datosabiertos.gob.pe` sin `www` (no resuelve); `F-DATOS-MML` responde 418 de forma intermitente (límite anti-bots del portal).

---

## Fase 9: Antigüedad visible y "Reportar un dato desactualizado"

Objetivo: que el usuario vea qué tan reciente es cada dato y pueda avisar cuando la realidad no coincide.

```
1. Antigüedad en el dominio (puro, sin Date.now(): "hoy" entra como parámetro):
   - meta.json -> "vigencia_verificacion_meses": 12 (dato, no constante en el código).
   - src/domain/freshness.ts: estadoEfectivo(estado, fechaConsulta, hoy, meses) devuelve
     "desactualizado" si el dato estaba "verificado" pero su fuente se consultó hace más de N
     meses; en otro caso, el estado original. Nunca mejora un estado, solo lo degrada.
   - Úsalo en roadmap.ts (costos, variantes de tarifa) y en el diagnóstico (licencia de la
     modalidad, programas), tomando la fecha_consulta de la fuente del dato.
   - Tests con fechas fijas: justo en el umbral, un día después, dato ya no verificado, fuente
     sin fecha.
2. UI:
   - Junto a cada enlace de fuente: "Revisado el dd/mm/aaaa".
   - Si el estado se degradó por antigüedad, la etiqueta "Versión anterior" lleva un texto de
     ayuda: "Sin revisar desde hace más de 12 meses".
   - En /fuentes: cuántos datos están vencidos por antigüedad, por archivo.
3. Reportar un dato:
   - En cada tarjeta de la hoja de ruta (y en cada monto), enlace "¿Este dato cambió? Repórtalo".
   - Destino configurable con NEXT_PUBLIC_REPORTE_URL (formulario externo, p. ej. Google Forms
     con campos prellenados por query string) y alternativa mailto: con asunto y cuerpo
     prellenados. Datos que se envían: id del procedimiento, ubigeo, variante, monto mostrado,
     URL de la página y un campo libre "¿Qué viste?". Sin datos personales obligatorios.
   - Sin backend: la app solo arma el enlace.
   - .github/ISSUE_TEMPLATE/dato-desactualizado.yml para pasar cada reporte a un issue con la
     etiqueta "vigilancia-datos" y luego a un PR data:.
```
**Aceptación:** un dato `verificado` con fuente consultada hace 13 meses se muestra como "Versión anterior" y uno de 11 meses no; el umbral se cambia solo en `meta.json`; el enlace de reporte abre el formulario o el correo con los datos prellenados; tests del dominio en verde y cobertura ≥ 90 %.

**Entregado:**
- `src/domain/freshness.ts`: `estadoEfectivo()` (el día exacto del umbral todavía vale), `conEstadoEfectivo()` (copia del dato con su estado efectivo y `antiguedad_meses` para explicar la degradación) y `vencidosPorArchivo()` para `/fuentes`. Con varias fuentes, la fecha de revisión es la consulta **más antigua** (criterio conservador).
- La antigüedad se aplica a las tarifas, los costos referenciales y por fórmula, el procedimiento de cada paso y sus alternativas, la licencia de la modalidad, los programas y el TUPA del distrito. `armarHojaDeRuta()` y `resumirDiagnostico()` reciben `hoy`; en el servidor es la fecha de Lima (`src/lib/fecha.ts`) y en los expedientes, la del navegador.
- `meta.json` → `vigencia_verificacion_meses: 12` (obligatorio en `MetaSchema`).
- UI: "Revisado el dd/mm/aaaa" en cada fuente; "Versión anterior" con "Sin revisar desde hace más de 12 meses"; en `/fuentes`, tabla de verificados y vencidos por archivo (la página se regenera cada día).
- `src/domain/reporte.ts`: el enlace se arma sin backend. `NEXT_PUBLIC_REPORTE_URL` admite marcadores `{procedimiento}`, `{ubigeo}`, `{variante}`, `{monto}` y `{pagina}` para los campos prellenados de Google Forms; sin marcadores, los datos van como parámetros; el Google Form de RutaObra es el destino por defecto (`src/features/fuentes/reportar-dato.tsx`); sin formulario, un `mailto:` prellenado a `NEXT_PUBLIC_CORREO_REPORTE` (por defecto, angel.xp.pb@gmail.com). La página citada es siempre la hoja de ruta pública con las respuestas (también desde un expediente, que es privado).
- Enlace en cada paso de la hoja de ruta (pública y del expediente) y en cada monto del distrito.
- `.github/ISSUE_TEMPLATE/dato-desactualizado.yml` con la etiqueta `vigilancia-datos`.

---

## Fase 10: Extracción asistida por IA de TUPAs

Objetivo: cargar montos de un TUPA nuevo en minutos, siempre con revisión humana antes de marcarlos como verificados.

```
Crea scripts/extract_tupa.py (Python, fuera de la app):

1. Entrada: --ubigeo <código> --pdf <ruta o URL> [--fuente-id F-...].
2. Lectura del PDF: texto con pdfplumber página por página. Si una página no tiene texto (PDF
   escaneado), OCR con Tesseract (idioma spa) y marca esas filas con "origen": "ocr" para revisarlas
   con más cuidado.
3. Extracción con la API de Claude (modelo vigente; clave en el secreto ANTHROPIC_API_KEY, nunca en
   el repo) con salida estructurada validada contra el $def "tarifa" de schema/data.schema.json:
   - Solo procedimientos de edificación que existan en procedimientos.json (se le pasa la lista de
     ids y nombres para que mapee; lo que no mapea va a una sección "no reconocidos" del reporte,
     no a los datos).
   - Por fila: procedimiento_id, variante, codigo_tupa, derecho_soles, y la página del PDF donde se
     leyó (se guarda en "nota": "TUPA <año>, pág. N").
   - TODAS las filas con estado_verificacion "por_verificar" y la fuente indicada.
4. Comparación: contra tarifas_distritales.json del ubigeo, clasifica cada fila en NUEVA, CAMBIÓ
   (monto distinto: muestra antes → después) o IGUAL; nunca borra filas existentes.
5. Salida: rama data/tupa-<ubigeo>-<fecha>, commit "data: montos TUPA <distrito> <año> (por
   verificar)" y PR con una tabla por fila (código, procedimiento, variante, monto, página, origen)
   para revisarla contra el PDF. Corre validate_data.py, simulate.py --export y export_excel.py antes
   del commit.
6. Revisión humana: quien revisa compara cada fila con el PDF y cambia a "verificado" en el mismo PR
   solo las que confirmó. Nunca auto-merge.
7. Disparadores: manual, o desde el issue de la Fase 8 cuando una fuente de TUPA aparece como
   CAMBIÓ (workflow_dispatch con ubigeo y URL).
8. Tests: con un PDF pequeño de prueba en scripts/tests/fixtures y la llamada a la API simulada,
   verifica el mapeo, el formato de las filas y que nada sale como "verificado".
```
**Aceptación:** correr el script con el TUPA 2025 de Villa El Salvador genera un PR con sus montos de edificación en `por_verificar`, cada uno con su página del PDF; CI en verde; la hoja de ruta de Villa El Salvador muestra esos montos con la etiqueta "Por confirmar" hasta que se verifiquen.

---

## Fase 11: Agente de consultas y migración a AWS (futuro)

Objetivo: que cualquier usuario consulte en lenguaje natural ("¿qué necesito para ampliar mi casa en Chorrillos?", "¿qué me falta en el expediente Casa Pérez?") con respuestas basadas en los datos y el motor, nunca inventadas. Se hace después de validar con profesionales. Este bloque es un esquema, no un prompt listo.

```
1. Agente (Claude como modelo) con herramientas que llaman al dominio, no a texto libre:
   diagnosticar(respuestas), armar_hoja_ruta(respuestas, ubigeo), consultar_tarifa(ubigeo,
   procedimiento), ver_fuente(id), y con sesión: listar_expedientes(), estado_expediente(id),
   alertas(id). Cada respuesta cita las fuentes y respeta las etiquetas de verificación: si un dato
   no está verificado, lo dice; si no hay monto, responde "Consultar TUPA" (regla 5).
2. Preguntas del diagnóstico que falten: el agente las hace en la conversación con las opciones de
   diagnostico_preguntas.json, en vez de suponer respuestas.
3. Opcional: exponer las mismas herramientas como servidor MCP para otros asistentes.
4. Migración a AWS (cuando el agente lo justifique):
   - Neon → RDS o Aurora Postgres (pg_dump / pg_restore; Drizzle no cambia).
   - Cloudflare R2 → S3 (mismo SDK; cambia endpoint y credenciales; copiar objetos con rclone).
   - Better Auth se queda (sus tablas viajan con la base de datos).
   - Modelo vía Amazon Bedrock (Claude) o API de Anthropic; herramientas en Lambda o en el mismo
     servidor de la app.
   - Hosting: mantener Vercel o pasar a AWS Amplify / ECS según costo y latencia.
5. Evaluación: batería de preguntas reales con respuesta esperada (casos de fixtures/casos.json en
   lenguaje natural); el agente no puede dar un monto que no exista en los datos.
```
**Aceptación (cuando se haga):** el agente responde los 6 casos de `fixtures/casos.json` planteados en lenguaje natural con la misma modalidad, pasos y alertas que el motor; cada monto que menciona existe en `data/` con su fuente; la migración a AWS no pierde expedientes ni archivos (conteos y sumas de verificación iguales antes y después).

---

## Reglas del mantenimiento de datos

- **Nunca actualizar montos ni requisitos automáticamente sin revisión humana.** Una tasa mal extraída se mostraría como cierta. Todo cambio entra por PR `data:` y lo aprueba una persona.
- **Un dato solo pasa a `verificado` cuando alguien lo leyó en la fuente oficial citada.** Lo que viene de extracción automática, OCR o reportes de usuarios entra como `por_verificar`.
- **Nunca consultar las webs del Estado desde la app ni en cada visita.** Es lento, frágil y va contra el diseño del prototipo. La vigilancia corre aparte, una vez por semana.
- **No borrar datos viejos al actualizar:** se corrige el monto, se actualiza `fecha_consulta` de la fuente y, si cambió el documento, se agrega la fuente nueva.
- **Cada cambio en `data/`:** `validate_data.py`, `simulate.py`, `simulate.py --export` y `export_excel.py`.

## Calendario de revisión

| Cuándo | Qué revisar |
|---|---|
| Cada lunes | Issue "Vigilancia de fuentes" (Fase 8): caídas y cambios |
| Cada enero | UIT del año (`meta.uit`) y TUPAs adecuados en el año |
| Cada convocatoria | Programas (Techo Propio, MiVivienda): montos, requisitos y vigencia |
| Al publicarse una norma | Ley 29090 y reglamentos en El Peruano: requisitos, plazos y modalidades (puede requerir reglas nuevas) |
| Cada 6 meses | Fuentes sin revisar marcadas por la vigilancia |

---

## Prompts de mantenimiento

**Actualizar un dato que cambió** (flujo de revisión; úsalo con lo que reporte la Fase 8 o un usuario)
```
Cambió <dato> según <fuente/URL o issue #N>. Actualiza data/ en una rama data/<tema>:
1. Corrige el valor (monto, requisito, plazo o texto) sin borrar el dato anterior si sigue vigente
   para otra variante o distrito.
2. Si cambió el documento fuente, agrega la fuente nueva a fuentes.json y apunta el dato a ella;
   si es el mismo documento, actualiza su fecha_consulta.
3. Estado: "verificado" solo si lo leíste en la fuente oficial; si viene de otra parte,
   "fuente_secundaria" o "por_verificar".
4. Corre validate_data.py, simulate.py, simulate.py --export y export_excel.py.
5. Abre un PR data: que explique qué cambió (antes → después) y enlace la fuente. Cierra el issue.
```

**Agregar un distrito**
```
Agrega el distrito <nombre> (ubigeo <código>) siguiendo docs/modelo-datos.md > "Cómo agregar un
distrito". Te paso el TUPA en <ruta al PDF>. Extrae SOLO procedimientos de edificación (o usa
scripts/extract_tupa.py si ya existe la Fase 10). Cada monto entra con estado_verificacion
"por_verificar", su código TUPA, la página del PDF y la fuente; pasa a "verificado" solo después de
compararlo con el PDF. Corre validate_data.py, simulate.py, simulate.py --export y export_excel.py.
```

**Nueva regla**
```
Agrega una regla a data/reglas.json para <situación>. Primero agrega un caso en fixtures/casos.json
con el resultado esperado, verifica que falla, agrega la regla y verifica que pasa en Python y en Vitest.
```
