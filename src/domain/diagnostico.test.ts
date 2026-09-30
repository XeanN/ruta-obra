import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  ETIQUETA_VERIFICACION,
  limpiarRespuestas,
  preguntasFaltantes,
  preguntasVisibles,
  preguntaVisible,
  respuestasAParams,
  respuestasDesdeParams,
  resumirDiagnostico,
  textoRespuesta,
  validarRespuesta,
  type BaseResumen,
} from "./diagnostico";
import type { Pregunta } from "./types";

const preguntas = knowledgeRepo.getPreguntas();
const pregunta = (id: string): Pregunta => {
  const p = knowledgeRepo.getPregunta(id);
  if (!p) throw new Error(id);
  return p;
};
const base: BaseResumen = {
  ...knowledgeRepo.baseReglas,
  programas: knowledgeRepo.getProgramas(),
};
const casoAngel = casos.find((c) => c.id === "caso-angel")!;

describe("preguntas visibles (mostrar_si)", () => {
  it("con igual", () => {
    const fecha = pregunta("fecha_construccion");
    expect(preguntaVisible(fecha, {})).toBe(false);
    expect(preguntaVisible(fecha, { construccion_existente: "si_sin_declarar" })).toBe(true);
    expect(preguntaVisible(fecha, { construccion_existente: "no" })).toBe(false);
  });

  it("con en", () => {
    const cambio = pregunta("cambio_estructural");
    expect(preguntaVisible(cambio, { tipo_obra: "ampliacion" })).toBe(true);
    expect(preguntaVisible(cambio, { tipo_obra: "remodelacion" })).toBe(true);
    expect(preguntaVisible(cambio, { tipo_obra: "obra_nueva" })).toBe(false);
  });

  it("sin mostrar_si siempre visible", () => {
    expect(preguntasVisibles(preguntas, {}).map((p) => p.id)).not.toContain("fecha_construccion");
    expect(preguntasVisibles(preguntas, {}).map((p) => p.id)).toContain("titulo");
  });
});

describe("limpiarRespuestas", () => {
  it("borra respuestas de preguntas ocultas o desconocidas y valores vacíos", () => {
    const r = limpiarRespuestas(preguntas, {
      construccion_existente: "no",
      fecha_construccion: "hasta_2016",
      tipo_obra: "obra_nueva",
      cambio_estructural: "si",
      inventada: "x",
      pisos: null,
    });
    expect(r).toEqual({ construccion_existente: "no", tipo_obra: "obra_nueva" });
  });

  it("repite hasta estabilizar cuando una pregunta oculta dependía de otra", () => {
    const encadenadas: Pregunta[] = [
      { id: "a", texto: "a", tipo: "opcion", obligatoria: true, opciones: [{ valor: "si", etiqueta: "Sí" }] },
      { id: "b", texto: "b", tipo: "opcion", obligatoria: false, mostrar_si: { pregunta: "a", igual: "si" }, opciones: [{ valor: "si", etiqueta: "Sí" }] },
      { id: "c", texto: "c", tipo: "opcion", obligatoria: false, mostrar_si: { pregunta: "b", igual: "si" }, opciones: [{ valor: "si", etiqueta: "Sí" }] },
    ];
    expect(limpiarRespuestas(encadenadas, { b: "si", c: "si" })).toEqual({});
    expect(limpiarRespuestas(encadenadas, { a: "si", b: "si", c: "si" })).toEqual({ a: "si", b: "si", c: "si" });
  });
});

describe("validarRespuesta", () => {
  it("opción obligatoria", () => {
    const p = pregunta("titulo");
    expect(validarRespuesta(p, "inscrito")).toEqual({ ok: true, valor: "inscrito" });
    expect(validarRespuesta(p, undefined)).toEqual({ ok: false, error: "Elige una opción" });
    expect(validarRespuesta(p, "otra")).toEqual({ ok: false, error: "Elige una opción de la lista" });
  });

  it("opción opcional acepta vacío", () => {
    expect(validarRespuesta(pregunta("financiamiento"), undefined)).toEqual({ ok: true, valor: undefined });
  });

  it("número con mínimo y máximo", () => {
    const p = pregunta("pisos");
    expect(validarRespuesta(p, 3)).toEqual({ ok: true, valor: 3 });
    expect(validarRespuesta(p, 0)).toEqual({ ok: false, error: "Debe ser al menos 1" });
    expect(validarRespuesta(p, 61)).toEqual({ ok: false, error: "Debe ser como máximo 60" });
    expect(validarRespuesta(p, Number.NaN)).toEqual({ ok: false, error: "Ingresa un número" });
    expect(validarRespuesta(p, null)).toEqual({ ok: false, error: "Ingresa un número" });
  });

  it("número opcional", () => {
    expect(validarRespuesta(pregunta("valor_obra_soles"), undefined).ok).toBe(true);
    expect(validarRespuesta(pregunta("valor_obra_soles"), -1).ok).toBe(false);
  });
});

