"""Pruebas de scripts/extract_tupa.py (sin red ni API: el PDF se genera aquí y el modelo se simula)."""
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import extract_tupa as et  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
UBIGEO = "150142"  # Villa El Salvador
FUENTE = "F-VES-TUPA25"


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def pdf_minimo(paginas: list[list[str]]) -> bytes:
    """PDF válido con una página por lista de líneas (Helvetica, WinAnsi). Una lista vacía es una
    página sin texto, como la de un PDF escaneado."""
    objetos: list[bytes] = [b"<< /Type /Catalog /Pages 2 0 R >>"]
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(len(paginas)))
    objetos.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(paginas)} >>".encode())
    objetos.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    for i, lineas in enumerate(paginas):
        texto = "".join(f"({_esc(l)}) Tj T* " for l in lineas)
        contenido = f"BT /F1 10 Tf 14 TL 40 760 Td {texto}ET".encode("latin-1") if lineas else b""
        objetos.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> "
            f"/Contents {5 + 2 * i} 0 R >>".encode()
        )
        objetos.append(b"<< /Length %d >>\nstream\n" % len(contenido) + contenido + b"\nendstream")
    salida = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, obj in enumerate(objetos, start=1):
        offsets.append(len(salida))
        salida += f"{n} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n0000000000 65535 f \n".encode()
    salida += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    salida += f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(salida)


PAGINAS = [
    ["Municipalidad Distrital de Villa El Salvador", "Texto Único de Procedimientos Administrativos 2025"],
    [
        "Licencia de edificación - Modalidad A",
        "093 Vivienda unifamiliar hasta 120 m2  S/ 649.70",
        "Conformidad de obra y declaratoria de edificación sin variaciones  S/ 410.20",
    ],
    [],  # página escaneada
    ["Licencia de funcionamiento para bodegas  S/ 50.00"],
]


@pytest.fixture
def pdf(tmp_path: Path) -> Path:
    ruta = tmp_path / "tupa.pdf"
    ruta.write_bytes(pdf_minimo(PAGINAS))
    return ruta


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------


def test_leer_pdf_texto_y_ocr(pdf):
    paginas, avisos = et.leer_pdf(pdf, ocr=lambda p: "Demolición total  S/ 300.00")
    assert [p.origen for p in paginas] == ["texto", "texto", "ocr", "texto"]
    assert "649.70" in paginas[1].texto
    assert "edificación" in paginas[1].texto
    assert paginas[2].texto.startswith("Demolición")
    assert avisos == []


def test_leer_pdf_sin_ocr_disponible_avisa_y_marca_vacia(pdf):
    def falla(_):
        raise ImportError("pytesseract")

    paginas, avisos = et.leer_pdf(pdf, ocr=falla)
    assert paginas[2].origen == "vacia"
    assert any("OCR no disponible" in a for a in avisos)
    assert any("páginas sin texto legible: 3" in a for a in avisos)


def test_seleccion_sin_estructura_toma_la_pagina_y_la_siguiente():
    paginas = [
        et.Pagina(1, "Portada", "texto"),
        et.Pagina(2, "LICENCIA DE EDIFICACIÓN modalidad A", "texto"),
        et.Pagina(3, "Monto S/ 649.70", "ocr"),
        et.Pagina(4, "Licencia de funcionamiento", "texto"),
        et.Pagina(5, "", "vacia"),
    ]
    assert [[p.numero for p in g] for g in et.seleccionar(paginas)] == [[2, 3]]
    assert [[p.numero for p in g] for g in et.seleccionar(paginas, {1, 4, 5})] == [[1], [4]]


