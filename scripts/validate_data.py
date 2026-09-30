"""Valida /data contra schema/data.schema.json y revisa integridad referencial.

Uso:  python scripts/validate_data.py
Requiere: pip install jsonschema
Sale con codigo 1 si hay errores (sirve para CI / pre-commit).
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SCHEMA = json.loads((ROOT / "schema" / "data.schema.json").read_text(encoding="utf-8"))

ARCHIVOS = {
    "fuentes.json": "fuente", "normas.json": "norma", "instituciones.json": "institucion",
    "etapas.json": "etapa", "documentos.json": "documento", "procedimientos.json": "procedimiento",
    "tarifas_distritales.json": "tarifa", "reglas.json": "regla",
}

errores: list[str] = []


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def validar_schema():
    for archivo, definicion in ARCHIVOS.items():
        sub = {"$schema": SCHEMA["$schema"], "$defs": SCHEMA["$defs"], "type": "array", "items": {"$ref": f"#/$defs/{definicion}"}}
        for e in Draft202012Validator(sub).iter_errors(load(archivo)):
            errores.append(f"[schema] {archivo} {list(e.path)}: {e.message}")


def ids(name, key="id"):
    lista = load(name)
    vistos = set()
    for x in lista:
        if x[key] in vistos:
            errores.append(f"[duplicado] {name}: {x[key]}")
        vistos.add(x[key])
    return vistos


def campos_de(cond):
    for grupo in ("todas", "alguna"):
        for c in cond.get(grupo, []):
            yield from campos_de(c)
    if "campo" in cond:
        yield cond["campo"], cond


def validar_referencias():
    F, N, I, E = ids("fuentes.json"), ids("normas.json"), ids("instituciones.json"), ids("etapas.json")
    D, P, Z, PR = ids("documentos.json"), ids("procedimientos.json"), ids("zonas_especiales.json"), ids("programas.json")
    U = ids("distritos.json", "ubigeo")
    preguntas = {q["id"]: q for q in load("diagnostico_preguntas.json")}

    def chk(origen, valor, universo, nombre):
        if valor and valor not in universo:
            errores.append(f"[ref] {origen} -> {nombre} inexistente: {valor}")

    for n in load("normas.json"):
        chk(n["id"], n.get("fuente_id"), F, "fuente")
    for d in load("documentos.json"):
        chk(d["id"], d.get("emisor_id"), I, "institucion")
    for p in load("procedimientos.json"):
        chk(p["id"], p["etapa_id"], E, "etapa")
        chk(p["id"], p.get("institucion_id"), I, "institucion")
        for r in p["requisitos"] + p["documentos_resultado"]:
            chk(p["id"], r, D, "documento")
        for r in p["depende_de"]:
            chk(p["id"], r, P, "procedimiento")
        for r in p["normas"]:
            chk(p["id"], r, N, "norma")
        for r in p["fuentes"]:
            chk(p["id"], r, F, "fuente")
    for z in load("zonas_especiales.json"):
        chk(z["id"], z["autoridad_id"], I, "institucion")
        chk(z["id"], z["procedimiento_requerido"], P, "procedimiento")
        for u in z["distritos"]:
            chk(z["id"], u, U, "distrito")
    for pr in load("programas.json"):
        chk(pr["id"], pr.get("institucion_id"), I, "institucion")
    for d in load("distritos.json"):
        chk(d["ubigeo"], d["tupa"].get("norma_id"), N, "norma")
        chk(d["ubigeo"], d["tupa"].get("fuente_id"), F, "fuente")
        for z in d["zonas_especiales"]:
            chk(d["ubigeo"], z, Z, "zona")
    for t in load("tarifas_distritales.json"):
        chk(t["id"], t["ubigeo"], U, "distrito")
        chk(t["id"], t["procedimiento_id"], P, "procedimiento")
        chk(t["id"], t["fuente_id"], F, "fuente")
    for r in load("reglas.json"):
        for pid in r.get("procedimientos", []) + r.get("alternativas", []):
            chk(r["id"], pid, P, "procedimiento")
        chk(r["id"], r.get("programa_id"), PR, "programa")
        for f in r.get("fuentes", []):
            chk(r["id"], f, F, "fuente")
        for campo, cond in campos_de(r["si"]):
            if campo.startswith("_"):
                continue  # campos derivados (p. ej. _modalidad)
            if campo not in preguntas:
                errores.append(f"[ref] {r['id']} usa campo inexistente: {campo}")
                continue
            q = preguntas[campo]
            if q["tipo"] == "opcion":
                validos = {o["valor"] for o in q["opciones"]}
                for op in ("igual", "distinto"):
                    if op in cond and cond[op] not in validos:
                        errores.append(f"[ref] {r['id']}: {campo}={cond[op]} no es opcion valida")
                for op in ("en", "no_en"):
                    for v in cond.get(op, []):
                        if v not in validos:
                            errores.append(f"[ref] {r['id']}: {campo} en {v} no es opcion valida")
    for v in load("vencimientos.json"):
        chk(v["id"], v.get("documento_id"), D, "documento")


if __name__ == "__main__":
    validar_schema()
    validar_referencias()
    if errores:
        print(f"{len(errores)} error(es):")
        print("\n".join(errores))
        sys.exit(1)
    print("OK: esquema e integridad referencial correctos.")
