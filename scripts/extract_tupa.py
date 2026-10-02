"""Extracción asistida por IA de los montos de edificación de un TUPA (Fase 10).

Lee el PDF del TUPA de un distrito, le pide a Claude las tasas de los procedimientos de
edificación que existen en data/procedimientos.json y propone los cambios en
data/tarifas_distritales.json como un PR `data:`. TODO entra como "por_verificar": quien revisa
compara cada fila con el PDF y marca "verificado" solo lo que confirmó. Nunca hace auto-merge ni
borra filas existentes.

Uso:
  python scripts/extract_tupa.py --ubigeo 150142 --pdf tupa.pdf --dry-run
      # lee el PDF y muestra qué páginas enviaría (sin API, sin escribir nada)
  python scripts/extract_tupa.py --ubigeo 150142 --pdf https://.../tupa.pdf --sin-pr
      # llama a la API, escribe data/ en local y muestra el reporte (sin git)
  python scripts/extract_tupa.py --ubigeo 150142 --pdf tupa.pdf
      # todo: rama data/tupa-<ubigeo>-<fecha>, commit y PR (usa git y gh)

Opciones útiles: --fuente-id F-... (por defecto, la del TUPA del distrito), --anio 2025,
--paginas 10-40,52 (en vez de buscarlas por palabras clave), --guardar-respuestas r.json y
--desde-respuestas r.json (repite una corrida sin volver a pagar la API).

Requiere: pdfplumber; para PDF escaneados, pytesseract + Tesseract con el idioma "spa";
para la API, el paquete anthropic y la clave en ANTHROPIC_API_KEY (nunca en el repo).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent.parent
REPO_URL = "https://github.com/XeanN/ruta-obra"
USER_AGENT = f"RutaObra-extraccion/1.0 (+{REPO_URL})"

MODELO = "claude-opus-5-5"
PAGINAS_POR_LOTE = 12
# Fallback del servidor si el modelo declina por un falso positivo de sus filtros de seguridad.
BETA_FALLBACK = "server-side-fallback-2026-07-01"

# Páginas que se envían si no se indica --paginas: las que hablan de edificación.
PALABRAS_CLAVE = (
    "licencia de edificacion",
    "edificacion",
    "conformidad de obra",
    "declaratoria",
    "anteproyecto",
    "parametros urbanisticos",
    "demolicion",
    "regularizacion",
    "subdivision",
    "numeracion",
    "revalidacion",
    "prorroga",
)

# Títulos que mencionan edificaciones pero no son trámites de obra.
EXCLUIR = (
    "licencia de funcionamiento",
    "inspeccion tecnica de seguridad",
    "publicidad exterior",
    "espectaculos",
    "condiciones de seguridad",
)

# Encabezado con el que empieza cada procedimiento en los TUPA del formato del SUT.
INICIO_PROCEDIMIENTO = "denominacion del procedimiento"

NUEVA, CAMBIO, IGUAL = "NUEVA", "CAMBIÓ", "IGUAL"


class ErrorExtraccion(Exception):
    pass


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------


@dataclass
class Pagina:
    numero: int  # 1-indexada, como la muestra un visor de PDF
    texto: str
    origen: str  # "texto" | "ocr" | "vacia"


def sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def descargar(url: str, destino: Path) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, "wb") as f:
        f.write(r.read())
    return destino


def ocr_pagina(pagina) -> str:
    """OCR de una página de pdfplumber (Tesseract, español). Lanza ImportError si no está instalado."""
    import pytesseract  # solo hace falta para PDF escaneados

    imagen = pagina.to_image(resolution=300).original
    return pytesseract.image_to_string(imagen, lang="spa")


def leer_pdf(ruta: Path, ocr: Callable | None = ocr_pagina) -> tuple[list[Pagina], list[str]]:
    """Texto de cada página; las páginas sin texto (escaneadas) pasan por OCR si se puede."""
    import pdfplumber

    paginas: list[Pagina] = []
    avisos: list[str] = []
    sin_ocr = False
    with pdfplumber.open(ruta) as pdf:
        for i, p in enumerate(pdf.pages, start=1):
            texto = (p.extract_text() or "").strip()
            if texto:
                paginas.append(Pagina(i, texto, "texto"))
                continue
            if ocr and not sin_ocr:
                try:
                    texto = (ocr(p) or "").strip()
                except Exception as e:  # pytesseract ausente o Tesseract no instalado
                    sin_ocr = True
                    avisos.append(f"OCR no disponible ({type(e).__name__}): las páginas escaneadas quedan sin leer.")
                    texto = ""
            paginas.append(Pagina(i, texto, "ocr" if texto else "vacia"))
    vacias = [p.numero for p in paginas if p.origen == "vacia"]
    if vacias:
        avisos.append(f"{len(vacias)} páginas sin texto legible: {rangos(vacias)}.")
    return paginas, avisos


def rangos(numeros: list[int]) -> str:
    """[1,2,3,7] → "1-3, 7"."""
    partes: list[str] = []
    for n in sorted(set(numeros)):
        if partes and n == int(partes[-1].split("-")[-1]) + 1:
            partes[-1] = f"{partes[-1].split('-')[0]}-{n}"
        else:
            partes.append(str(n))
    return ", ".join(partes)


def parsear_paginas(spec: str) -> set[int]:
    """ "10-12,15" → {10, 11, 12, 15}."""
    numeros: set[int] = set()
    for parte in spec.split(","):
        parte = parte.strip()
        if not parte:
            continue
        if "-" in parte:
            a, b = (int(x) for x in parte.split("-", 1))
            numeros.update(range(min(a, b), max(a, b) + 1))
        else:
            numeros.add(int(parte))
    return numeros


def _clave(texto: str) -> str:
    return sin_tildes(texto.lower())


def bloques(paginas: list[Pagina]) -> list[list[Pagina]]:
    """Agrupa las páginas por procedimiento. En el formato del SUT cada procedimiento empieza con
    "Denominación del Procedimiento" y sigue en las páginas siguientes, donde a veces está el monto.
    Las páginas anteriores al primer procedimiento (índice, portada) van solas."""
    grupos: list[list[Pagina]] = []
    abierto = False
    for p in paginas:
        inicio = INICIO_PROCEDIMIENTO in _clave(p.texto)
        if inicio or not abierto:
            grupos.append([p])
            abierto = inicio
        else:
            grupos[-1].append(p)
    return grupos


def titulo_procedimiento(texto: str) -> str | None:
    """Nombre del procedimiento (sin tildes, en minúsculas) en una página del formato del SUT."""
    clave = _clave(texto)
    i = clave.find(INICIO_PROCEDIMIENTO)
    if i < 0:
        return None
    j = clave.find("codigo:", i)
    return clave[i + len(INICIO_PROCEDIMIENTO) : j if j > 0 else i + 400]


def es_de_obra(titulo: str) -> bool:
    """Un nombre de trámite de obra: "licencia de edificación", "conformidad de obra"… siempre; la
    sola palabra "edificación", solo si no es de funcionamiento, seguridad, publicidad o eventos."""
    if any(k in titulo for k in PALABRAS_CLAVE if k != "edificacion"):
        return True
    return "edificacion" in titulo and not any(x in titulo for x in EXCLUIR)


def seleccionar(paginas: list[Pagina], indicadas: set[int] | None = None) -> list[list[Pagina]]:
    """Bloques a enviar: los indicados con --paginas, o los procedimientos de obra según su título
    (formato del SUT). Sin esa estructura, cada página con palabras clave va con la siguiente."""
    if indicadas:
        return [[p] for p in paginas if p.numero in indicadas and p.texto]
    grupos = bloques(paginas)
    titulos = [titulo_procedimiento(g[0].texto) for g in grupos]
    if any(t is not None for t in titulos):
        elegidos = [g for g, t in zip(grupos, titulos) if t is not None and es_de_obra(t)]
    else:
        elegidos, tomadas = [], set()
        for i, p in enumerate(paginas):
            if p.numero not in tomadas and es_de_obra(_clave(p.texto)):
                elegidos.append(paginas[i : i + 2])
                tomadas.update(x.numero for x in paginas[i : i + 2])
    return [[p for p in g if p.texto] for g in elegidos if any(p.texto for p in g)]


def lotes(grupos: list[list[Pagina]], tamano: int = PAGINAS_POR_LOTE) -> list[list[Pagina]]:
    """Junta bloques hasta ~`tamano` páginas por lote, sin partir un procedimiento entre lotes."""
    resultado: list[list[Pagina]] = []
    for g in grupos:
        if resultado and len(resultado[-1]) + len(g) <= tamano:
            resultado[-1] += g
        else:
            resultado.append(list(g))
    return resultado


def texto_lote(lote: list[Pagina]) -> str:
    return "\n\n".join(
        f"=== Página {p.numero}{' (texto por OCR)' if p.origen == 'ocr' else ''} ===\n{p.texto}" for p in lote
    )


# ---------------------------------------------------------------------------
# Llamada al modelo
# ---------------------------------------------------------------------------


def _nulable(tipo: str) -> dict:
    return {"anyOf": [{"type": tipo}, {"type": "null"}]}


def esquema_respuesta(ids_procedimientos: list[str]) -> dict:
    """Salida estructurada: filas mapeadas a procedimientos conocidos y lo que no se pudo mapear."""
    fila = {
        "type": "object",
        "additionalProperties": False,
        "required": ["procedimiento_id", "variante", "codigo_tupa", "derecho_soles", "plazo_dias_habiles", "pagina", "denominacion"],
        "properties": {
            "procedimiento_id": {"type": "string", "enum": ids_procedimientos},
            "variante": {"type": "string"},
            "codigo_tupa": _nulable("string"),
            "derecho_soles": _nulable("number"),
            "plazo_dias_habiles": _nulable("integer"),
            "pagina": {"type": "integer"},
            "denominacion": {"type": "string"},
        },
    }
    no_reconocido = {
        "type": "object",
        "additionalProperties": False,
        "required": ["codigo_tupa", "denominacion", "derecho_soles", "pagina"],
        "properties": {
            "codigo_tupa": _nulable("string"),
            "denominacion": {"type": "string"},
            "derecho_soles": _nulable("number"),
            "pagina": {"type": "integer"},
        },
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["filas", "no_reconocidos"],
        "properties": {
            "filas": {"type": "array", "items": fila},
            "no_reconocidos": {"type": "array", "items": no_reconocido},
        },
    }


def instrucciones(procedimientos: list[dict], distrito: str, anio: int) -> str:
    lista = "\n".join(f"- {p['id']}: {p['nombre']}" for p in procedimientos)
    return f"""Extraes tasas del TUPA {anio} de la municipalidad de {distrito} (Lima, Perú) para una base de datos que revisa una persona contra el PDF.