def test_seleccion_por_procedimiento_formato_sut():
    """El monto suele estar en la página de continuación, que no repite el nombre del trámite."""
    paginas = [
        et.Pagina(1, "Índice: Licencia de Edificación Modalidad A ... 12", "texto"),
        et.Pagina(2, "Denominación del Procedimiento: Licencia de Funcionamiento", "texto"),
        et.Pagina(3, "Monto - S/ 50.00", "texto"),
        et.Pagina(4, "Denominación del Procedimiento: Licencia de Edificación Modalidad A", "texto"),
        et.Pagina(5, "Requisitos ... Monto - S/ 649.70", "texto"),
        et.Pagina(6, "Denominación del Procedimiento\nConformidad de Obra\nCódigo: PE1 ... edificación", "texto"),
        et.Pagina(7, "Denominación del Procedimiento\nLicencia de funcionamiento para edificaciones\nCódigo: PE2", "texto"),
        et.Pagina(8, "Denominación del Procedimiento\nAutorización de publicidad\nCódigo: PE3 ... edificación", "texto"),
    ]
    assert [[p.numero for p in g] for g in et.bloques(paginas)] == [[1], [2, 3], [4, 5], [6], [7], [8]]
    # El índice queda fuera; se mira solo el título (la pág. 8 menciona edificación en la descripción).
    assert [[p.numero for p in g] for g in et.seleccionar(paginas)] == [[4, 5], [6]]


def test_servicios_prestados_en_exclusividad_tambien_son_bloques():
    servicio = et.Pagina(1, 'Denominación del Servicio "Certificado de Parámetros Urbanísticos y Edificatorios" Código: SE1', "texto")
    assert et.titulo_procedimiento(servicio.texto).strip(' "') == "certificado de parametros urbanisticos y edificatorios"
    assert [[p.numero for p in g] for g in et.seleccionar([servicio])] == [[1]]


def test_titulo_de_obra_aunque_mencione_espectaculos():
    assert et.es_de_obra("licencia de edificacion modalidad c - para locales de espectaculos")
    assert not et.es_de_obra("licencia de funcionamiento para edificaciones de riesgo alto")
    assert et.es_de_obra("aprobacion del proyecto integral de edificacion")
    assert not et.es_de_obra("certificado de jurisdiccion")


def test_paginas_rangos_y_lotes_sin_partir_procedimientos():
    assert et.parsear_paginas("10-12, 15,3-2") == {2, 3, 10, 11, 12, 15}
    assert et.rangos([7, 1, 2, 3, 9, 10]) == "1-3, 7, 9-10"
    assert et.rangos([]) == ""
    g = lambda *ns: [et.Pagina(n, "x", "texto") for n in ns]  # noqa: E731
    lotes = et.lotes([g(1, 2), g(3, 4), g(5), g(6, 7, 8)], 3)
    assert [[p.numero for p in l] for l in lotes] == [[1, 2], [3, 4, 5], [6, 7, 8]]
    assert "=== Página 3 (texto por OCR) ===" in et.texto_lote([et.Pagina(3, "abc", "ocr")])


# ---------------------------------------------------------------------------
# Esquema y llamada al modelo (simulada)
# ---------------------------------------------------------------------------


def test_esquema_estricto_con_ids_de_procedimientos():
    esquema = et.esquema_respuesta(["P-MUN-LIC-A", "P-MUN-CONF-SV"])
    fila = esquema["properties"]["filas"]["items"]
    assert fila["properties"]["procedimiento_id"]["enum"] == ["P-MUN-LIC-A", "P-MUN-CONF-SV"]

    def revisar(nodo):
        if isinstance(nodo, dict):
            if nodo.get("type") == "object":
                assert nodo["additionalProperties"] is False
                assert set(nodo["required"]) == set(nodo["properties"])
            for v in nodo.values():
                revisar(v)
        elif isinstance(nodo, list):
            for v in nodo:
                revisar(v)

    revisar(esquema)


def test_instrucciones_listan_los_procedimientos_y_prohiben_inventar():
    texto = et.instrucciones([{"id": "P-MUN-LIC-A", "nombre": "Licencia A"}], "Villa El Salvador", 2025)
    assert "- P-MUN-LIC-A: Licencia A" in texto
    assert "TUPA 2025" in texto
    assert "Nunca calcules" in texto


class _Stream:
    def __init__(self, mensaje):
        self.mensaje = mensaje

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        return self.mensaje


class ClienteFalso:
    def __init__(self, mensaje):
        self.llamadas = []
        mensajes = SimpleNamespace(stream=lambda **kw: (self.llamadas.append(kw), _Stream(mensaje))[1])
        self.beta = SimpleNamespace(messages=mensajes)


def mensaje(texto="{}", stop="end_turn"):
    return SimpleNamespace(
        stop_reason=stop,
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=texto)],
        usage=SimpleNamespace(input_tokens=1200, output_tokens=300),
    )


