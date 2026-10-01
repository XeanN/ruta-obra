"""Vigilancia semanal de las fuentes de data/fuentes.json (Fase 8).

Revisa cada URL, detecta qué cambió, qué se cayó o redirige, qué datos dependen de cada fuente
y qué lleva mucho sin revisarse. NO cambia ningún dato: solo informa en un issue de GitHub
("Vigilancia de fuentes", etiqueta vigilancia-datos) para corregir luego con un PR data:.

Uso:
  python scripts/watch_sources.py --dry-run                 # imprime el reporte, no toca GitHub
  python scripts/watch_sources.py --dry-run --estado-local estado.json   # recuerda huellas entre corridas locales
  python scripts/watch_sources.py                           # en Actions: actualiza el issue (usa gh y GH_TOKEN)

El estado entre corridas (huellas y fallas seguidas por fuente) se guarda en un bloque oculto
<!-- estado-vigilancia {...} --> dentro del cuerpo del issue: no se commitea nada.
Solo usa la biblioteca estándar de Python.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
REPO_URL = "https://github.com/XeanN/ruta-obra"
USER_AGENT = f"RutaObra-vigilancia/1.0 (+{REPO_URL})"
TIMEOUT_S = 20
TIMEOUT_REINTENTO_S = 60  # algunos portales del Estado responden muy lento fuera del Perú
PAUSA_S = 1.0  # máximo 1 petición por segundo
MAX_BYTES = 60 * 1024 * 1024  # los TUPA en PDF pueden pesar decenas de MB
FALLAS_PARA_CAIDA = 2  # corridas seguidas sin responder antes de marcar CAÍDA…
DIAS_PARA_CAIDA = 7  # …y al menos una semana entre la primera falla y la última
REINTENTO_S = 5.0  # espera antes del único reintento de una URL que falló
DIAS_SIN_REVISION_DEFECTO = 180

ETIQUETA = "vigilancia-datos"
TITULO_ISSUE = "Vigilancia de fuentes"
MARCA_ESTADO = "estado-vigilancia"

# Archivos de data/ que citan fuentes (por fuente_id o por una lista "fuentes", también anidados).
ARCHIVOS_CON_FUENTES = [
    "procedimientos.json",
    "tarifas_distritales.json",
    "distritos.json",
    "normas.json",
    "reglas.json",
    "programas.json",
    "zonas_especiales.json",
    "vencimientos.json",
]


# ---------------------------------------------------------------------------
# Huella del contenido
# ---------------------------------------------------------------------------

class _TextoVisible(HTMLParser):
    OCULTOS = {"script", "style", "noscript", "template", "svg", "head", "iframe"}
    # Partes de la página que cambian sin que cambie el contenido (menús, notas relacionadas, avisos).
    ACCESORIOS = {"nav", "header", "footer", "aside", "form"}
    PRINCIPALES = {"main", "article"}
    VACIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.todo: list[str] = []
        self.principal: list[str] = []
        self._ocultos = 0
        self._accesorios = 0
        self._principal = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.VACIOS:
            return
        if tag in self.OCULTOS:
            self._ocultos += 1
        elif tag in self.ACCESORIOS:
            self._accesorios += 1
        elif tag in self.PRINCIPALES:
            self._principal += 1

    def handle_endtag(self, tag):
        if tag in self.OCULTOS and self._ocultos > 0:
            self._ocultos -= 1
        elif tag in self.ACCESORIOS and self._accesorios > 0:
            self._accesorios -= 1
        elif tag in self.PRINCIPALES and self._principal > 0:
            self._principal -= 1

    def handle_data(self, data):
        if self._ocultos or self._accesorios:
            return
        self.todo.append(data)
        if self._principal:
            self.principal.append(data)


def _normalizar(partes: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(partes)).strip()


def texto_visible(html: str) -> str:
    """Texto que ve una persona, sin scripts, estilos, menús, encabezado, pie ni barras laterales.

    Si la página marca su contenido con <main> o <article>, se usa solo eso: así las notas
    relacionadas o la publicidad que rotan alrededor no cuentan como cambio.
    """
    p = _TextoVisible()
    p.feed(html)
    p.close()
    return _normalizar(p.principal) or _normalizar(p.todo)


def es_html(content_type: str) -> bool:
    return "html" in (content_type or "").lower()


def huella(contenido: bytes, content_type: str) -> str:
    """sha256 de los bytes (PDF y binarios) o del texto visible normalizado (HTML)."""
    if es_html(content_type):
        charset = "utf-8"
        m = re.search(r"charset=([\w-]+)", content_type or "", re.I)
        if m:
            charset = m.group(1)
        try:
            texto = contenido.decode(charset, errors="replace")
        except LookupError:
            texto = contenido.decode("utf-8", errors="replace")
        return hashlib.sha256(texto_visible(texto).encode("utf-8")).hexdigest()
    return hashlib.sha256(contenido).hexdigest()


# ---------------------------------------------------------------------------
# Consulta de URLs
# ---------------------------------------------------------------------------

@dataclass
class Respuesta:
    ok: bool
    codigo: int | None = None
    url_final: str | None = None
    content_type: str = ""
    huella: str | None = None
    error: str | None = None
    tls_invalido: bool = False


def _abrir(url: str, contexto: ssl.SSLContext | None, timeout: float) -> Respuesta:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=contexto) as r:
        contenido = r.read(MAX_BYTES + 1)
        if len(contenido) > MAX_BYTES:
            return Respuesta(ok=False, codigo=r.status, url_final=r.geturl(), error="archivo demasiado grande")
        tipo = r.headers.get("Content-Type", "")
        return Respuesta(ok=True, codigo=r.status, url_final=r.geturl(), content_type=tipo, huella=huella(contenido, tipo))


def consultar(url: str, timeout: float = TIMEOUT_S) -> Respuesta:
    """GET siguiendo redirecciones. Un 4xx/5xx, timeout o error de red cuenta como falla."""
    try:
        try:
            return _abrir(url, None, timeout)
        except urllib.error.URLError as e:
            # Muchos portales del Estado tienen la cadena de certificados incompleta: se reintenta sin
            # verificar (solo se lee contenido público, no se envía nada) y se avisa en el reporte.
            if isinstance(getattr(e, "reason", None), ssl.SSLError):
                r = _abrir(url, ssl._create_unverified_context(), timeout)  # noqa: S323
                r.tls_invalido = True
                return r
            raise
    except urllib.error.HTTPError as e:
        return Respuesta(ok=False, codigo=e.code, url_final=e.geturl(), error=f"HTTP {e.code}")
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        motivo = getattr(e, "reason", e)
        return Respuesta(ok=False, error=f"{type(e).__name__}: {motivo}"[:200])


def redirige(url: str, url_final: str | None) -> bool:
    """True si la URL final cambió de dominio o de ruta (ignora http→https y la barra final)."""
    if not url_final:
        return False
    a, b = urlsplit(url), urlsplit(url_final)
    return a.netloc.lower() != b.netloc.lower() or a.path.rstrip("/") != b.path.rstrip("/")


# ---------------------------------------------------------------------------
# Clasificación
# ---------------------------------------------------------------------------

@dataclass
class Resultado:
    fuente: dict
    estado: str  # OK | CAMBIO | CAIDA | FALLA | REDIRIGE
    detalle: str = ""
    tls_invalido: bool = False


def _dias(desde: str, hasta: str) -> int:
    return (date.fromisoformat(hasta) - date.fromisoformat(desde)).days


def clasificar(fuente: dict, resp: Respuesta, previo: dict | None, hoy: str) -> tuple[Resultado, dict]:
    """Devuelve el resultado de la fuente y su nuevo estado guardado.

    Estado guardado por fuente:
    - huella: la última confirmada. Una huella distinta queda como "candidata" y el cambio se
      confirma solo si la siguiente corrida da la misma: una página que varía en cada visita
      (publicidad, contadores) nunca se confirma.
    - cambio_desde: fecha del cambio confirmado. Se sigue mostrando hasta que alguien revisa la
      fuente, es decir, hasta que su fecha_consulta en fuentes.json es igual o posterior.
    - fallas y falla_desde: corridas seguidas sin respuesta y desde cuándo. CAÍDA exige
      FALLAS_PARA_CAIDA corridas y DIAS_PARA_CAIDA días: dos corridas manuales el mismo día no bastan.
    """
    previo = dict(previo or {})
    nuevo = dict(previo)

    if not resp.ok:
        nuevo["fallas"] = int(previo.get("fallas", 0)) + 1
        nuevo.setdefault("falla_desde", hoy)
        motivo = resp.error or (f"HTTP {resp.codigo}" if resp.codigo else "sin respuesta")
        if nuevo["fallas"] >= FALLAS_PARA_CAIDA and _dias(nuevo["falla_desde"], hoy) >= DIAS_PARA_CAIDA:
            return Resultado(fuente, "CAIDA", f"{motivo} (sin respuesta desde el {formato_fecha(nuevo['falla_desde'])})"), nuevo
        return Resultado(fuente, "FALLA", f"{motivo} (se confirma si sigue igual en una semana)"), nuevo

    nuevo["fallas"] = 0
    nuevo.pop("falla_desde", None)
    confirmada = previo.get("huella")
    if confirmada is None or resp.huella == confirmada:
        nuevo["huella"] = resp.huella
        nuevo.pop("candidata", None)
        nuevo.pop("candidata_desde", None)
    elif resp.huella == previo.get("candidata"):
        nuevo["huella"] = resp.huella  # la huella nueva se repitió: el cambio es real
        nuevo["cambio_desde"] = previo.get("candidata_desde", hoy)
        nuevo.pop("candidata", None)
        nuevo.pop("candidata_desde", None)
    else:
        nuevo["candidata"] = resp.huella  # distinta: se confirma en la próxima corrida
        nuevo["candidata_desde"] = hoy

    revisada = fuente.get("fecha_consulta") or ""
    cambio = nuevo.get("cambio_desde")
    if cambio and revisada >= cambio:
        nuevo.pop("cambio_desde", None)  # ya se revisó después del cambio
        cambio = None

    if redirige(fuente["url"], resp.url_final):
        return Resultado(fuente, "REDIRIGE", f"ahora va a {resp.url_final}", resp.tls_invalido), nuevo
    if cambio:
        return Resultado(fuente, "CAMBIO", f"contenido distinto desde el {formato_fecha(cambio)}", resp.tls_invalido), nuevo
    return Resultado(fuente, "OK", "", resp.tls_invalido), nuevo


# ---------------------------------------------------------------------------
# Impacto, antigüedad y recordatorios
# ---------------------------------------------------------------------------

def _citas(obj) -> set[str]:
    """Ids de fuentes citados en un objeto (fuente_id y listas "fuentes", a cualquier nivel)."""
    encontradas: set[str] = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "fuente_id" and isinstance(v, str):
                encontradas.add(v)
            elif k == "fuentes" and isinstance(v, list):
                encontradas.update(x for x in v if isinstance(x, str))
            else:
                encontradas |= _citas(v)
    elif isinstance(obj, list):
        for x in obj:
            encontradas |= _citas(x)
    return encontradas


def impacto(datos: dict[str, list]) -> dict[str, list[tuple[str, str]]]:
    """fuente_id -> [(archivo, id del dato)] de todo lo que depende de esa fuente."""
    por_fuente: dict[str, list[tuple[str, str]]] = {}
    for archivo in ARCHIVOS_CON_FUENTES:
        for item in datos.get(archivo, []):
            ident = str(item.get("id") or item.get("ubigeo") or "?")
            if archivo == "distritos.json" and item.get("nombre"):
                ident = f"{item['nombre']} ({ident})"
            for f in sorted(_citas(item)):
                por_fuente.setdefault(f, []).append((archivo, ident))
    return por_fuente


def sin_revisar(fuentes: list[dict], usos: dict[str, list[tuple[str, str]]], hoy: date, dias: int) -> dict[str, list[dict]]:
    """Fuentes con fecha_consulta de hace más de `dias`, agrupadas por archivo de data/ que las usa."""
    limite = hoy - timedelta(days=dias)
    grupos: dict[str, list[dict]] = {}
    for f in fuentes:
        consulta = f.get("fecha_consulta")
        if consulta and date.fromisoformat(consulta) >= limite:
            continue
        archivos = sorted({a for a, _ in usos.get(f["id"], [])}) or ["(sin uso en data/)"]
        for a in archivos:
            grupos.setdefault(a, []).append(f)
    return grupos


def recordatorios(datos: dict, hoy: date) -> list[str]:
    """Recordatorios de calendario que no necesitan red."""
    r: list[str] = []
    uit = datos["meta.json"].get("uit", {})
    if hoy.month == 1 and int(uit.get("anio", hoy.year)) < hoy.year:
        r.append(f"Actualizar la UIT del año: `meta.json` tiene la de {uit.get('anio')} (S/ {uit.get('valor')}).")
    for d in datos.get("distritos.json", []):
        anio = (d.get("tupa") or {}).get("anio")
        if anio and hoy.year - int(anio) >= 2:
            r.append(f"TUPA de {d.get('nombre')} ({d.get('ubigeo')}) es de {anio}: revisar si hay uno más reciente.")
    for p in datos.get("programas.json", []):
        if p.get("anio") and int(p["anio"]) < hoy.year:
            r.append(f"Programa {p.get('nombre')} ({p['id']}) es de {p['anio']}: revisar la convocatoria vigente.")
    return r


# ---------------------------------------------------------------------------
# Reporte
# ---------------------------------------------------------------------------

def formato_fecha(iso: str) -> str:
    a, m, d = iso.split("-")
    return f"{d}/{m}/{a}"


def _linea_fuente(f: dict) -> str:
    return f"**{f.get('titulo', f['id'])}** (`{f['id']}`) — {f.get('url', '')}"


def _afectados(usos: list[tuple[str, str]], maximo: int = 12) -> str:
    if not usos:
        return "  - Datos afectados: ninguno (la fuente no se usa en data/)."
    por_archivo: dict[str, list[str]] = {}
    for a, i in usos:
        por_archivo.setdefault(a, []).append(i)
    partes = []
    for a, ids in por_archivo.items():
        lista = ", ".join(f"`{i}`" for i in ids[:maximo]) + (f" y {len(ids) - maximo} más" if len(ids) > maximo else "")
        partes.append(f"`{a}`: {lista}")
    return "  - Datos afectados: " + "; ".join(partes)


def novedades(resultados: list[Resultado]) -> list[str]:
    """Claves de lo que hay que mirar (para saber qué es nuevo respecto de la corrida anterior)."""
    return sorted(f"{r.estado}:{r.fuente['id']}" for r in resultados if r.estado in ("CAIDA", "CAMBIO", "REDIRIGE"))


def armar_reporte(
    resultados: list[Resultado],
    usos: dict[str, list[tuple[str, str]]],
    viejas: dict[str, list[dict]],
    avisos: list[str],
    hoy: date,
    dias: int,
) -> str:
    por = lambda e: [r for r in resultados if r.estado == e]  # noqa: E731
    caidas, cambios, redirigen, fallas = por("CAIDA"), por("CAMBIO"), por("REDIRIGE"), por("FALLA")
    ok = len(por("OK"))
    n_viejas = len({f["id"] for fs in viejas.values() for f in fs})

    l: list[str] = [
        f"Última revisión: **{formato_fecha(hoy.isoformat())}** · {len(resultados)} fuentes · "
        f"{ok} sin novedad · {len(caidas)} caídas · {len(cambios)} cambiaron · {len(redirigen)} redirigen · "
        f"{n_viejas} sin revisar hace más de {dias} días",
        "",
        "Este issue lo actualiza cada lunes `scripts/watch_sources.py`. No cambia datos: cada novedad se "
        "corrige con un PR `data:` (ver \"Prompts de mantenimiento\" en `prompts/fases.md`). Un cambio deja "
        "de aparecer cuando se actualiza la `fecha_consulta` de la fuente en `data/fuentes.json`.",
        "",
        "## 🔴 Caídas",
    ]
    if caidas:
        l.append(
            "Revisa cada una en el navegador antes de tocar datos: un 403, 418 o timeout puede ser un "
            "bloqueo a servidores fuera del Perú (la vigilancia corre en GitHub, en EE. UU.) y no una caída real."
        )
        l.append("")
        for r in caidas:
            l += [f"- {_linea_fuente(r.fuente)}", f"  - {r.detalle}", _afectados(usos.get(r.fuente["id"], []))]
    else:
        l.append("Ninguna.")
    if fallas:
        l.append("")
        l.append(f"<details><summary>Sin respuesta esta semana ({len(fallas)}); se marcan como caídas si siguen así en una semana</summary>\n")
        l += [f"- {_linea_fuente(r.fuente)}: {r.detalle}" for r in fallas]
        l.append("\n</details>")

    l += ["", "## 🟠 Cambiaron"]
    if cambios or redirigen:
        for r in cambios + redirigen:
            etiqueta = "Cambió" if r.estado == "CAMBIO" else "Redirige"
            l += [f"- {etiqueta}: {_linea_fuente(r.fuente)}", f"  - {r.detalle}", _afectados(usos.get(r.fuente["id"], []))]
    else:
        l.append("Ninguna.")

    l += ["", f"## 🟡 Sin revisar hace más de {dias} días"]
    if viejas:
        for archivo in sorted(viejas):
            l.append(f"- `{archivo}`")
            for f in viejas[archivo]:
                consulta = formato_fecha(f["fecha_consulta"]) if f.get("fecha_consulta") else "sin fecha"
                l.append(f"  - {_linea_fuente(f)} · revisada: {consulta}")
    else:
        l.append("Ninguna.")

    l += ["", "## 📅 Recordatorios"]
    l += [f"- {a}" for a in avisos] if avisos else ["Ninguno."]

    tls = [r for r in resultados if r.tls_invalido]
    if tls:
        l += ["", "<details><summary>Certificado HTTPS inválido (se leyó igual)</summary>\n"]
        l += [f"- {_linea_fuente(r.fuente)}" for r in tls]
        l.append("\n</details>")
    return "\n".join(l)


# ---------------------------------------------------------------------------
# Estado guardado en el issue
# ---------------------------------------------------------------------------

_RE_ESTADO = re.compile(r"<!--\s*" + MARCA_ESTADO + r"\s+(\{.*?\})\s*-->", re.S)


def leer_estado(cuerpo: str | None) -> dict:
    m = _RE_ESTADO.search(cuerpo or "")
    if not m:
        return {"fuentes": {}, "novedades": []}
    try:
        estado = json.loads(m.group(1))
    except json.JSONDecodeError:
        return {"fuentes": {}, "novedades": []}
    estado.setdefault("fuentes", {})
    estado.setdefault("novedades", [])
    return estado


def escribir_estado(reporte: str, estado: dict) -> str:
    # ">" se escapa para que el JSON nunca cierre el comentario HTML ("-->").
    js = json.dumps(estado, ensure_ascii=True, sort_keys=True, separators=(",", ":")).replace(">", "\\u003e")
    return f"{reporte}\n\n<!-- {MARCA_ESTADO} {js} -->\n"


# ---------------------------------------------------------------------------
# GitHub (gh CLI)
# ---------------------------------------------------------------------------

def _gh(*args: str, entrada: str | None = None) -> str:
    r = subprocess.run(["gh", *args], input=entrada, capture_output=True, text=True, encoding="utf-8", check=True)
    return r.stdout


def issue_abierto() -> dict | None:
    js = _gh("issue", "list", "--label", ETIQUETA, "--state", "open", "--limit", "20", "--json", "number,title,body")
    issues = [i for i in json.loads(js) if i["title"] == TITULO_ISSUE]
    return min(issues, key=lambda i: i["number"]) if issues else None


def publicar(cuerpo: str, issue: dict | None, nuevas: list[str], resultados: list[Resultado]) -> None:
    _gh("label", "create", ETIQUETA, "--color", "D93F0B", "--description", "Vigilancia y mantenimiento de data/", "--force")
    if issue is None:
        url = _gh("issue", "create", "--title", TITULO_ISSUE, "--label", ETIQUETA, "--body-file", "-", entrada=cuerpo).strip()
        print(f"vigilancia: issue creado {url}")
        return
    numero = str(issue["number"])
    _gh("issue", "edit", numero, "--body-file", "-", entrada=cuerpo)
    print(f"vigilancia: issue #{numero} actualizado")
    if nuevas:
        por_id = {r.fuente["id"]: r for r in resultados}
        lineas = ["Novedades nuevas desde la revisión anterior:", ""]
        nombres = {"CAIDA": "🔴 Caída", "CAMBIO": "🟠 Cambió", "REDIRIGE": "🟠 Redirige"}
        for clave in nuevas:
            estado, fid = clave.split(":", 1)
            r = por_id.get(fid)
            titulo = r.fuente.get("titulo", fid) if r else fid
            lineas.append(f"- {nombres.get(estado, estado)}: **{titulo}** (`{fid}`)")
        _gh("issue", "comment", numero, "--body-file", "-", entrada="\n".join(lineas))
        print(f"vigilancia: comentario con {len(nuevas)} novedades nuevas")


# ---------------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------------

def cargar_datos(carpeta: Path) -> dict:
    datos = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in carpeta.glob("*.json")}
    if "fuentes.json" not in datos or "meta.json" not in datos:
        raise SystemExit(f"vigilancia: no encuentro fuentes.json o meta.json en {carpeta}")
    return datos


@dataclass
class Corrida:
    reporte: str
    estado: dict
    nuevas: list[str]
    resultados: list[Resultado] = field(default_factory=list)


def vigilar(
    datos: dict,
    estado_previo: dict,
    hoy: date,
    consultar_url: Callable[..., Respuesta] = consultar,
    pausa: float = PAUSA_S,
    reintento: float = REINTENTO_S,
) -> Corrida:
    fuentes = [f for f in datos["fuentes.json"] if f.get("url")]
    dias = int(datos["meta.json"].get("vigilancia", {}).get("dias_sin_revision", DIAS_SIN_REVISION_DEFECTO))
    previos = estado_previo.get("fuentes", {})

    resultados: list[Resultado] = []
    nuevos: dict[str, dict] = {}
    for i, f in enumerate(fuentes):
        if i > 0 and pausa:
            time.sleep(pausa)
        resp = consultar_url(f["url"])
        if not resp.ok and reintento:
            time.sleep(reintento)  # una falla puntual (límite anti-bots, timeout) no cuenta si el reintento responde
            resp = consultar_url(f["url"], TIMEOUT_REINTENTO_S)
        r, e = clasificar(f, resp, previos.get(f["id"]), hoy.isoformat())
        resultados.append(r)
        nuevos[f["id"]] = e
        print(f"  {r.estado:<8} {f['id']}" + (f" · {r.detalle}" if r.detalle else ""), file=sys.stderr)

    usos = impacto(datos)
    reporte = armar_reporte(resultados, usos, sin_revisar(datos["fuentes.json"], usos, hoy, dias), recordatorios(datos, hoy), hoy, dias)
    actuales = novedades(resultados)
    nuevas = sorted(set(actuales) - set(estado_previo.get("novedades", [])))
    estado = {"fuentes": nuevos, "novedades": actuales, "revisado": hoy.isoformat()}
    return Corrida(reporte, estado, nuevas, resultados)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="solo imprime el reporte; no toca GitHub")
    ap.add_argument("--estado-local", type=Path, help="archivo JSON para recordar el estado entre corridas locales")
    ap.add_argument("--data", type=Path, default=ROOT / "data", help="carpeta de datos (por defecto data/)")
    ap.add_argument("--hoy", type=date.fromisoformat, default=None, help="fecha de la revisión (yyyy-mm-dd)")
    args = ap.parse_args(argv)

    hoy = args.hoy or date.today()
    datos = cargar_datos(args.data)

    issue = None
    if args.estado_local and args.estado_local.exists():
        previo = json.loads(args.estado_local.read_text(encoding="utf-8"))
    elif args.dry_run:
        previo = {"fuentes": {}, "novedades": []}
    else:
        issue = issue_abierto()
        previo = leer_estado(issue["body"] if issue else None)

    print(f"vigilancia: revisando {sum(1 for f in datos['fuentes.json'] if f.get('url'))} fuentes…", file=sys.stderr)
    corrida = vigilar(datos, previo, hoy)

    if args.estado_local:
        args.estado_local.write_text(json.dumps(corrida.estado, ensure_ascii=False, indent=1), encoding="utf-8")
    if args.dry_run:
        print(f"# {TITULO_ISSUE}\n\n{corrida.reporte}")
        if corrida.nuevas:
            print("\nNovedades nuevas: " + ", ".join(corrida.nuevas))
        return 0
    publicar(escribir_estado(corrida.reporte, corrida.estado), issue, corrida.nuevas, corrida.resultados)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    sys.exit(main())
