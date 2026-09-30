# RutaObra

Orquestador de trámites de construcción en Perú: de SUNARP a la conformidad de obra, en un solo lugar.
Estado: **prototipo de validación** (v0.1.0, datos al 30-09-2026).

## Qué hay en este repo

| Carpeta | Contenido |
|---|---|
| `data/` | Base de conocimiento en JSON (fuente de verdad) + `ruta-obra.xlsx` para revisar |
| `schema/` | JSON Schema de los datos y del modelo de expedientes |
| `fixtures/` | Casos de prueba del motor de diagnóstico (incluye el caso real de referencia) |
| `scripts/` | `validate_data.py`, `export_excel.py`, `simulate.py` (motor de referencia en Python) |
| `docs/` | `PRD.md`, `modelo-datos.md`, `validacion.md` |
| `prompts/` | Prompts por fase para construir la app con Claude Code |
| `CLAUDE.md` | Stack, arquitectura y reglas para Claude Code |

## Empezar

```bash
# 1. Verificar los datos (Python 3.10+)
pip install jsonschema openpyxl
python scripts/validate_data.py
python scripts/simulate.py              # 6/6 casos
python scripts/simulate.py caso-angel   # ver una hoja de ruta completa

# 2. Construir la app
# Abre el repo en VS Code con Claude Code y sigue prompts/fases.md desde la Fase 0.
```

## Cobertura de datos

- **Nacional:** 7 etapas, 50 procedimientos, 42 documentos, 22 instituciones, 3 zonas especiales, 5 programas, 47 reglas.
- **Distrital:** La Molina (completo, referencia), Surco (parcial), Chorrillos y Villa El Salvador (estructura y códigos; montos por extraer).
- Cada dato tiene `fuente_id` y `estado_verificacion`. Los pendientes están en `docs/modelo-datos.md`.

## Aviso

Información referencial. No es asesoría legal. Confirma montos y plazos en el TUPA vigente de cada entidad.