def test_llamar_modelo_pide_salida_estructurada_y_suma_tokens():
    respuesta = {"filas": [], "no_reconocidos": []}
    cliente = ClienteFalso(mensaje(json.dumps(respuesta)))
    uso = et.Uso()
    esquema = et.esquema_respuesta(["P-MUN-LIC-A"])
    assert et.llamar_modelo(cliente, "sistema", "=== Página 1 ===", esquema, uso) == respuesta
    kw = cliente.llamadas[0]
    assert kw["model"] == "claude-opus-5-5"
    assert kw["output_config"]["format"] == {"type": "json_schema", "schema": esquema}
    assert kw["fallbacks"] == "default" and kw["betas"] == [et.BETA_FALLBACK]
    assert "thinking" not in kw  # en Opus 5.5 el razonamiento adaptativo es el predeterminado
    assert (uso.entrada, uso.salida) == (1200, 300)


@pytest.mark.parametrize("stop, mensaje_error", [("refusal", "declinó"), ("max_tokens", "se cortó")])
def test_llamar_modelo_falla_si_no_termina_bien(stop, mensaje_error):
    with pytest.raises(et.ErrorExtraccion, match=mensaje_error):
        et.llamar_modelo(ClienteFalso(mensaje(stop=stop)), "s", "t", {}, et.Uso())


