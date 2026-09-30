"""Motor de referencia (Python) del diagnostico. Es la ESPECIFICACION ejecutable que
la implementacion TypeScript (src/domain) debe replicar. Corre los casos de
fixtures/casos.json y compara con lo esperado.

Uso:  python scripts/simulate.py            -> corre todos los casos
      python scripts/simulate.py caso-angel  -> imprime la ruta de un caso
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
load = lambda n: json.loads((DATA / n).read_text(encoding="utf-8"))


def cumple(cond: dict, r: dict) -> bool:
    if "todas" in cond:
        return all(cumple(c, r) for c in cond["todas"])
    if "alguna" in cond:
        return any(cumple(c, r) for c in cond["alguna"])
    campo = cond["campo"]
    if campo not in r or r[campo] is None:
        return cond.get("existe") is False
    v = r[campo]
    if "igual" in cond: return v == cond["igual"]
    if "distinto" in cond: return v != cond["distinto"]
    if "en" in cond: return v in cond["en"]
    if "no_en" in cond: return v not in cond["no_en"]
    if "mayor" in cond: return isinstance(v, (int, float)) and v > cond["mayor"]
    if "menor_igual" in cond: return isinstance(v, (int, float)) and v <= cond["menor_igual"]
    if "existe" in cond: return cond["existe"] is True
    raise ValueError(f"Condicion sin operador: {cond}")


def diagnosticar(respuestas: dict) -> dict:
    reglas = load("reglas.json")
    procs = {p["id"]: p for p in load("procedimientos.json")}
    etapas = {e["id"]: e["orden"] for e in load("etapas.json")}
    r = dict(respuestas)

    modalidad = None
    for regla in sorted((x for x in reglas if x["tipo"] == "modalidad"), key=lambda x: x["orden"]):
        if cumple(regla["si"], r):
            modalidad = regla["resultado"]
            break
    r["_modalidad"] = modalidad

    pasos, alternativas, alertas, programas = [], {}, [], []
    for regla in reglas:
        if not cumple(regla["si"], r):
            continue
        if regla["tipo"] == "agregar_procedimientos":
            for pid in regla["procedimientos"]:
                if pid not in [p["procedimiento_id"] for p in pasos]:
                    pasos.append({"procedimiento_id": pid, "opcional": regla.get("opcional", False), "regla_id": regla["id"]})
            for alt in regla.get("alternativas", []):
                alternativas.setdefault(regla["procedimientos"][0], []).append(alt)
        elif regla["tipo"] == "alerta":
            alertas.append({"id": regla["id"], "nivel": regla["nivel"], "mensaje": regla["mensaje"]})
        elif regla["tipo"] == "programa":
            programas.append(regla["programa_id"])

    pasos.sort(key=lambda p: etapas[procs[p["procedimiento_id"]]["etapa_id"]])
    for p in pasos:
        p["etapa_id"] = procs[p["procedimiento_id"]]["etapa_id"]
        p["alternativas"] = alternativas.get(p["procedimiento_id"], [])
    return {"modalidad": modalidad, "pasos": pasos, "alertas": alertas, "programas": programas}


def main():
    casos = json.loads((ROOT / "fixtures" / "casos.json").read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        caso = next(c for c in casos if c["id"] == sys.argv[1])
        res = diagnosticar(caso["respuestas"])
        procs = {p["id"]: p for p in load("procedimientos.json")}
        print(f"Modalidad: {res['modalidad']}")
        for p in res["pasos"]:
            alt = f"  (alternativa: {', '.join(p['alternativas'])})" if p["alternativas"] else ""
            print(f"  {p['etapa_id']}  {p['procedimiento_id']:<18} {procs[p['procedimiento_id']]['nombre']}{' [opcional]' if p['opcional'] else ''}{alt}")
        for a in res["alertas"]:
            print(f"  ALERTA {a['nivel']}: {a['mensaje']}")
        print(f"  Programas: {res['programas']}")
        return
    fallos = 0
    for caso in casos:
        res = diagnosticar(caso["respuestas"])
        esp = caso["esperado"]
        obtenidos = {p["procedimiento_id"] for p in res["pasos"]}
        problemas = []
        if res["modalidad"] != esp["modalidad"]:
            problemas.append(f"modalidad {res['modalidad']} != {esp['modalidad']}")
        for pid in esp.get("incluye", []):
            if pid not in obtenidos: problemas.append(f"falta {pid}")
        for pid in esp.get("excluye", []):
            if pid in obtenidos: problemas.append(f"sobra {pid}")
        alertas = {a["id"] for a in res["alertas"]}
        for aid in esp.get("alertas", []):
            if aid not in alertas: problemas.append(f"falta alerta {aid}")
        estado = "OK  " if not problemas else "FALLA"
        fallos += bool(problemas)
        print(f"{estado} {caso['id']}: {caso['descripcion']}" + (f"\n      {'; '.join(problemas)}" if problemas else ""))
    print(f"\n{len(casos) - fallos}/{len(casos)} casos correctos")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
