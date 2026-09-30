"""Exporta /data/*.json a data/ruta-obra.xlsx (una hoja por archivo) para revisar y editar.

El JSON es la fuente de verdad. Si editas en Excel, vuelve a pasar los cambios al JSON
(o pide a Claude Code un script import_excel.py).
Uso:  python scripts/export_excel.py      Requiere: pip install openpyxl
"""
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ORDEN = ["etapas", "procedimientos", "documentos", "instituciones", "distritos", "tarifas_distritales",
         "zonas_especiales", "programas", "diagnostico_preguntas", "reglas", "vencimientos", "normas", "fuentes"]
COLOR_ESTADO = {"verificado": "D9F2D9", "fuente_secundaria": "FFF4CC", "desactualizado": "FCE0C8", "por_verificar": "F8D0D0"}


def celda(v):
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def aplanar(obj, prefijo=""):
    fila = {}
    for k, v in obj.items():
        if isinstance(v, dict) and k in ("costo_referencial", "tupa", "uit"):
            for k2, v2 in v.items():
                fila[f"{k}.{k2}"] = celda(v2)
        else:
            fila[f"{prefijo}{k}"] = celda(v)
    return fila


def main():
    wb = Workbook()
    ws = wb.active
    ws.title = "LEEME"
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    ws.append(["RutaObra - base de conocimiento", meta["version_datos"], meta["fecha_corte"]])
    ws.append(["Aviso", meta["aviso_legal"]])
    ws.append([])
    ws.append(["Estado de verificacion", "Significado"])
    for k, v in meta["estados_verificacion"].items():
        ws.append([k, v])
        ws.cell(ws.max_row, 1).fill = PatternFill("solid", fgColor=COLOR_ESTADO[k])
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 110

    for nombre in ORDEN:
        filas = [aplanar(x) for x in json.loads((DATA / f"{nombre}.json").read_text(encoding="utf-8"))]
        cols = list(dict.fromkeys(k for f in filas for k in f))
        sh = wb.create_sheet(nombre[:31])
        sh.append(cols)
        for c in sh[1]:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="1F3A5F")
        for f in filas:
            sh.append([f.get(c) for c in cols])
            if "estado_verificacion" in cols:
                est = f.get("estado_verificacion")
                if est in COLOR_ESTADO:
                    sh.cell(sh.max_row, cols.index("estado_verificacion") + 1).fill = PatternFill("solid", fgColor=COLOR_ESTADO[est])
        for i, c in enumerate(cols, 1):
            ancho = min(60, max(12, max(len(str(sh.cell(r, i).value or "")) for r in range(1, min(sh.max_row, 40) + 1))))
            sh.column_dimensions[get_column_letter(i)].width = ancho
        for row in sh.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        sh.freeze_panes = "B2"
        sh.auto_filter.ref = sh.dimensions
    out = DATA / "ruta-obra.xlsx"
    wb.save(out)
    print(f"Exportado: {out}")


if __name__ == "__main__":
    main()