describe("preguntasFaltantes", () => {
  it("lista obligatorias visibles sin respuesta válida", () => {
    const faltan = preguntasFaltantes(preguntas, { titulo: "inscrito", pisos: 0 }).map((p) => p.id);
    expect(faltan).toContain("pisos");
    expect(faltan).toContain("distrito");
    expect(faltan).not.toContain("titulo");
    expect(faltan).not.toContain("financiamiento");
  });

  it("vacío con el caso completo", () => {
    expect(preguntasFaltantes(preguntas, casoAngel.respuestas)).toEqual([]);
  });
});

describe("URL", () => {
  it("ida y vuelta conserva las respuestas del caso real", () => {
    const params = respuestasAParams(preguntas, casoAngel.respuestas);
    expect(params.get("pisos")).toBe("3");
    const leidas = respuestasDesdeParams(preguntas, Object.fromEntries(params));
    expect(leidas).toEqual(casoAngel.respuestas);
  });

  it("descarta valores inválidos, vacíos, ocultos y desconocidos; toma el primero de un arreglo", () => {
    const r = respuestasDesdeParams(preguntas, {
      titulo: ["inscrito", "herencia"],
      pisos: "muchos",
      area_total_m2: "",
      uso: "castillo",
      construccion_existente: "no",
      fecha_construccion: "hasta_2016",
      _modalidad: "A",
    });
    expect(r).toEqual({ titulo: "inscrito", construccion_existente: "no" });
  });

  it("omite respuestas vacías al escribir", () => {
    expect(respuestasAParams(preguntas, { titulo: "inscrito", pisos: null, uso: undefined }).toString()).toBe(
      "titulo=inscrito",
    );
  });
});

describe("resumirDiagnostico", () => {
  it("caso-angel: modalidad B explicada con la licencia B y alertas por nivel", () => {
    const res = resumirDiagnostico(casoAngel.respuestas, base);
    expect(res.modalidad?.modalidad).toBe("B");
    expect(res.modalidad?.regla.id).toBe("R-MOD-B");
    expect(res.modalidad?.licencia?.id).toBe("P-MUN-LIC-B");
    expect(res.modalidad?.fuentes).toEqual(["F-ELEMENTAL-MOD", "F-PLIBRE", "F-MOLINA-PROC"]);
    expect(res.alertasPorNivel.map((g) => g.nivel)).toEqual(["critica", "alta"]);
    expect(res.alertasPorNivel.flatMap((g) => g.alertas.map((a) => a.id))).toEqual([
      "A-TITULO-BLOQUEA",
      "A-PANTANOS",
    ]);
    expect(res.programas).toEqual([]);
  });

  it("programas aplicables se resuelven a su ficha", () => {
    const techo = casos.find((c) => c.id === "post-2018-techo-propio")!;
    const res = resumirDiagnostico(techo.respuestas, base);
    expect(res.programas.map((p) => p.id)).toContain("PR-TP-CSP");
    expect(res.alertasPorNivel[0]?.nivel).toBe("critica");
  });

  it("sin modalidad cuando ninguna regla cumple", () => {
    const res = resumirDiagnostico({}, { ...base, reglas: base.reglas.filter((r) => r.tipo !== "modalidad") });
    expect(res.modalidad).toBeNull();
  });

  it("ignora programas que no existen en programas.json", () => {
    const res = resumirDiagnostico(casoAngel.respuestas, {
      ...base,
      reglas: [{ id: "PG-X", tipo: "programa", si: { todas: [] }, programa_id: "PR-NO-EXISTE" }],
    });
    expect(res.diagnostico.programas).toEqual(["PR-NO-EXISTE"]);
    expect(res.programas).toEqual([]);
  });
});

describe("textos", () => {
  it("respuesta legible", () => {
    expect(textoRespuesta(pregunta("distrito"), "150108")).toBe("Chorrillos");
    expect(textoRespuesta(pregunta("distrito"), "999")).toBe("999");
    expect(textoRespuesta(pregunta("valor_obra_soles"), 180000)).toBe("180,000");
    expect(textoRespuesta(pregunta("pisos"), "3")).toBe("3");
    expect(textoRespuesta(pregunta("pisos"), undefined)).toBe("Sin respuesta");
  });

  it("etiquetas de verificación", () => {
    expect(ETIQUETA_VERIFICACION.por_verificar).toBe("Por confirmar");
    expect(ETIQUETA_VERIFICACION.fuente_secundaria).toBe("Referencial");
  });
});
