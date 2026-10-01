"""Pruebas de scripts/watch_sources.py (sin red: las respuestas se simulan)."""
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import watch_sources as ws  # noqa: E402

HOY = date(2026, 10, 5)
URL = "https://www.ejemplo.gob.pe/tupa.pdf"


def fuente(fid="F-A", url=URL, consulta="2026-09-30", titulo="TUPA de ejemplo"):
    return {"id": fid, "titulo": titulo, "url": url, "tipo": "oficial", "fecha_consulta": consulta}


def ok(h="h1", url_final=URL, tipo="application/pdf"):
    return ws.Respuesta(ok=True, codigo=200, url_final=url_final, content_type=tipo, huella=h)


FALLA = ws.Respuesta(ok=False, error="TimeoutError: timed out")


def datos_base(fuentes=None, **extra):
    d = {
        "fuentes.json": fuentes or [fuente()],
        "meta.json": {"uit": {"anio": 2026, "valor": 5500}, "vigilancia": {"dias_sin_revision": 180}},
        "procedimientos.json": [{"id": "P-1", "fuentes": ["F-A"]}],
        "tarifas_distritales.json": [{"id": "T-1", "fuente_id": "F-A"}, {"id": "T-2", "fuente_id": "F-B"}],
        "distritos.json": [{"ubigeo": "150108", "nombre": "Chorrillos", "tupa": {"anio": 2025, "fuente_id": "F-A"}}],
        "normas.json": [],
        "reglas.json": [],
        "programas.json": [],
        "zonas_especiales.json": [],
        "vencimientos.json": [],
    }
    d.update(extra)
    return d


# --- Normalización de HTML -------------------------------------------------

def test_texto_visible_ignora_scripts_estilos_y_espacios():
    html = """<html><head><title>T</title><style>p{}</style></head>
      <body><script>var token='abc123';</script><p>Hola   <b>mundo</b></p>\n<noscript>x</noscript></body></html>"""
    assert ws.texto_visible(html) == "Hola mundo"


def test_huella_html_estable_ante_tokens_y_espacios():
    a = b"<p>TUPA 2025</p><script>var csrf='111';</script>"
    b = b"<p>TUPA   2025</p>\n<script>var csrf='999';</script>"
    tipo = "text/html; charset=utf-8"
    assert ws.huella(a, tipo) == ws.huella(b, tipo)
    assert ws.huella(a, tipo) != ws.huella(b"<p>TUPA 2026</p>", tipo)


def test_huella_binaria_usa_los_bytes():
    assert ws.huella(b"%PDF-1", "application/pdf") != ws.huella(b"%PDF-2", "application/pdf")


def test_redirige_ignora_https_y_barra_final():
    assert not ws.redirige("http://a.gob.pe/x/", "https://a.gob.pe/x")
    assert ws.redirige("https://a.gob.pe/x", "https://a.gob.pe/")
    assert ws.redirige("https://a.gob.pe/x", "https://b.gob.pe/x")
    assert not ws.redirige("https://a.gob.pe/x", None)


# --- Clasificación ---------------------------------------------------------

def test_primera_corrida_guarda_la_huella_sin_alarmar():
    r, e = ws.clasificar(fuente(), ok("h1"), None, "2026-10-05")
    assert r.estado == "OK" and e == {"huella": "h1", "fallas": 0}


def test_cambio_se_muestra_hasta_que_se_revisa_la_fuente():
    r, e = ws.clasificar(fuente(), ok("h2"), {"huella": "h1", "fallas": 0}, "2026-10-05")
    assert r.estado == "CAMBIO" and e["cambio_desde"] == "2026-10-05"
    # La semana siguiente, sin cambios nuevos pero sin revisar: sigue apareciendo.
    r, e = ws.clasificar(fuente(), ok("h2"), e, "2026-10-12")
    assert r.estado == "CAMBIO" and "05/10/2026" in r.detalle
    # Alguien la revisó (fecha_consulta actualizada en fuentes.json): deja de aparecer.
    r, e = ws.clasificar(fuente(consulta="2026-10-14"), ok("h2"), e, "2026-10-19")
    assert r.estado == "OK" and "cambio_desde" not in e


def test_caida_solo_a_la_segunda_semana_y_se_recupera():
    r, e = ws.clasificar(fuente(), FALLA, {"huella": "h1", "fallas": 0}, "2026-10-05")
    assert r.estado == "FALLA" and e["fallas"] == 1 and e["huella"] == "h1"
    r, e = ws.clasificar(fuente(), ws.Respuesta(ok=False, codigo=404, error="HTTP 404"), e, "2026-10-12")
    assert r.estado == "CAIDA" and "2 semanas" in r.detalle
    r, e = ws.clasificar(fuente(), ok("h1"), e, "2026-10-19")
    assert r.estado == "OK" and e["fallas"] == 0


def test_redirige_tiene_prioridad_sobre_ok():
    r, _ = ws.clasificar(fuente(), ok("h1", url_final="https://otro.gob.pe/"), {"huella": "h1"}, "2026-10-05")
    assert r.estado == "REDIRIGE" and "otro.gob.pe" in r.detalle


# --- Impacto, antigüedad y recordatorios -----------------------------------

