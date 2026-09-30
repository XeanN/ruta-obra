# Prompts por fase para Claude Code

Úsalos en orden, uno por sesión o por rama. Cada uno termina con criterios de aceptación: no pases a la siguiente fase sin cumplirlos. Antes de empezar, Claude Code debe leer `CLAUDE.md`.

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

---

## Fase 4: Expedientes, checklist y alertas (F3, F4, F5)

```
Implementa ExpedienteRepository (interfaz) y su versión localStorage (con try/catch y migración
por version_datos). Crear expediente desde el diagnóstico: nombre, dirección, ubigeo, partida y actores.
app/expedientes: tablero con tarjetas (etapa actual, % avance = pasos aprobados/no_aplica sobre
total, próximo paso, próximas 3 alertas). Filtros por distrito y estado.
app/expedientes/[id] con tabs: Ruta (cambiar estado de cada paso, número de trámite, fechas, monto
pagado), Checklist (domain/checklist.ts: requisitos únicos, estado, fecha de emisión -> vencimiento),
Alertas (domain/alerts.ts: vencimientos.json + observación recibida -> 5 días hábiles para subsanar).
Exportar e importar un expediente como JSON (respaldo).
```
**Aceptación:** crear 3 expedientes de prueba, marcar una observación y ver la alerta de 5 días hábiles; recargar la página no pierde nada.

---

## Fase 5: Bitácora de obra (F6)

```
Tab "Bitácora" en el expediente: alta rápida de entradas (tipo, fecha, descripción, monto, % avance,
responsable de los actores, foto como archivo local convertido a data URL con límite de 1 MB).
Vista cronológica con filtros por tipo y totales de gasto por tipo y por mes.
```
**Aceptación:** registrar 10 entradas; los totales cuadran; se ve bien en móvil.

---

## Fase 6: Landing, pulido y despliegue

```
app/page.tsx: propuesta de valor para profesionales ("Todos tus expedientes de obra, de SUNARP a la
conformidad, en un solo lugar"), CTA al diagnóstico, 3 beneficios y un caso real anonimizado.
Revisa accesibilidad (labels, contraste, foco), metadatos SEO y Open Graph.
Agrega un modo demo con 3 expedientes precargados (desde fixtures) para mostrar en entrevistas.
Prepara el despliegue en Vercel (README con pasos).
```
**Aceptación:** Lighthouse móvil ≥ 90 en Performance y Accesibilidad; el modo demo carga en 1 clic.

---

## Prompts de mantenimiento

**Agregar un distrito**
```
Agrega el distrito <nombre> (ubigeo <código>) siguiendo docs/modelo-datos.md > "Cómo agregar un
distrito". Te paso el TUPA en <ruta al PDF>. Extrae SOLO procedimientos de edificación, marca cada
monto con estado_verificacion "verificado" y la fuente. Corre validate_data.py y simulate.py.
```

**Nueva regla**
```
Agrega una regla a data/reglas.json para <situación>. Primero agrega un caso en fixtures/casos.json
con el resultado esperado, verifica que falla, agrega la regla y verifica que pasa en Python y en Vitest.
```