def test_sin_clave_falla_con_mensaje_claro(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(et.ErrorExtraccion, match="ANTHROPIC_API_KEY"):
        et.crear_cliente()


# ---------------------------------------------------------------------------
# Filas → tarifas
# ---------------------------------------------------------------------------

IDS = {"P-MUN-LIC-A", "P-MUN-CONF-SV", "P-MUN-PARAM"}
PAGS = {2: et.Pagina(2, "x", "texto"), 3: et.Pagina(3, "x", "ocr")}


def fila(proc="P-MUN-LIC-A", variante="Vivienda unifamiliar 120 m²", monto=649.7, pagina=2, codigo="093", **extra):
    return {
        "procedimiento_id": proc,
        "variante": variante,
        "codigo_tupa": codigo,
        "derecho_soles": monto,
        "plazo_dias_habiles": None,
        "pagina": pagina,
        "denominacion": "Vivienda unifamiliar",
        **extra,
    }


def armar(*filas, no_reconocidos=()):
    respuesta = {"filas": list(filas), "no_reconocidos": list(no_reconocidos)}
    return et.armar_tarifas([respuesta], UBIGEO, FUENTE, 2025, PAGS, IDS)


def test_normalizar_variante():
    assert et.normalizar_variante("Vivienda unifamiliar 120 m²") == "vivienda_unifamiliar_120_m"
    assert et.normalizar_variante("Demolición TOTAL") == "demolicion_total"
    assert et.normalizar_variante("") == "general"
    assert et.normalizar_variante(None) == "general"


def test_armar_tarifas_todo_por_verificar_con_pagina():
    ex = armar(fila(), fila(proc="P-MUN-CONF-SV", variante="general", monto=410.2, pagina=3, codigo=None))
    assert [t["id"] for t in ex.tarifas] == [
        "T-150142-P-MUN-LIC-A-vivienda_unifamiliar_120_m",
        "T-150142-P-MUN-CONF-SV-general",
    ]
    assert all(t["estado_verificacion"] == "por_verificar" for t in ex.tarifas)
    assert not any(t["estado_verificacion"] == "verificado" for t in ex.tarifas)
    assert ex.tarifas[0]["nota"] == "TUPA 2025, pág. 2"
    assert ex.tarifas[0]["fuente_id"] == FUENTE and ex.tarifas[0]["codigo_tupa"] == "093"
    assert ex.tarifas[1]["nota"] == "TUPA 2025, pág. 3 (leído por OCR: revisar con cuidado)"
    assert ex.origen["T-150142-P-MUN-CONF-SV-general"] == "ocr"


def test_armar_tarifas_aparta_lo_que_no_va_a_los_datos():
    ex = armar(
        fila(proc="P-NO-EXISTE"),
        fila(monto=None, variante="por uit"),
        fila(monto=-5, variante="negativo"),
        no_reconocidos=[{"codigo_tupa": "120", "denominacion": "Habilitación urbana", "derecho_soles": 900.0, "pagina": 4}],
    )
    assert ex.tarifas == []
    assert len(ex.sin_monto) == 2
    assert [n["codigo_tupa"] for n in ex.no_reconocidos] == ["120", "093"]
    assert "id desconocido: P-NO-EXISTE" in ex.no_reconocidos[1]["denominacion"]


def test_armar_tarifas_duplicados_y_conflictos():
    ex = armar(fila(), fila(pagina=3), fila(monto=700.0, pagina=3))
    assert len(ex.tarifas) == 1 and ex.tarifas[0]["derecho_soles"] == 649.7
    assert len(ex.conflictos) == 1 and "S/ 700.0" in ex.conflictos[0]


def test_filas_cumplen_el_esquema_de_data():
    esquema = json.loads((ROOT / "schema" / "data.schema.json").read_text(encoding="utf-8"))
    ex = armar(fila(), fila(proc="P-MUN-PARAM", variante="general", monto=92.9, codigo=None))
    assert et.validar_tarifas(ex.tarifas, esquema) == []
    malo = {**ex.tarifas[0], "origen": "ocr"}
    assert et.validar_tarifas([malo], esquema)


# ---------------------------------------------------------------------------
# Comparación y aplicación
# ---------------------------------------------------------------------------


def tarifa(tid, ubigeo, proc, variante, monto, estado="verificado"):
    return {
        "id": tid, "ubigeo": ubigeo, "procedimiento_id": proc, "variante": variante, "codigo_tupa": None,
        "derecho_soles": monto, "plazo_dias_habiles": None, "fuente_id": "F-X", "estado_verificacion": estado, "nota": None,
    }


EXISTENTES = [
    tarifa("T-150114-P-MUN-PARAM-general", "150114", "P-MUN-PARAM", "general", 92.9),
    tarifa("T-150142-P-MUN-PARAM-general", UBIGEO, "P-MUN-PARAM", "general", 80.0),
    tarifa("T-150142-P-MUN-LIC-A-general", UBIGEO, "P-MUN-LIC-A", "general", None, "por_verificar"),
    tarifa("T-150142-P-MUN-CONF-SV-general", UBIGEO, "P-MUN-CONF-SV", "general", 410.2),
    tarifa("T-150140-P-MUN-PARAM-general", "150140", "P-MUN-PARAM", "general", 120.0),
]


def test_comparar_y_aplicar_nunca_borra():
    ex = armar(
        fila(),  # NUEVA: variante que no existía
        fila(proc="P-MUN-PARAM", variante="general", monto=95.5, codigo="203"),  # CAMBIÓ: 80 → 95.5
        fila(proc="P-MUN-CONF-SV", variante="general", monto=410.2),  # IGUAL
    )
    cambios = et.comparar(EXISTENTES, ex.tarifas)
    assert [c.tipo for c in cambios] == [et.NUEVA, et.CAMBIO, et.IGUAL]

    resultado = et.aplicar(EXISTENTES, cambios)
    assert {t["id"] for t in EXISTENTES} <= {t["id"] for t in resultado}
    assert len(resultado) == len(EXISTENTES) + 1
    # La nueva queda junto a su distrito, antes del siguiente.
    assert [t["ubigeo"] for t in resultado] == ["150114", UBIGEO, UBIGEO, UBIGEO, UBIGEO, "150140"]
    corregida = next(t for t in resultado if t["id"] == "T-150142-P-MUN-PARAM-general")
    assert corregida["derecho_soles"] == 95.5 and corregida["codigo_tupa"] == "203"
    assert corregida["estado_verificacion"] == "por_verificar"  # un monto corregido vuelve a revisión
    assert corregida["fuente_id"] == FUENTE
    igual = next(t for t in resultado if t["id"] == "T-150142-P-MUN-CONF-SV-general")
    assert igual == EXISTENTES[3]  # las iguales no se tocan
    assert EXISTENTES[1]["derecho_soles"] == 80.0  # no muta la lista original


def test_marcadores_sin_monto_que_probablemente_sobran():
    ex = armar(fila())
    cambios = et.comparar(EXISTENTES, ex.tarifas)
    assert [t["id"] for t in et.marcadores_pendientes(EXISTENTES, cambios, UBIGEO)] == ["T-150142-P-MUN-LIC-A-general"]


def test_reporte_tabla_y_advertencias():
    ex = armar(fila(), fila(proc="P-MUN-PARAM", variante="general", monto=95.5, pagina=3, codigo=None))
    cambios = et.comparar(EXISTENTES, ex.tarifas)
    fuente = {"id": FUENTE, "titulo": "TUPA VES", "url": "https://x"}
    texto = et.armar_reporte(
        "Villa El Salvador", UBIGEO, 2025, fuente, "tupa.pdf", cambios, ex,
        et.marcadores_pendientes(EXISTENTES, cambios, UBIGEO), ["1 páginas sin texto legible: 3."], [2, 3],
        et.Uso(1000, 200), {"P-MUN-LIC-A": "Licencia A", "P-MUN-PARAM": "Parámetros"},
    )
    assert "**1 nuevas · 1 cambiaron · 0 iguales**" in texto
    assert "| CAMBIÓ | — | Parámetros (`P-MUN-PARAM`) | `general` | S/ 80.00 → S/ 95.50 | 3 | ⚠️ OCR |" in texto
    assert "| NUEVA | 093 | Licencia A (`P-MUN-LIC-A`) | `vivienda_unifamiliar_120_m` | S/ 649.70 | 2 | texto |" in texto
    assert "Nunca hagas auto-merge" in texto
    assert "`T-150142-P-MUN-LIC-A-general`" in texto
    assert "tokens: 1,000 de entrada y 200 de salida" in texto


# ---------------------------------------------------------------------------
# De punta a punta (sin API: --desde-respuestas) sobre una copia de data/
# ---------------------------------------------------------------------------


@pytest.fixture
def data(tmp_path: Path) -> Path:
    destino = tmp_path / "data"
    shutil.copytree(ROOT / "data", destino)
    return destino


def test_dry_run_no_escribe(pdf, data, capsys):
    antes = (data / "tarifas_distritales.json").read_bytes()
    assert et.main(["--ubigeo", UBIGEO, "--pdf", str(pdf), "--data", str(data), "--dry-run", "--sin-ocr"]) == 0
    salida = capsys.readouterr().out
    assert "4 páginas en el PDF · 1 seleccionadas (2)" in salida
    assert (data / "tarifas_distritales.json").read_bytes() == antes


def test_de_punta_a_punta_sin_pr(pdf, data, tmp_path, capsys):
    respuestas = tmp_path / "respuestas.json"
    respuestas.write_text(
        json.dumps([{"filas": [fila(variante="vivienda_unifamiliar_120m2"), fila(proc="P-MUN-CONF-SV", variante="general", monto=410.2, codigo=None)], "no_reconocidos": []}]),
        encoding="utf-8",
    )
    antes = json.loads((data / "tarifas_distritales.json").read_text(encoding="utf-8"))
    codigo = et.main([
        "--ubigeo", UBIGEO, "--pdf", str(pdf), "--data", str(data), "--sin-pr", "--sin-ocr",
        "--desde-respuestas", str(respuestas),
    ])
    assert codigo == 0
    despues = json.loads((data / "tarifas_distritales.json").read_text(encoding="utf-8"))
    assert {t["id"] for t in antes} <= {t["id"] for t in despues}
    tocadas = [t for t in despues if t not in antes]
    assert {t["id"] for t in tocadas} == {"T-150142-P-MUN-LIC-A-vivienda_unifamiliar_120m2", "T-150142-P-MUN-CONF-SV-general"}
    assert all(t["estado_verificacion"] == "por_verificar" and t["fuente_id"] == FUENTE for t in tocadas)
    # Se escribe con el mismo formato que el archivo versionado.
    texto = (data / "tarifas_distritales.json").read_text(encoding="utf-8")
    assert texto == json.dumps(despues, ensure_ascii=False, indent=2)
    assert "data/tarifas_distritales.json actualizado en local" in capsys.readouterr().out


def test_ubigeo_o_fuente_desconocidos(pdf, data):
    assert et.main(["--ubigeo", "999999", "--pdf", str(pdf), "--data", str(data), "--dry-run"]) == 2
    assert et.main(["--ubigeo", UBIGEO, "--pdf", str(pdf), "--data", str(data), "--fuente-id", "F-NO", "--dry-run"]) == 2