def test_impacto_encuentra_citas_directas_listas_y_anidadas():
    usos = ws.impacto(datos_base())
    assert usos["F-A"] == [
        ("procedimientos.json", "P-1"),
        ("tarifas_distritales.json", "T-1"),
        ("distritos.json", "Chorrillos (150108)"),
    ]
    assert usos["F-B"] == [("tarifas_distritales.json", "T-2")]


def test_sin_revisar_agrupa_por_archivo_y_respeta_el_umbral():
    fuentes = [fuente("F-A", consulta="2026-04-07"), fuente("F-B", consulta="2026-04-08"), fuente("F-C", consulta=None)]
    d = datos_base(fuentes)
    grupos = ws.sin_revisar(fuentes, ws.impacto(d), HOY, 180)  # límite: 08/04/2026
    assert {a: [f["id"] for f in fs] for a, fs in grupos.items()} == {
        "procedimientos.json": ["F-A"],
        "tarifas_distritales.json": ["F-A"],
        "distritos.json": ["F-A"],
        "(sin uso en data/)": ["F-C"],
    }


def test_recordatorios_de_calendario():
    d = datos_base(**{
        "meta.json": {"uit": {"anio": 2026, "valor": 5500}},
        "distritos.json": [{"ubigeo": "1", "nombre": "Viejo", "tupa": {"anio": 2024}}, {"ubigeo": "2", "nombre": "Nuevo", "tupa": {"anio": 2026}}],
        "programas.json": [{"id": "PR-1", "nombre": "Techo Propio", "anio": 2025}, {"id": "PR-2", "nombre": "Otro", "anio": 2026}],
    })
    r = ws.recordatorios(d, date(2027, 1, 4))
    assert any("UIT" in x for x in r)
    assert any("Viejo" in x for x in r) and not any("Nuevo" in x for x in r)
    assert sum("Programa" in x for x in r) == 2  # en 2027 ambos quedaron atrás
    assert not any("UIT" in x for x in ws.recordatorios(d, date(2026, 10, 5)))


# --- Estado en el issue ----------------------------------------------------

def test_estado_ida_y_vuelta_sin_romper_el_comentario_html():
    estado = {"fuentes": {"F-A": {"huella": "h", "nota": "a-->b <x>"}}, "novedades": ["CAIDA:F-A"]}
    cuerpo = ws.escribir_estado("# Reporte", estado)
    assert cuerpo.count("-->") == 1  # solo el cierre del bloque
    assert ws.leer_estado("texto previo\n" + cuerpo) == estado


def test_estado_ausente_o_roto():
    assert ws.leer_estado(None) == {"fuentes": {}, "novedades": []}
    assert ws.leer_estado("<!-- estado-vigilancia {roto} -->") == {"fuentes": {}, "novedades": []}


# --- Corrida completa ------------------------------------------------------

def test_vigilar_dos_corridas_solo_avisa_lo_nuevo():
    d = datos_base([fuente("F-A"), fuente("F-B", url="https://b.gob.pe/x")])
    respuestas = {URL: ok("h1"), "https://b.gob.pe/x": FALLA}
    c1 = ws.vigilar(d, {"fuentes": {}, "novedades": []}, HOY, respuestas.__getitem__, pausa=0, reintento=0)
    assert [r.estado for r in c1.resultados] == ["OK", "FALLA"] and c1.nuevas == []

    c2 = ws.vigilar(d, c1.estado, date(2026, 10, 12), respuestas.__getitem__, pausa=0, reintento=0)
    assert [r.estado for r in c2.resultados] == ["OK", "CAIDA"]
    assert c2.nuevas == ["CAIDA:F-B"]
    assert "## 🔴 Caídas" in c2.reporte and "`tarifas_distritales.json`: `T-2`" in c2.reporte

    c3 = ws.vigilar(d, c2.estado, date(2026, 10, 19), respuestas.__getitem__, pausa=0, reintento=0)
    assert c3.nuevas == []  # sigue caída, pero ya se avisó: no se comenta de nuevo


def test_reintento_evita_falsas_fallas():
    llamadas = []

    def consultar(url):
        llamadas.append(url)
        return FALLA if len(llamadas) == 1 else ok("h1")

    c = ws.vigilar(datos_base(), {"fuentes": {}, "novedades": []}, HOY, consultar, pausa=0, reintento=0.001)
    assert [r.estado for r in c.resultados] == ["OK"] and len(llamadas) == 2


def test_datos_reales_tienen_lo_que_el_script_necesita():
    datos = ws.cargar_datos(ws.ROOT / "data")
    usos = ws.impacto(datos)
    ids = {f["id"] for f in datos["fuentes.json"]}
    assert set(usos) <= ids, "data/ cita fuentes que no existen en fuentes.json"
    assert all(f.get("url") for f in datos["fuentes.json"])
    assert datos["meta.json"]["vigilancia"]["dias_sin_revision"] == 180


@pytest.mark.parametrize("iso,esperado", [("2026-01-05", "05/01/2026"), ("2026-12-31", "31/12/2026")])
def test_formato_fecha(iso, esperado):
    assert ws.formato_fecha(iso) == esperado
