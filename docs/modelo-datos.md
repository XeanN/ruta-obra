# Modelo de datos

La base de conocimiento está en `data/` (JSON = fuente de verdad) y se exporta a `data/ruta-obra.xlsx` para revisión. El esquema formal está en `schema/data.schema.json`; los datos que genera el usuario (expedientes, bitácora) siguen `schema/expediente.schema.json`.

## Capas

1. **Capa nacional**: etapas, procedimientos, documentos, normas e instituciones. Es igual para todo el país porque sale de la Ley 29090, el D.S. 029-2019-VIVIENDA y el D.S. 146-2023-PCM, que estandarizó los procedimientos de licencias (las municipalidades ya no pueden inventar requisitos, solo fijar el derecho de trámite).
2. **Capa distrital**: `distritos.json` (TUPA vigente, canal, zonas) y `tarifas_distritales.json` (código TUPA y monto por procedimiento y variante).
3. **Capa de ubicación**: `zonas_especiales.json`, que activa procedimientos sectoriales.
4. **Capa de decisión**: `diagnostico_preguntas.json` + `reglas.json` (motor declarativo) + `vencimientos.json`.

## Archivos

| Archivo | Qué contiene | Clave |
|---|---|---|
| `meta.json` | Versión, fecha de corte, UIT 2026 (S/ 5,500), significado de los estados, aviso legal, umbrales de antigüedad (`vigencia_verificacion_meses`: un dato verificado pasa a "Versión anterior" pasado ese plazo sin revisar su fuente) y de vigilancia (`vigilancia.dias_sin_revision`) | — |
| `etapas.json` | Las 7 etapas (E1–E7) y si son condicionales | `id` |
| `procedimientos.json` | Catálogo nacional: entidad, calificación, plazo, costo referencial, requisitos, resultados, profesionales, normas, fuentes | `id` (`P-…`) |
| `documentos.json` | Todo documento que se pide o se obtiene, con emisor y vigencia en días | `id` (`D-…`) |
| `instituciones.json` | Entidades del Estado y actores privados con su canal de atención | `id` (`I-…`) |
| `distritos.json` | Ubigeo, TUPA vigente, si está estandarizado, canal y zonas especiales | `ubigeo` |
| `tarifas_distritales.json` | Monto por distrito × procedimiento × variante, con código TUPA | `id` |
| `zonas_especiales.json` | Pantanos de Villa, ANP, zona monumental: autoridad, procedimiento requerido y parámetros | `id` (`Z-…`) |
| `programas.json` | Techo Propio, MiVivienda, COFOPRI, BANMAT (inactivo) | `id` (`PR-…`) |
| `diagnostico_preguntas.json` | Preguntas del asistente; `mostrar_si` para condicionales | `id` |
| `reglas.json` | Reglas de modalidad, procedimientos, alertas y programas | `id` |
| `vencimientos.json` | Vigencias y días de aviso | `id` (`V-…`) |
| `normas.json` / `fuentes.json` | Trazabilidad legal y de origen | `id` |

## Estados de verificación

| Estado | Uso en la UI |
|---|---|
| `verificado` | Se muestra normal |
| `fuente_secundaria` | Etiqueta "Referencial" + enlace a la fuente |
| `desactualizado` | Etiqueta "Versión anterior del TUPA" |
| `por_verificar` | Etiqueta "Por confirmar"; nunca como dato cierto |

## Lenguaje de reglas

```json
{ "id": "R-E4-PANTANOS", "tipo": "agregar_procedimientos",
  "si": { "todas": [ { "campo": "zona_especial", "igual": "pantanos_villa" } ] },
  "procedimientos": ["P-PROH-OPINION"] }
```

- Operadores: `igual`, `distinto`, `en`, `no_en`, `mayor`, `menor_igual`, `existe`. Agrupadores: `todas` (Y), `alguna` (O), anidables.
- Tipos: `modalidad` (gana la primera que cumple, por `orden`), `agregar_procedimientos` (con `alternativas` y `opcional`), `alerta` (`nivel`, `mensaje`), `programa`.
- Campo derivado: `_modalidad` (se calcula primero).

## Cobertura actual (v0.1.0)

| Distrito | Estado de tasas |
|---|---|
| La Molina (referencia) | Completas: TUPA 2025 |
| Santiago de Surco | Parciales: parámetros y numeración 2024; licencias con montos de 2022 |
| Chorrillos | Códigos del TUPA 2021, montos por extraer |
| Villa El Salvador | TUPA 2025 estandarizado, montos por extraer |

## Cómo agregar un distrito

1. Agregar el objeto en `distritos.json` (ubigeo INEI, TUPA, canal, zonas).
2. Agregar filas en `tarifas_distritales.json` con `codigo_tupa`, `derecho_soles`, `fuente_id` y estado.
3. Agregar la fuente en `fuentes.json` y la opción en la pregunta `distrito`.
4. `python scripts/validate_data.py` y `python scripts/simulate.py`.

## Pendientes de datos (prioridad)

1. Revisar contra el PDF y pasar a `verificado` los montos extraídos (todos `por_verificar`): Chorrillos y Surco 2024, Lurín, Villa María del Triunfo, Mala y San Vicente de Cañete (este último leído por OCR).
2. Montos de Villa El Salvador (primera corrida de `scripts/extract_tupa.py`) y de San Juan de Miraflores (anexo de la Ord. 565/MDSJM, publicado en el portal del SAT).
3. Villa María del Triunfo: confirmar los montos 2022 contra las modificaciones de 2023 y 2024 (D.A. 01-2024-MDVMT). Lurín: confirmar si hay un TUPA posterior a la Ord. 399-2020/ML.
4. Plazos estandarizados exactos del D.S. 146-2023-PCM para cada procedimiento.
5. Tasas de PROHVILLA, SERNANP, Ministerio de Cultura, Sedapal, Luz del Sur y Enel.
6. Porcentajes de CONAFOVICER y SENCICO, y si aplican a la autoconstrucción familiar.
7. Polígonos (GeoJSON) de zonas especiales para detección por mapa.