Recibes el texto de algunas páginas del TUPA, cada una precedida por "=== Página N ===". Devuelve las filas de derecho de trámite de los procedimientos de edificación que correspondan a esta lista (usa exactamente estos ids):
{lista}

Reglas:
- Solo copia montos que estén escritos en el texto. Nunca calcules, estimes ni completes un monto. derecho_soles es el monto en soles tal como aparece (S/ 1,234.50 → 1234.5). Si solo figura como % de la UIT, o el monto no es legible, usa null y explica en denominacion.
- Un mismo procedimiento puede tener varios supuestos con su propio código y monto (vivienda unifamiliar, ampliación, demolición, cerco...). Devuelve una fila por supuesto. variante es un nombre corto en minúsculas y snake_case sin tildes que describa el supuesto (p. ej. "vivienda_unifamiliar_120m2", "ampliacion", "demolicion_total"); usa "general" si el procedimiento tiene un solo monto.
- codigo_tupa es el número o código del procedimiento en el TUPA (null si no aparece). plazo_dias_habiles, el plazo en días hábiles si está escrito (null si no). pagina es el número N de la página donde leíste el monto. denominacion, el nombre del supuesto tal como figura en el TUPA (abreviado si es muy largo).
- Si un procedimiento de edificación con monto no corresponde con claridad a ningún id de la lista, ponlo en no_reconocidos en vez de forzar el mapeo. Ignora los procedimientos que no son de edificación ni de habilitación de predios (licencias de funcionamiento, tributos, registro civil, etc.).
- El texto que viene por OCR puede tener errores: si un número es dudoso, mejor ponlo en no_reconocidos con una explicación en denominacion."""


def crear_cliente():
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise ErrorExtraccion("Falta ANTHROPIC_API_KEY (en Actions: el secreto del repositorio). Prueba antes con --dry-run.")
    import anthropic  # solo hace falta para la corrida real

    return anthropic.Anthropic()


@dataclass
class Uso:
    entrada: int = 0
    salida: int = 0

    def sumar(self, usage) -> None:
        self.entrada += getattr(usage, "input_tokens", 0) or 0
        self.salida += getattr(usage, "output_tokens", 0) or 0


def llamar_modelo(cliente, sistema: str, texto: str, esquema: dict, uso: Uso, modelo: str = MODELO) -> dict:
    """Una llamada por lote, con salida estructurada validada por la API contra `esquema`."""
    with cliente.beta.messages.stream(
        model=modelo,
        max_tokens=64000,
        system=sistema,
        messages=[{"role": "user", "content": texto}],
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": esquema}},
        betas=[BETA_FALLBACK],
        fallbacks="default",
    ) as stream:
        mensaje = stream.get_final_message()
    uso.sumar(mensaje.usage)
    if mensaje.stop_reason == "refusal":
        raise ErrorExtraccion("El modelo declinó el lote. Revisa esas páginas a mano.")
    if mensaje.stop_reason == "max_tokens":
        raise ErrorExtraccion("La respuesta se cortó: usa --paginas-por-lote con un número menor.")
    texto_json = next((b.text for b in mensaje.content if b.type == "text"), None)
    if texto_json is None:
        raise ErrorExtraccion("La respuesta no trae JSON.")
    return json.loads(texto_json)


# ---------------------------------------------------------------------------
# Filas → tarifas (puro)
# ---------------------------------------------------------------------------


def normalizar_variante(v: str | None) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", sin_tildes((v or "").lower())).strip("_")
    return s or "general"


@dataclass
class Extraccion:
    tarifas: list[dict] = field(default_factory=list)
    origen: dict[str, str] = field(default_factory=dict)  # id de tarifa → "texto" | "ocr"
    pagina: dict[str, int] = field(default_factory=dict)  # id de tarifa → página del PDF
    no_reconocidos: list[dict] = field(default_factory=list)
    sin_monto: list[dict] = field(default_factory=list)
    conflictos: list[str] = field(default_factory=list)


def armar_tarifas(
    respuestas: list[dict],
    ubigeo: str,
    fuente_id: str,
    anio: int,
    paginas: dict[int, Pagina],
    ids_validos: set[str],
) -> Extraccion:
    """Convierte las respuestas del modelo en filas de tarifas_distritales.json, todas por_verificar."""
    ex = Extraccion()
    for r in respuestas:
        ex.no_reconocidos += r.get("no_reconocidos", [])
        for f in r.get("filas", []):
            proc = f.get("procedimiento_id")
            monto = f.get("derecho_soles")
            if proc not in ids_validos:
                ex.no_reconocidos.append({**f, "denominacion": f"{f.get('denominacion', '')} (id desconocido: {proc})"})
                continue
            if monto is None or monto < 0:
                ex.sin_monto.append(f)
                continue
            variante = normalizar_variante(f.get("variante"))
            tid = f"T-{ubigeo}-{proc}-{variante}"
            numero = int(f.get("pagina") or 0)
            origen = paginas[numero].origen if numero in paginas else "texto"
            monto = round(float(monto), 2)
            previa = next((t for t in ex.tarifas if t["id"] == tid), None)
            if previa:
                # Lotes solapados o el mismo supuesto en dos páginas: se queda la primera lectura.
                if previa["derecho_soles"] != monto:
                    ex.conflictos.append(
                        f"`{tid}`: S/ {previa['derecho_soles']} (pág. {ex.pagina[tid]}) y S/ {monto} (pág. {numero}); se dejó el primero."
                    )
                continue
            codigo = f.get("codigo_tupa")
            nota = f"TUPA {anio}, pág. {numero}" + (" (leído por OCR: revisar con cuidado)" if origen == "ocr" else "")
            ex.tarifas.append(
                {
                    "id": tid,
                    "ubigeo": ubigeo,
                    "procedimiento_id": proc,
                    "variante": variante,
                    "codigo_tupa": str(codigo) if codigo not in (None, "") else None,
                    "derecho_soles": monto,
                    "plazo_dias_habiles": f.get("plazo_dias_habiles"),
                    "fuente_id": fuente_id,
                    "estado_verificacion": "por_verificar",
                    "nota": nota,
                }
            )
            ex.origen[tid] = origen
            ex.pagina[tid] = numero
    return ex


@dataclass
class Cambio:
    tipo: str  # NUEVA | CAMBIÓ | IGUAL
    fila: dict
    anterior: dict | None = None


def comparar(existentes: list[dict], extraidas: list[dict]) -> list[Cambio]:
    por_id = {t["id"]: t for t in existentes}
    por_clave = {(t["ubigeo"], t["procedimiento_id"], t["variante"]): t for t in existentes}
    cambios: list[Cambio] = []
    for f in extraidas:
        previa = por_id.get(f["id"]) or por_clave.get((f["ubigeo"], f["procedimiento_id"], f["variante"]))
        if previa is None:
            cambios.append(Cambio(NUEVA, f))
        elif previa.get("derecho_soles") != f["derecho_soles"]:
            cambios.append(Cambio(CAMBIO, f, previa))
        else:
            cambios.append(Cambio(IGUAL, f, previa))
    return cambios


def aplicar(existentes: list[dict], cambios: list[Cambio]) -> list[dict]:
    """Nueva lista de tarifas: corrige las que cambiaron y agrega las nuevas junto a su distrito.
    Nunca borra filas; las IGUAL no se tocan."""
    resultado = [dict(t) for t in existentes]
    indice = {t["id"]: i for i, t in enumerate(resultado)}
    for c in cambios:
        if c.tipo != CAMBIO or c.anterior is None:
            continue
        t = resultado[indice[c.anterior["id"]]]
        t["derecho_soles"] = c.fila["derecho_soles"]
        t["codigo_tupa"] = c.fila["codigo_tupa"] or t.get("codigo_tupa")
        if c.fila.get("plazo_dias_habiles") is not None:
            t["plazo_dias_habiles"] = c.fila["plazo_dias_habiles"]
        t["fuente_id"] = c.fila["fuente_id"]
        t["estado_verificacion"] = "por_verificar"
        t["nota"] = c.fila["nota"]
    nuevas = [c.fila for c in cambios if c.tipo == NUEVA]
    if nuevas:
        ubigeo = nuevas[0]["ubigeo"]
        ultimas = [i for i, t in enumerate(resultado) if t["ubigeo"] == ubigeo]
        pos = (ultimas[-1] + 1) if ultimas else len(resultado)
        resultado[pos:pos] = nuevas
    return resultado


def marcadores_pendientes(existentes: list[dict], cambios: list[Cambio], ubigeo: str) -> list[dict]:
    """Filas sin monto del distrito que no se tocaron, de procedimientos que ahora tienen montos:
    probablemente ya sobran, pero no se borran solas (las borra quien revisa)."""
    tocadas = {c.anterior["id"] for c in cambios if c.anterior}
    con_monto = {c.fila["procedimiento_id"] for c in cambios if c.tipo in (NUEVA, CAMBIO)}
    return [
        t
        for t in existentes
        if t["ubigeo"] == ubigeo
        and t.get("derecho_soles") is None
        and t["id"] not in tocadas
        and t["procedimiento_id"] in con_monto
    ]


def validar_tarifas(tarifas: list[dict], esquema_datos: dict) -> list[str]:
    """Errores de las filas contra el $def "tarifa" de schema/data.schema.json."""
    import jsonschema

    validador = jsonschema.Draft202012Validator({"$ref": "#/$defs/tarifa", "$defs": esquema_datos["$defs"]})
    errores = []
    for t in tarifas:
        for e in validador.iter_errors(t):
            errores.append(f"{t.get('id')}: {e.message}")
    return errores


# ---------------------------------------------------------------------------
# Reporte (cuerpo del PR)
# ---------------------------------------------------------------------------


def _soles(m) -> str:
    return "—" if m is None else f"S/ {m:,.2f}"


def armar_reporte(
    distrito: str,
    ubigeo: str,
    anio: int,
    fuente: dict,
    pdf: str,
    cambios: list[Cambio],
    ex: Extraccion,
    marcadores: list[dict],
    avisos: list[str],
    paginas_enviadas: list[int],
    uso: Uso | None,
    nombres: dict[str, str],
) -> str:
    cuenta = {t: sum(1 for c in cambios if c.tipo == t) for t in (NUEVA, CAMBIO, IGUAL)}
    l = [
        f"Montos de edificación del **TUPA {anio} de {distrito}** (`{ubigeo}`), extraídos con IA de {pdf}.",
        f"Fuente: **{fuente['titulo']}** (`{fuente['id']}`) — {fuente['url']}",
        "",
        f"**{cuenta[NUEVA]} nuevas · {cuenta[CAMBIO]} cambiaron · {cuenta[IGUAL]} iguales** · "
        f"páginas enviadas: {rangos(paginas_enviadas) or 'ninguna'}"
        + (f" · tokens: {uso.entrada:,} de entrada y {uso.salida:,} de salida" if uso else ""),
        "",
        "> ⚠️ Todas las filas nuevas o corregidas entran como `por_verificar` (en la app: \"Por confirmar\"). "
        "Compara cada una con el PDF en la página indicada y cambia a `verificado` en este mismo PR **solo** las "
        "que confirmaste. Nunca hagas auto-merge de este PR.",
        "",
        "## Filas",
        "",
        "| Estado | Código | Procedimiento | Variante | Monto | Página | Origen |",
        "|---|---|---|---|---|---|---|",
    ]
    orden = {CAMBIO: 0, NUEVA: 1, IGUAL: 2}
    for c in sorted(cambios, key=lambda c: (orden[c.tipo], c.fila["procedimiento_id"], c.fila["variante"])):
        f = c.fila
        monto = _soles(f["derecho_soles"])
        if c.tipo == CAMBIO and c.anterior is not None:
            monto = f"{_soles(c.anterior.get('derecho_soles'))} → {monto}"
        origen = "⚠️ OCR" if ex.origen.get(f["id"]) == "ocr" else "texto"
        nombre = nombres.get(f["procedimiento_id"], f["procedimiento_id"])
        l.append(
            f"| {c.tipo} | {f['codigo_tupa'] or '—'} | {nombre} (`{f['procedimiento_id']}`) | `{f['variante']}` | "
            f"{monto} | {ex.pagina.get(f['id'], '—')} | {origen} |"
        )
    if not cambios:
        l.append("| — | — | No se extrajo ninguna fila con monto | — | — | — | — |")

    if ex.no_reconocidos:
        l += ["", "## No reconocidos (no van a los datos)", "", "| Código | Denominación | Monto | Página |", "|---|---|---|---|"]
        for n in ex.no_reconocidos:
            l.append(f"| {n.get('codigo_tupa') or '—'} | {n.get('denominacion', '')} | {_soles(n.get('derecho_soles'))} | {n.get('pagina', '—')} |")
    if ex.sin_monto:
        l += ["", "## Sin monto legible (no van a los datos)", ""]
        l += [f"- `{s.get('procedimiento_id')}` · {s.get('denominacion', '')} · pág. {s.get('pagina', '—')}" for s in ex.sin_monto]
    if ex.conflictos:
        l += ["", "## Montos distintos para la misma fila", ""] + [f"- {c}" for c in ex.conflictos]
    if marcadores:
        l += [
            "",
            "## Filas sin monto que probablemente sobran",
            "",
            "Estos procedimientos ahora tienen montos por variante. El script no borra filas: si ya no aplican, bórralas en este PR.",
            "",
        ] + [f"- `{t['id']}`" for t in marcadores]
    if avisos:
        l += ["", "## Avisos", ""] + [f"- {a}" for a in avisos]
    l += [
        "",
        "## Antes del merge",
        "",
        "- [ ] Comparé cada fila con el PDF en su página.",
        "- [ ] Cambié a `verificado` solo las filas que confirmé.",
        "- [ ] Si el TUPA es un documento nuevo, está en `data/fuentes.json` con su `fecha_consulta`.",
        "- [ ] Corrí `validate_data.py`, `simulate.py --export` y `export_excel.py` después de editar.",
        "",
        "Generado por `scripts/extract_tupa.py` (Fase 10).",
    ]
    return "\n".join(l)


# ---------------------------------------------------------------------------
# Orquestación
# ---------------------------------------------------------------------------


def cargar(nombre: str, carpeta: Path) -> list | dict:
    return json.loads((carpeta / nombre).read_text(encoding="utf-8"))


def escribir_tarifas(tarifas: list[dict], carpeta: Path) -> None:
    # Mismo formato que el archivo versionado: 2 espacios, sin escapar tildes, sin salto final.
    (carpeta / "tarifas_distritales.json").write_text(json.dumps(tarifas, ensure_ascii=False, indent=2), encoding="utf-8")


def correr(cmd: list[str]) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def publicar_pr(ubigeo: str, distrito: str, anio: int, hoy: str, cuerpo: str) -> None:
    rama = f"data/tupa-{ubigeo}-{hoy}"
    for script in (["validate_data.py"], ["simulate.py"], ["simulate.py", "--export"], ["export_excel.py"]):
        correr([sys.executable, str(ROOT / "scripts" / script[0]), *script[1:]])
    titulo = f"data: montos TUPA {distrito} {anio} (por verificar)"
    correr(["git", "checkout", "-b", rama])
    correr(["git", "add", "data/tarifas_distritales.json", "data/ruta-obra.xlsx", "fixtures/resultados-motor.json"])
    correr(["git", "commit", "-m", titulo])
    correr(["git", "push", "-u", "origin", rama])
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(cuerpo)
    correr(["gh", "pr", "create", "--base", "master", "--head", rama, "--title", titulo, "--body-file", f.name])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ubigeo", required=True, help="ubigeo del distrito (6 dígitos, debe existir en data/distritos.json)")
    ap.add_argument("--pdf", required=True, help="ruta local o URL del PDF del TUPA")
    ap.add_argument("--fuente-id", help="fuente del TUPA en data/fuentes.json (por defecto, la del distrito)")
    ap.add_argument("--anio", type=int, help="año del TUPA (por defecto, el de data/distritos.json)")
    ap.add_argument("--paginas", help="páginas a enviar, p. ej. 10-40,52 (por defecto, las que hablan de edificación)")
    ap.add_argument("--paginas-por-lote", type=int, default=PAGINAS_POR_LOTE)
    ap.add_argument("--modelo", default=MODELO)
    ap.add_argument("--dry-run", action="store_true", help="solo lee el PDF y muestra qué enviaría; sin API ni escritura")
    ap.add_argument("--sin-pr", action="store_true", help="escribe data/ en local y muestra el reporte, sin git")
    ap.add_argument("--sin-ocr", action="store_true", help="no intenta OCR en las páginas escaneadas")
    ap.add_argument("--guardar-respuestas", type=Path, help="guarda las respuestas del modelo en este JSON")
    ap.add_argument("--desde-respuestas", type=Path, help="usa respuestas guardadas en vez de llamar a la API")
    ap.add_argument("--data", type=Path, default=ROOT / "data")
    ap.add_argument("--reporte", type=Path, help="además, escribe el reporte en este archivo")
    a = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # consola de Windows: tildes, → y ⚠️
        sys.stderr.reconfigure(encoding="utf-8")

    data = a.data
    distritos = {d["ubigeo"]: d for d in cargar("distritos.json", data)}
    distrito = distritos.get(a.ubigeo)
    if distrito is None:
        print(f"El ubigeo {a.ubigeo} no está en data/distritos.json: agrégalo primero (ver \"Agregar un distrito\").", file=sys.stderr)
        return 2
    fuentes = {f["id"]: f for f in cargar("fuentes.json", data)}
    fuente_id = a.fuente_id or (distrito.get("tupa") or {}).get("fuente_id")
    if not fuente_id or fuente_id not in fuentes:
        print(f"La fuente {fuente_id!r} no está en data/fuentes.json: agrega el TUPA como fuente y pásala con --fuente-id.", file=sys.stderr)
        return 2
    anio = a.anio or (distrito.get("tupa") or {}).get("anio") or date.today().year
    procedimientos = [p for p in cargar("procedimientos.json", data) if p["id"].startswith("P-MUN-")]
    nombres = {p["id"]: p["nombre"] for p in procedimientos}

    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(a.pdf)
        if re.match(r"^https?://", a.pdf):
            print(f"Descargando {a.pdf}…", flush=True)
            ruta = descargar(a.pdf, Path(tmp) / "tupa.pdf")
        paginas, avisos = leer_pdf(ruta, None if a.sin_ocr else ocr_pagina)

    elegidos = seleccionar(paginas, parsear_paginas(a.paginas) if a.paginas else None)
    seleccion = [p for g in elegidos for p in g]
    grupos = lotes(elegidos, a.paginas_por_lote)
    numeros = [p.numero for p in seleccion]
    caracteres = sum(len(p.texto) for p in seleccion)
    print(
        f"{distrito['nombre']} ({a.ubigeo}) · TUPA {anio} · {len(paginas)} páginas en el PDF · "
        f"{len(seleccion)} seleccionadas ({rangos(numeros) or 'ninguna'}) · {len(grupos)} lotes · "
        f"~{caracteres // 4:,} tokens de texto",
        flush=True,
    )
    for av in avisos:
        print(f"Aviso: {av}")
    if a.dry_run:
        return 0
    if not seleccion:
        print("No hay páginas que enviar: indica --paginas o revisa si el PDF es escaneado (OCR).", file=sys.stderr)
        return 1

    uso = Uso()
    if a.desde_respuestas:
        respuestas = json.loads(a.desde_respuestas.read_text(encoding="utf-8"))
        uso = None
    else:
        cliente = crear_cliente()
        sistema = instrucciones(procedimientos, distrito["nombre"], anio)
        esquema = esquema_respuesta(sorted(nombres))
        respuestas = []
        for i, lote in enumerate(grupos, start=1):
            print(f"Lote {i}/{len(grupos)}: páginas {rangos([p.numero for p in lote])}…", flush=True)
            respuestas.append(llamar_modelo(cliente, sistema, texto_lote(lote), esquema, uso, a.modelo))
        if a.guardar_respuestas:
            a.guardar_respuestas.write_text(json.dumps(respuestas, ensure_ascii=False, indent=2), encoding="utf-8")

    ex = armar_tarifas(respuestas, a.ubigeo, fuente_id, anio, {p.numero: p for p in paginas}, set(nombres))
    errores = validar_tarifas(ex.tarifas, cargar("data.schema.json", ROOT / "schema"))
    if errores:
        print("Filas que no cumplen el esquema (no se escribe nada):\n" + "\n".join(errores), file=sys.stderr)
        return 1
    existentes = cargar("tarifas_distritales.json", data)
    cambios = comparar(existentes, ex.tarifas)
    marcadores = marcadores_pendientes(existentes, cambios, a.ubigeo)
    reporte = armar_reporte(
        distrito["nombre"], a.ubigeo, anio, fuentes[fuente_id], a.pdf, cambios, ex, marcadores, avisos, numeros, uso, nombres
    )
    if a.reporte:
        a.reporte.write_text(reporte, encoding="utf-8")
    print("\n" + reporte)

    if not any(c.tipo in (NUEVA, CAMBIO) for c in cambios):
        print("\nNada que cambiar en data/.")
        return 0
    escribir_tarifas(aplicar(existentes, cambios), data)
    if a.sin_pr:
        print("\ndata/tarifas_distritales.json actualizado en local (sin PR).")
        return 0
    publicar_pr(a.ubigeo, distrito["nombre"], anio, date.today().isoformat(), reporte)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ErrorExtraccion as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
